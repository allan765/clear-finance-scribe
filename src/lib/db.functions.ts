import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// All write operations to entries/months/settings/storage go through here.
// The browser anon role no longer has RLS permission to write — server functions
// use the service-role client to perform writes safely.

const RECEIPT_URL_TTL_SECONDS = 60 * 60 * 24 * 365 * 5; // 5 years

const EntryInsertSchema = z.object({
  month_id: z.string().uuid(),
  entry_date: z.string(),
  description: z.string().default(""),
  classification: z.string().default("nao_classificado"),
  credit: z.number().default(0),
  debit: z.number().default(0),
  notes: z.string().nullable().optional(),
});

const EntryPatchSchema = z.object({
  id: z.string().uuid(),
  entry_date: z.string().optional(),
  description: z.string().optional(),
  classification: z.string().optional(),
  credit: z.number().optional(),
  debit: z.number().optional(),
  notes: z.string().nullable().optional(),
  doc_number: z.number().int().optional(),
  receipt_url: z.string().nullable().optional(),
  receipt_path: z.string().nullable().optional(),
});

async function nextDocNumber(admin: any, monthId: string) {
  const { data } = await admin
    .from("entries")
    .select("doc_number")
    .eq("month_id", monthId)
    .order("doc_number", { ascending: false })
    .limit(1);
  return ((data?.[0]?.doc_number as number | undefined) ?? 0) + 1;
}

async function renumberDocsAdmin(admin: any, monthId: string) {
  const { data: rows } = await admin
    .from("entries")
    .select("id, doc_number")
    .eq("month_id", monthId)
    .order("doc_number", { ascending: true });
  if (!rows) return;
  const offset = 100000;
  for (let i = 0; i < rows.length; i++) {
    const desired = i + 1;
    if (rows[i].doc_number !== desired) {
      await admin.from("entries").update({ doc_number: offset + desired }).eq("id", rows[i].id);
    }
  }
  for (let i = 0; i < rows.length; i++) {
    const desired = i + 1;
    if (rows[i].doc_number !== desired) {
      await admin.from("entries").update({ doc_number: desired }).eq("id", rows[i].id);
    }
  }
}

export const createEntryFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => EntryInsertSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const doc = await nextDocNumber(supabaseAdmin, data.month_id);
    const { error } = await supabaseAdmin.from("entries").insert({ ...data, doc_number: doc } as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateEntryFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => EntryPatchSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...patch } = data;
    const { error } = await supabaseAdmin.from("entries").update(patch as any).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteEntryFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: target } = await supabaseAdmin
      .from("entries")
      .select("month_id, receipt_path")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await supabaseAdmin.from("entries").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    if (target?.receipt_path) {
      await supabaseAdmin.storage.from("receipts").remove([target.receipt_path]);
    }
    if (target?.month_id) await renumberDocsAdmin(supabaseAdmin, target.month_id as string);
    return { ok: true };
  });

export const renumberDocsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ month_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await renumberDocsAdmin(supabaseAdmin, data.month_id);
    return { ok: true };
  });

const BulkSchema = z.object({
  month_id: z.string().uuid(),
  items: z
    .array(
      z.object({
        entry_date: z.string(),
        description: z.string(),
        classification: z.string(),
        credit: z.number(),
        debit: z.number(),
      }),
    )
    .max(2000),
});

export const bulkCreateEntriesFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => BulkSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.items.length === 0) return { count: 0 };
    let next = await nextDocNumber(supabaseAdmin, data.month_id);
    const rows = data.items.map((it) => ({
      month_id: data.month_id,
      doc_number: next++,
      entry_date: it.entry_date,
      description: it.description,
      classification: it.classification,
      credit: it.credit,
      debit: it.debit,
    }));
    const { error } = await supabaseAdmin.from("entries").insert(rows as any);
    if (error) throw new Error(error.message);
    return { count: rows.length };
  });

export const updateMonthFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        closed: z.boolean().optional(),
        closed_at: z.string().nullable().optional(),
        notes: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...patch } = data;
    const { error } = await supabaseAdmin.from("months").update(patch as any).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateSettingsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        responsible: z.string().optional(),
        identification: z.string().optional(),
        initial_balance: z.number().optional(),
        period_start: z.string().optional(),
        period_end: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...patch } = data;
    const { error } = await supabaseAdmin.from("settings").update(patch as any).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ------- Receipts (private bucket) -------

