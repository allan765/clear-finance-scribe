import { useMemo, useState } from "react";
import {
  useMonth, useEntries, useMonths, useSettings,
  useCreateEntry, useUpdateEntry, useDeleteEntry, useToggleMonthClosed, useUpdateMonthNotes,
  useBulkCreateEntries,
  computeRunningBalances,
  type Entry,
} from "@/lib/data";
import { preparePayload } from "@/lib/import-client";
import { parseStatement } from "@/lib/import.functions";
import type { Classification } from "@/lib/classifications";
import { CLASSIFICATIONS, labelOf } from "@/lib/classifications";
import { formatBRL, formatNumber, monthLabel } from "@/lib/format";
import { exportMonthPDF } from "@/lib/export";
import { uploadReceipt, deleteReceipt } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Lock, Unlock, Plus, Trash2, FileDown, Paperclip, Search, X, ExternalLink, Upload, Loader2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function MonthPage({ reference }: { reference: string }) {
  const { data: month, isLoading: mLoading } = useMonth(reference);
  const { data: entries = [] } = useEntries(month?.id);
  const { data: allMonths = [] } = useMonths();
  const { data: settings } = useSettings();

  const createEntry = useCreateEntry();
  const updateEntry = useUpdateEntry();
  const deleteEntry = useDeleteEntry();
  const toggleClosed = useToggleMonthClosed();
  const updateNotes = useUpdateMonthNotes();
  const bulkCreate = useBulkCreateEntries();

  const [importing, setImporting] = useState<null | "bank" | "expense">(null);

  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState<Classification | "all">("all");
  const [notesDraft, setNotesDraft] = useState<string | null>(null);

  // Saldo de abertura = inicial das settings + soma dos meses anteriores
  const opening = useMemo(() => {
    if (!settings || !month) return 0;
    // For simplicity (and correctness): fetch is per-month so we need all entries across earlier months.
    // We'll lazy compute by reading from cache via a quick aggregate: pass through 0 if not loaded.
    // (Implementação aprimorada: usar useAllEntries.)
    return Number(settings.initial_balance);
  }, [settings, month]);

  const { withBalance, totalC, totalD, finalBalance } = useMemo(() => {
    const wb = computeRunningBalances(entries, opening);
    const tc = entries.reduce((s, e) => s + Number(e.credit), 0);
    const td = entries.reduce((s, e) => s + Number(e.debit), 0);
    return { withBalance: wb, totalC: tc, totalD: td, finalBalance: opening + tc - td };
  }, [entries, opening]);

  const filtered = useMemo(() => {
    return withBalance.filter((e) => {
      if (classFilter !== "all" && e.classification !== classFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        if (
          !e.description.toLowerCase().includes(s) &&
          !labelOf(e.classification).toLowerCase().includes(s) &&
          !String(e.doc_number).includes(s)
        ) return false;
      }
      return true;
    });
  }, [withBalance, classFilter, search]);

  if (mLoading || !month) {
    return <div className="p-8 text-muted-foreground">Carregando mês...</div>;
  }

  const isClosed = month.closed;

  const handleAdd = async () => {
    const today = `${month.year}-${String(month.month).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`;
    const date = `${month.year}-${String(month.month).padStart(2, "0")}-01`;
    await createEntry.mutateAsync({
      month_id: month.id,
      entry_date: today.startsWith(`${month.year}-${String(month.month).padStart(2, "0")}`) ? today : date,
    });
    toast.success("Lançamento adicionado");
  };

  const handleImport = async (file: File, kind: "bank" | "expense") => {
    if (!month) return;
    setImporting(kind);
    const tid = toast.loading(`Interpretando ${kind === "bank" ? "extrato" : "despesas"} com IA...`);
    try {
      const prep = await preparePayload(file);
      const payload = {
        kind,
        monthRef: month.reference,
        filename: prep.filename,
        ...(prep.kind === "text" ? { text: prep.text } : { imageDataUrl: prep.imageDataUrl }),
      };
      const result = await parseStatement({ data: payload });
      if (result.transactions.length === 0) {
        toast.error("Nenhum lançamento encontrado para este mês.", { id: tid });
        return;
      }
      const inserted = await bulkCreate.mutateAsync({
        month_id: month.id,
        items: result.transactions.map((t) => ({
          entry_date: t.date,
          description: t.description,
          classification: (t.classification as Classification) ?? "nao_classificado",
          credit: kind === "expense" ? 0 : Number(t.credit) || 0,
          debit: kind === "expense"
            ? (Number(t.debit) || Number(t.credit) || 0)
            : Number(t.debit) || 0,
        })),
      });
      toast.success(`${inserted} lançamento(s) importado(s). Revise os marcados como "Não classificado".`, { id: tid });
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Falha ao importar", { id: tid });
    } finally {
      setImporting(null);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl md:text-3xl font-bold">{monthLabel(month.reference)}</h1>
          <p className="text-sm text-muted-foreground">
            {entries.length} lançamento(s) • {isClosed ? "Mês fechado" : "Aberto para edição"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ImportButton
            disabled={month.closed || !!importing}
            importing={importing}
            onPick={handleImport}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => settings && exportMonthPDF({ month, entries, opening }, settings)}
          >
            <FileDown className="size-4 mr-1" /> PDF do mês
          </Button>
          <Button
            variant={isClosed ? "default" : "secondary"}
            size="sm"
            onClick={async () => {
              await toggleClosed.mutateAsync({ id: month.id, closed: !isClosed });
              toast.success(isClosed ? "Mês reaberto" : "Mês fechado");
            }}
          >
            {isClosed ? (<><Unlock className="size-4 mr-1" /> Reabrir mês</>) : (<><Lock className="size-4 mr-1" /> Fechar mês</>)}
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 bg-card border rounded p-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar descrição, categoria, nº doc..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={classFilter} onValueChange={(v) => setClassFilter(v as Classification | "all")}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {CLASSIFICATIONS.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(search || classFilter !== "all") && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setClassFilter("all"); }}>
            <X className="size-4 mr-1" /> Limpar
          </Button>
        )}
      </div>

      {/* Planilha */}
      <div className="bg-card border rounded overflow-x-auto">
        <table className="official-table">
          <thead>
            <tr>
              <th className="w-16">N.º Doc.</th>
              <th className="w-28">Data</th>
              <th>Descrição do Documento</th>
              <th className="w-48">Classificação</th>
              <th className="w-32">Recebimentos<br/>(Créditos)</th>
              <th className="w-32">Desembolsos<br/>(Débitos)</th>
              <th className="w-32">Saldo</th>
              <th className="w-20">Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-muted/40">
              <td className="center">-</td>
              <td className="center">01/{String(month.month).padStart(2, "0")}/{String(month.year).slice(2)}</td>
              <td className="italic text-muted-foreground">Saldo anterior</td>
              <td className="center">-</td>
              <td className="num">-</td>
              <td className="num">-</td>
              <td className="num font-semibold">{formatNumber(opening)}</td>
              <td></td>
            </tr>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center text-muted-foreground py-8">
                  {entries.length === 0 ? "Nenhum lançamento ainda. Clique em \"Adicionar lançamento\" para começar." : "Nenhum lançamento corresponde ao filtro."}
                </td>
              </tr>
            ) : (
              filtered.map((e) => (
                <EntryRow
                  key={e.id}
                  entry={e}
                  readOnly={isClosed}
                  onUpdate={(patch) => updateEntry.mutate({ id: e.id, ...patch })}
                  onDelete={() => { if (confirm("Excluir este lançamento?")) deleteEntry.mutate(e.id); }}
                />
              ))
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} className="text-right">Total do mês de {monthLabel(month.reference).toLowerCase()}</td>
              <td className="num">{formatNumber(totalC)}</td>
              <td className="num">{formatNumber(totalD)}</td>
              <td className="num">{formatNumber(finalBalance)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {!isClosed && (
        <Button onClick={handleAdd}>
          <Plus className="size-4 mr-1" /> Adicionar lançamento
        </Button>
      )}

      {/* Observações do mês */}
      <div className="bg-card border rounded p-4 space-y-2">
        <h3 className="font-serif font-semibold">Observações do mês</h3>
        <Textarea
          placeholder="Notas gerais sobre este mês (aparecem no PDF mensal)"
          rows={3}
          value={notesDraft ?? month.notes ?? ""}
          onChange={(e) => setNotesDraft(e.target.value)}
          disabled={isClosed}
        />
        {notesDraft !== null && notesDraft !== (month.notes ?? "") && (
          <div className="flex gap-2">
            <Button size="sm" onClick={async () => {
              await updateNotes.mutateAsync({ id: month.id, notes: notesDraft });
              setNotesDraft(null);
              toast.success("Observações salvas");
            }}>Salvar</Button>
            <Button size="sm" variant="ghost" onClick={() => setNotesDraft(null)}>Cancelar</Button>
          </div>
        )}
      </div>
    </div>
  );
}

