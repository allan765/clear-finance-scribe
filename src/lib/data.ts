import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Classification } from "./classifications";
import {
  createEntryFn,
  updateEntryFn,
  deleteEntryFn,
  bulkCreateEntriesFn,
  renumberDocsFn,
  updateMonthFn,
  updateSettingsFn,
  moveEntryFn,
  restoreBackupFn,
} from "./db.functions";

export type Month = {
  id: string;
  reference: string;
  year: number;
  month: number;
  closed: boolean;
  closed_at: string | null;
  notes: string | null;
  receipt_path?: string | null;
  receipt_url?: string | null;
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
      await updateSettingsFn({ data: patch as any });
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
      await createEntryFn({
        data: {
          month_id: payload.month_id,
          entry_date: payload.entry_date,
          description: payload.description ?? "",
          classification: payload.classification ?? "nao_classificado",
          credit: payload.credit ?? 0,
          debit: payload.debit ?? 0,
          notes: payload.notes ?? null,
        },
      });
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
      await updateEntryFn({ data: patch as any });
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
      await deleteEntryFn({ data: { id } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entries"] });
      qc.invalidateQueries({ queryKey: ["entries-all"] });
    },
  });
}

export function useRenumberDocs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (monthId: string) => {
      await renumberDocsFn({ data: { month_id: monthId } });
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
      const res = await bulkCreateEntriesFn({ data: payload as any });
      return res.count;
    },
    onSuccess: (_n, vars) => {
      qc.invalidateQueries({ queryKey: ["entries", vars.month_id] });
      qc.invalidateQueries({ queryKey: ["entries-all"] });
    },
  });
}

export function useMoveEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, target_month_id }: { id: string; target_month_id: string }) => {
      await moveEntryFn({ data: { id, target_month_id } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entries"] });
      qc.invalidateQueries({ queryKey: ["entries-all"] });
    },
  });
}

export function useRestoreBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Parameters<typeof restoreBackupFn>[0]["data"]) => {
      return restoreBackupFn({ data: payload });
    },
    onSuccess: () => {
      qc.invalidateQueries();
    },
  });
}

export function useToggleMonthClosed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, closed }: { id: string; closed: boolean }) => {
      await updateMonthFn({
        data: { id, closed, closed_at: closed ? new Date().toISOString() : null },
      });
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
      await updateMonthFn({ data: { id, notes } });
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