const MAX_RECEIPT_BYTES = 10 * 1024 * 1024; // 10 MB

export const uploadReceiptFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        entryId: z.string().uuid(),
        filename: z.string().max(255),
        contentType: z.string().max(128),
        // base64-encoded file payload (no data URL prefix)
        base64: z.string().max(Math.ceil((MAX_RECEIPT_BYTES * 4) / 3) + 128),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const bytes = Buffer.from(data.base64, "base64");
    if (bytes.byteLength > MAX_RECEIPT_BYTES) {
      throw new Error("Arquivo muito grande (máx 10 MB)");
    }
    const safeName = data.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${data.entryId}/${Date.now()}-${safeName}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("receipts")
      .upload(path, bytes, { contentType: data.contentType, upsert: false });
    if (upErr) throw new Error(upErr.message);

    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("receipts")
      .createSignedUrl(path, RECEIPT_URL_TTL_SECONDS);
    if (signErr) throw new Error(signErr.message);

    await supabaseAdmin
      .from("entries")
      .update({ receipt_path: path, receipt_url: signed.signedUrl })
      .eq("id", data.entryId);

    return { path, url: signed.signedUrl };
  });

export const deleteReceiptFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ entryId: z.string().uuid(), path: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.storage.from("receipts").remove([data.path]);
    await supabaseAdmin
      .from("entries")
      .update({ receipt_path: null, receipt_url: null })
      .eq("id", data.entryId);
    return { ok: true };
  });

// ------- Move entry between months -------

export const moveEntryFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        target_month_id: z.string().uuid(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cur } = await supabaseAdmin
      .from("entries")
      .select("month_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!cur) throw new Error("Lançamento não encontrado");
    const sourceMonthId = cur.month_id as string;
    if (sourceMonthId === data.target_month_id) return { ok: true };
    const next = await nextDocNumber(supabaseAdmin, data.target_month_id);
    const { error } = await supabaseAdmin
      .from("entries")
      .update({ month_id: data.target_month_id, doc_number: next } as any)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await renumberDocsAdmin(supabaseAdmin, sourceMonthId);
    await renumberDocsAdmin(supabaseAdmin, data.target_month_id);
    return { ok: true };
  });

// ------- Backup restore -------

const BackupSchema = z.object({
  months: z
    .array(
      z.object({
        id: z.string().uuid(),
        reference: z.string(),
        year: z.number().int(),
        month: z.number().int(),
        closed: z.boolean().optional(),
        notes: z.string().nullable().optional(),
      }),
    )
    .max(200),
  entries: z
    .array(
      z.object({
        id: z.string().uuid(),
        month_id: z.string().uuid(),
        doc_number: z.number().int(),
        entry_date: z.string(),
        description: z.string(),
        classification: z.string(),
        credit: z.number(),
        debit: z.number(),
        notes: z.string().nullable().optional(),
      }),
    )
    .max(10000),
});

export const restoreBackupFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => BackupSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let monthsUp = 0;
    let entriesUp = 0;
    for (const m of data.months) {
      const { error } = await supabaseAdmin
        .from("months")
        .upsert(
          {
            id: m.id,
            reference: m.reference,
            year: m.year,
            month: m.month,
            closed: m.closed ?? false,
            notes: m.notes ?? null,
          } as any,
          { onConflict: "id" },
        );
      if (!error) monthsUp++;
    }
    // upsert entries in chunks
    const chunkSize = 200;
    for (let i = 0; i < data.entries.length; i += chunkSize) {
      const chunk = data.entries.slice(i, i + chunkSize).map((e) => ({
        id: e.id,
        month_id: e.month_id,
        doc_number: e.doc_number,
        entry_date: e.entry_date,
        description: e.description,
        classification: e.classification,
        credit: e.credit,
        debit: e.debit,
        notes: e.notes ?? null,
      }));
      const { error } = await supabaseAdmin
        .from("entries")
        .upsert(chunk as any, { onConflict: "id" });
      if (!error) entriesUp += chunk.length;
    }
    // count remaining "nao_classificado"
    const { count: unclassified } = await supabaseAdmin
      .from("entries")
      .select("id", { count: "exact", head: true })
      .eq("classification", "nao_classificado");
    return { monthsUp, entriesUp, unclassified: unclassified ?? 0 };
  });