function EntryRow({ entry, readOnly, onUpdate, onDelete }: {
  entry: Entry & { balance: number };
  readOnly: boolean;
  onUpdate: (patch: Partial<Entry>) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState<Partial<Entry>>({});
  const [uploading, setUploading] = useState(false);

  const v = { ...entry, ...editing };
  const dirty = Object.keys(editing).length > 0;
  const isUnclassified = v.classification === "nao_classificado";

  const commit = () => {
    if (dirty) onUpdate(editing);
    setEditing({});
  };

  return (
    <tr className={cn(isUnclassified && "bg-warning/10")}>
      <td className="center font-medium">{entry.doc_number}</td>
      <td className="center">
        <Input
          type="date"
          value={v.entry_date}
          disabled={readOnly}
          onChange={(e) => setEditing((p) => ({ ...p, entry_date: e.target.value }))}
          onBlur={commit}
          className="h-7 text-xs px-1.5 border-0 bg-transparent"
        />
      </td>
      <td>
        <Input
          value={v.description}
          disabled={readOnly}
          onChange={(e) => setEditing((p) => ({ ...p, description: e.target.value }))}
          onBlur={commit}
          className="h-7 text-xs border-0 bg-transparent px-1"
          placeholder="Descrição"
        />
        {v.notes && (
          <div className="text-[11px] text-muted-foreground italic px-1 mt-0.5">Obs: {v.notes}</div>
        )}
      </td>
      <td>
        <Select
          value={v.classification}
          disabled={readOnly}
          onValueChange={(val) => onUpdate({ classification: val as Classification })}
        >
          <SelectTrigger className={cn("h-7 text-xs border-0 bg-transparent", isUnclassified && "text-warning-foreground font-medium")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CLASSIFICATIONS.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="num">
        <Input
          type="number" step="0.01" min="0"
          value={v.credit ? String(v.credit) : ""}
          disabled={readOnly}
          onChange={(e) => setEditing((p) => ({ ...p, credit: e.target.value === "" ? 0 : Number(e.target.value) }))}
          onBlur={commit}
          className="h-7 text-xs text-right border-0 bg-transparent px-1"
          placeholder="-"
        />
      </td>
      <td className="num">
        <Input
          type="number" step="0.01" min="0"
          value={v.debit ? String(v.debit) : ""}
          disabled={readOnly}
          onChange={(e) => setEditing((p) => ({ ...p, debit: e.target.value === "" ? 0 : Number(e.target.value) }))}
          onBlur={commit}
          className="h-7 text-xs text-right border-0 bg-transparent px-1"
          placeholder="-"
        />
      </td>
      <td className="num font-semibold tabular-nums">{formatBRL(entry.balance)}</td>
      <td>
        <div className="flex items-center gap-0.5 justify-center">
          <ReceiptButton entry={entry} disabled={readOnly} uploading={uploading} setUploading={setUploading} onUpdate={onUpdate} />
          <NotesButton entry={entry} disabled={readOnly} onUpdate={onUpdate} />
          {!readOnly && (
            <button onClick={onDelete} className="p-1 text-destructive hover:bg-destructive/10 rounded" title="Excluir">
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function ReceiptButton({ entry, disabled, uploading, setUploading, onUpdate }: {
  entry: Entry;
  disabled: boolean;
  uploading: boolean;
  setUploading: (b: boolean) => void;
  onUpdate: (patch: Partial<Entry>) => void;
}) {
  if (entry.receipt_url) {
    return (
      <div className="flex items-center gap-0.5">
        <a href={entry.receipt_url} target="_blank" rel="noreferrer" className="p-1 text-success hover:bg-success/10 rounded" title="Ver comprovante">
          <ExternalLink className="size-3.5" />
        </a>
        {!disabled && (
          <button
            onClick={async () => {
              if (entry.receipt_path) await deleteReceipt(entry.receipt_path);
              onUpdate({ receipt_url: null, receipt_path: null });
            }}
            className="p-1 text-muted-foreground hover:bg-muted rounded"
            title="Remover comprovante"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
    );
  }
  return (
    <label className={cn("p-1 rounded cursor-pointer hover:bg-muted text-muted-foreground", disabled && "opacity-30 cursor-not-allowed")} title="Anexar comprovante">
      <Paperclip className="size-3.5" />
      <input
        type="file"
        className="hidden"
        disabled={disabled || uploading}
        accept="image/*,application/pdf"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try {
            setUploading(true);
            const { path, url } = await uploadReceipt(f, entry.id);
            onUpdate({ receipt_path: path, receipt_url: url });
            toast.success("Comprovante anexado");
          } catch (err) {
            toast.error("Falha ao enviar comprovante");
            console.error(err);
          } finally {
            setUploading(false);
            e.target.value = "";
          }
        }}
      />
    </label>
  );
}

function NotesButton({ entry, disabled, onUpdate }: { entry: Entry; disabled: boolean; onUpdate: (p: Partial<Entry>) => void }) {
  return (
    <button
      onClick={() => {
        if (disabled) return;
        const v = prompt("Observação para este lançamento:", entry.notes ?? "");
        if (v !== null) onUpdate({ notes: v || null });
      }}
      className={cn("p-1 rounded hover:bg-muted", entry.notes ? "text-primary" : "text-muted-foreground", disabled && "opacity-30")}
      title="Observações"
    >
      <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
      </svg>
    </button>
  );
}

function ImportButton({ disabled, importing, onPick }: {
  disabled: boolean;
  importing: null | "bank" | "expense";
  onPick: (file: File, kind: "bank" | "expense") => void;
}) {
  const pick = (kind: "bank" | "expense") => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,.csv,.ofx,.qif,.txt,image/*";
    input.onchange = () => {
      const f = input.files?.[0];
      if (f) onPick(f, kind);
    };
    input.click();
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          {importing ? (
            <><Loader2 className="size-4 mr-1 animate-spin" /> Importando...</>
          ) : (
            <><Upload className="size-4 mr-1" /> Importar</>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem onClick={() => pick("bank")}>
          <div>
            <div className="font-medium">Extrato bancário</div>
            <div className="text-xs text-muted-foreground">PDF, CSV, OFX ou imagem</div>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => pick("expense")}>
          <div>
            <div className="font-medium">Relatório de despesas</div>
            <div className="text-xs text-muted-foreground">PDF, planilha ou imagem</div>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
