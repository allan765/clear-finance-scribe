import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Classification } from "./classifications";

export type Month = {
  id: string;
  reference: string;
  year: number;
  month: number;
  closed: boolean;
  closed_at: string | null;
  notes: string | null;
};

export type Entry = {
  id: string;
  month_id: string;
  doc_number: number;
  entry_date: string;
  description: string;
  classification: Classification;
  credit: number;
  debit: number;
  notes: string | null;
  receipt_url: string | null;
  receipt_path: string | null;
};

export type Settings = {
  id: string;
  responsible: string;
  identification: string;
  initial_balance: number;
  period_start: string;
  period_end: string;
};

export function useMonths() {
  return useQuery({
    queryKey: ["months"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("months")
        .select("*")
        .order("reference", { ascending: true });
      if (error) throw error;
      return data as Month[];
    },
  });
}

export function useMonth(reference: string) {
  return useQuery({
    queryKey: ["month", reference],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("months")
        .select("*")
        .eq("reference", reference)
        .maybeSingle();
      if (error) throw error;
      return data as Month | null;
    },
    enabled: !!reference,
  });
}

export function useEntries(monthId: string | undefined) {
  return useQuery({
    queryKey: ["entries", monthId],
    queryFn: async () => {
      if (!monthId) return [];
      const { data, error } = await supabase
        .from("entries")
        .select("*")
        .eq("month_id", monthId)
        .order("doc_number", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Entry[];
    },
    enabled: !!monthId,
  });
}


export function useAllEntries() {
  return useQuery({
    queryKey: ["entries-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entries")
        .select("*, months!inner(reference, year, month)")
        .order("entry_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as (Entry & { months: { reference: string; year: number; month: number } })[];
    },
  });
}

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as Settings | null;
    },
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Settings> & { id: string }) => {
      const { error } = await supabase
        .from("settings")
        .update(patch)
        .eq("id", patch.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });
}

export function useCreateEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      month_id: string;
      entry_date: string;
      description?: string;
      classification?: Classification;
      credit?: number;
      debit?: number;
      notes?: string | null;
    }) => {
      // Next doc number for that month
      const { data: maxData } = await supabase
        .from("entries")
        .select("doc_number")
        .eq("month_id", payload.month_id)
        .order("doc_number", { ascending: false })
        .limit(1);
      const next = ((maxData?.[0]?.doc_number as number | undefined) ?? 0) + 1;
      const { error } = await supabase.from("entries").insert({
        ...payload,
        doc_number: next,
        description: payload.description ?? "",
        classification: payload.classification ?? "nao_classificado",
        credit: payload.credit ?? 0,
        debit: payload.debit ?? 0,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["entries", vars.month_id] });
      qc.invalidateQueries({ queryKey: ["entries-all"] });
    },
  });
}

export function useUpdateEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Entry> & { id: string }) => {
      const { error } = await supabase.from("entries").update(patch).eq("id", patch.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entries"] });
      qc.invalidateQueries({ queryKey: ["entries-all"] });
    },
  });
}

export function useDeleteEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Buscar o month_id antes de deletar para renumerar depois
      const { data: target } = await supabase
        .from("entries")
        .select("month_id")
        .eq("id", id)
        .maybeSingle();
      const { error } = await supabase.from("entries").delete().eq("id", id);
      if (error) throw error;
      if (target?.month_id) {
        await renumberDocs(target.month_id as string);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entries"] });
      qc.invalidateQueries({ queryKey: ["entries-all"] });
    },
  });
}

// Reorganiza os Nº Doc. de um mês para 1..N preservando a ordem atual (doc_number ASC).
async function renumberDocs(monthId: string) {
  const { data: rows, error } = await supabase
    .from("entries")
    .select("id, doc_number")
    .eq("month_id", monthId)
    .order("doc_number", { ascending: true });
  if (error || !rows) return;
  // 1ª passada: deslocar para um range alto para evitar colisão caso surja UNIQUE no futuro
  const offset = 100000;
  for (let i = 0; i < rows.length; i++) {
    const desired = i + 1;
    if (rows[i].doc_number !== desired) {
      await supabase.from("entries").update({ doc_number: offset + desired }).eq("id", rows[i].id);
    }
  }
  // 2ª passada: aplicar o número final
  for (let i = 0; i < rows.length; i++) {
    const desired = i + 1;
    if (rows[i].doc_number !== desired) {
      await supabase.from("entries").update({ doc_number: desired }).eq("id", rows[i].id);
    }
  }
}

export function useRenumberDocs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (monthId: string) => {
      await renumberDocs(monthId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entries"] });
      qc.invalidateQueries({ queryKey: ["entries-all"] });
    },
  });
}


export function useBulkCreateEntries() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      month_id: string;
      items: Array<{
        entry_date: string;
        description: string;
        classification: Classification;
        credit: number;
        debit: number;
      }>;
    }) => {
      if (payload.items.length === 0) return 0;
      const { data: maxData } = await supabase
        .from("entries")
        .select("doc_number")
        .eq("month_id", payload.month_id)
        .order("doc_number", { ascending: false })
        .limit(1);
      let next = ((maxData?.[0]?.doc_number as number | undefined) ?? 0) + 1;
      const sorted = [...payload.items].sort((a, b) => a.entry_date.localeCompare(b.entry_date));
      const rows = sorted.map((it) => ({
        month_id: payload.month_id,
        doc_number: next++,
        entry_date: it.entry_date,
        description: it.description,
        classification: it.classification,
        credit: it.credit,
        debit: it.debit,
      }));
      const { error } = await supabase.from("entries").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (_n, vars) => {
      qc.invalidateQueries({ queryKey: ["entries", vars.month_id] });
      qc.invalidateQueries({ queryKey: ["entries-all"] });
    },
  });
}

export function useToggleMonthClosed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, closed }: { id: string; closed: boolean }) => {
      const { error } = await supabase
        .from("months")
        .update({ closed, closed_at: closed ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["months"] });
      qc.invalidateQueries({ queryKey: ["month"] });
    },
  });
}

export function useUpdateMonthNotes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { error } = await supabase.from("months").update({ notes }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["month"] }),
  });
}

// Saldo inicial do mês = saldo inicial das settings + soma de (credito-debito) de todos os meses anteriores
export function computeRunningBalances(entries: Entry[], openingBalance: number) {
  let running = openingBalance;
  return entries.map((e) => {
    running = running + Number(e.credit) - Number(e.debit);
    return { ...e, balance: running };
  });
}
