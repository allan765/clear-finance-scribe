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