// ------- Month-level receipts PDF -------

const MAX_MONTH_RECEIPT_BYTES = 50 * 1024 * 1024; // 50 MB

export const createMonthReceiptUploadFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        monthId: z.string().uuid(),
        filename: z.string().max(255),
        contentType: z.string().max(128),
        size: z.number().int().positive().max(MAX_MONTH_RECEIPT_BYTES),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const isPdf = data.contentType === "application/pdf" || data.filename.toLowerCase().endsWith(".pdf");
    if (!isPdf) throw new Error("Envie um arquivo PDF.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const safeName = data.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `month-receipts/${data.monthId}/${Date.now()}-${safeName}`;
    const { data: signed, error } = await supabaseAdmin.storage
      .from("receipts")
      .createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { path, token: signed.token };
  });

export const finalizeMonthReceiptUploadFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        monthId: z.string().uuid(),
        path: z.string().max(1024),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const expectedPrefix = `month-receipts/${data.monthId}/`;
    if (!data.path.startsWith(expectedPrefix) || data.path.includes("..")) {
      throw new Error("Caminho do arquivo inválido.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cur } = await supabaseAdmin
      .from("months")
      .select("receipt_path")
      .eq("id", data.monthId)
      .maybeSingle();
    const oldPath = (cur as any)?.receipt_path as string | null | undefined;

    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("receipts")
      .createSignedUrl(data.path, RECEIPT_URL_TTL_SECONDS);
    if (signErr) throw new Error(signErr.message);

    const { error: updateErr } = await supabaseAdmin
      .from("months")
      .update({ receipt_path: data.path, receipt_url: signed.signedUrl } as any)
      .eq("id", data.monthId);
    if (updateErr) throw new Error(updateErr.message);

    if (oldPath && oldPath !== data.path) {
      await supabaseAdmin.storage.from("receipts").remove([oldPath]);
    }
    return { path: data.path, url: signed.signedUrl };
  });

export const uploadMonthReceiptFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        monthId: z.string().uuid(),
        filename: z.string().max(255),
        contentType: z.string().max(128),
        base64: z.string().max(MAX_MONTH_RECEIPT_BYTES * 2),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const bytes = Buffer.from(data.base64, "base64");
    if (bytes.byteLength > MAX_MONTH_RECEIPT_BYTES) {
      throw new Error("Arquivo muito grande (máx 50 MB)");
    }
    // remove old file if any
    const { data: cur } = await supabaseAdmin
      .from("months")
      .select("receipt_path")
      .eq("id", data.monthId)
      .maybeSingle();
    const oldPath = (cur as any)?.receipt_path as string | null | undefined;
    if (oldPath) {
      await supabaseAdmin.storage.from("receipts").remove([oldPath]);
    }
    const safeName = data.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `month-receipts/${data.monthId}/${Date.now()}-${safeName}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("receipts")
      .upload(path, bytes, { contentType: data.contentType, upsert: false });
    if (upErr) throw new Error(upErr.message);
    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("receipts")
      .createSignedUrl(path, RECEIPT_URL_TTL_SECONDS);
    if (signErr) throw new Error(signErr.message);
    await supabaseAdmin
      .from("months")
      .update({ receipt_path: path, receipt_url: signed.signedUrl } as any)
      .eq("id", data.monthId);
    return { path, url: signed.signedUrl };
  });

export const deleteMonthReceiptFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ monthId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cur } = await supabaseAdmin
      .from("months")
      .select("receipt_path")
      .eq("id", data.monthId)
      .maybeSingle();
    const path = (cur as any)?.receipt_path as string | null | undefined;
    if (path) await supabaseAdmin.storage.from("receipts").remove([path]);
    await supabaseAdmin
      .from("months")
      .update({ receipt_path: null, receipt_url: null } as any)
      .eq("id", data.monthId);
    return { ok: true };
  });
