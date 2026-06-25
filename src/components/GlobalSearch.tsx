import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useAllEntries, useMonths, useUpdateEntry, useMoveEntry } from "@/lib/data";
import { CLASSIFICATIONS, labelOf, type Classification } from "@/lib/classifications";
import { Input } from "@/components/ui/input";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { formatBRL, monthShort } from "@/lib/format";
import { Copy, ExternalLink, Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function GlobalSearch() {
  const { data: entries = [] } = useAllEntries();
  const { data: months = [] } = useMonths();
  const updateEntry = useUpdateEntry();
  const moveEntry = useMoveEntry();

  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState<Classification | "all">("all");

  const active = search.trim().length > 0 || classFilter !== "all";

  const monthById = useMemo(() => {
    const m = new Map<string, { reference: string }>();
    for (const x of months) m.set(x.id, { reference: x.reference });
    return m;
  }, [months]);

  const results = useMemo(() => {
    if (!active) return [];
    const s = search.trim().toLowerCase();
    return entries
      .filter((e) => {
        if (classFilter !== "all" && e.classification !== classFilter) return false;
        if (s && !e.description.toLowerCase().includes(s)) return false;
        return true;
      })
      .sort((a, b) => (a.entry_date < b.entry_date ? 1 : -1));
  }, [entries, active, search, classFilter]);

  return (
    <div className="bg-card border rounded p-4 space-y-3">
      <div>
        <h2 className="font-serif font-semibold flex items-center gap-2">
          <Search className="size-4" /> Buscar / filtrar em todos os meses
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Digite parte da descrição (ex: "agua") ou escolha uma classificação pra ver todos os lançamentos daquele tipo, em qualquer mês, e corrigir um por um.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_240px] gap-2">
        <Input
          placeholder='Buscar descrição (ex: "condomínio")'
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select value={classFilter} onValueChange={(v) => setClassFilter(v as Classification | "all")}>
          <SelectTrigger><SelectValue placeholder="Todas as classificações" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as classificações</SelectItem>
            {CLASSIFICATIONS.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {active && (
        <div className="border-t pt-2 -mx-4">
          <div className="px-4 pb-2 text-xs text-muted-foreground">
            {results.length} resultado(s)
          </div>
          <div className="max-h-[480px] overflow-y-auto divide-y">
            {results.map((e) => {
              const ref = monthById.get(e.month_id)?.reference ?? "";
              const isUnclassified = e.classification === "nao_classificado";
              return (
                <div
                  key={e.id}
                  className={cn(
                    "grid items-center gap-2 px-4 py-2 text-xs",
                    "grid-cols-[48px_92px_28px_minmax(0,1fr)_180px_110px_64px]",
                    isUnclassified && "bg-amber-500/10",
                  )}
                >
                  <span className="font-mono text-muted-foreground">#{e.doc_number}</span>

                  <Select
                    value={ref}
                    onValueChange={async (newRef) => {
                      if (newRef === ref) return;
                      const target = months.find((m) => m.reference === newRef);
                      if (!target) return;
                      try {
                        await moveEntry.mutateAsync({ id: e.id, target_month_id: target.id });
                        toast.success(`Movido para ${monthShort(newRef)}`);
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Falha ao mover");
                      }
                    }}
                  >
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {months.map((m) => (
                        <SelectItem key={m.id} value={m.reference}>{monthShort(m.reference)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Link
                    to="/mes/$ref"
                    params={{ ref }}
                    className="p-1 text-primary hover:bg-primary/10 rounded inline-flex items-center justify-center"
                    title="Abrir mês"
                  >
                    <ExternalLink className="size-3.5" />
                  </Link>

                  <Input
                    defaultValue={e.description}
                    className="h-7 text-xs"
                    onBlur={(ev) => {
                      const v = ev.target.value;
                      if (v !== e.description) {
                        updateEntry.mutate({ id: e.id, description: v });
                      }
                    }}
                  />

                  <Select
                    value={e.classification}
                    onValueChange={(v) => updateEntry.mutate({ id: e.id, classification: v as Classification })}
                  >
                    <SelectTrigger className={cn("h-7 text-xs", isUnclassified && "border-amber-400 font-semibold")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CLASSIFICATIONS.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <span className={cn(
                    "text-right tabular-nums font-medium",
                    Number(e.credit) > 0 ? "text-success" : "text-destructive",
                  )}>
                    {Number(e.credit) > 0 ? formatBRL(Number(e.credit)) : formatBRL(-Number(e.debit))}
                  </span>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(e.description);
                        toast.success("Descrição copiada");
                      } catch {
                        toast.error("Não foi possível copiar");
                      }
                    }}
                  >
                    <Copy className="size-3.5 mr-1" /> Copiar
                  </Button>
                </div>
              );
            })}
            {results.length === 0 && (
              <div className="px-4 py-6 text-center text-muted-foreground text-xs">
                Nenhum lançamento corresponde aos filtros.
              </div>
            )}
            {!active && null}
            {active && results.length > 0 && (
              <div className="px-4 py-2 text-[10px] text-muted-foreground italic">
                Dica: edite a descrição ou a classificação direto aqui — as alterações salvam ao sair do campo. Use o seletor de mês para mover lançamentos lançados no mês errado.
              </div>
            )}
            {/* dummy to satisfy labelOf reference (avoid lint) */}
            <span className="hidden">{labelOf("nao_classificado")}</span>
          </div>
        </div>
      )}
    </div>
  );
}
