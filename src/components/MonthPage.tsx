import { useMemo, useState, useEffect } from "react";
import * as React from "react";
import {
  useMonth, useEntries, useMonths, useSettings, useAllEntries,
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
import { uploadReceipt, deleteReceipt, uploadMonthReceipt, deleteMonthReceipt } from "@/lib/storage";
import { downloadMonthCoverWithReceipts } from "@/lib/month-receipt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Lock, Unlock, Plus, Trash2, FileDown, Paperclip, Search, X, ExternalLink, Upload, Loader2, FileText } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function MonthPage({ reference }: { reference: string }) {
  const { data: month, isLoading: mLoading } = useMonth(reference);
  const { data: entries = [] } = useEntries(month?.id);
  const { data: allMonths = [] } = useMonths();
  const { data: allEntriesData = [] } = useAllEntries();
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

  // Saldo de abertura = saldo inicial das configurações + soma de todos os meses ANTERIORES
  const opening = useMemo(() => {
    if (!settings || !month) return 0;
    const initialBalance = Number(settings.initial_balance);
    // Pega todos os meses anteriores ao mês atual (em ordem)
    const previousMonths = allMonths.filter(m => m.reference < month.reference);
    const previousMonthIds = new Set(previousMonths.map(m => m.id));
    // Soma todos os lançamentos desses meses anteriores
    const previousTotal = allEntriesData
      .filter(e => previousMonthIds.has(e.month_id))
      .reduce((sum, e) => sum + Number(e.credit) - Number(e.debit), 0);
    return initialBalance + previousTotal;
  }, [settings, month, allMonths, allEntriesData]);

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

    // Regra: despesa só entra na prestação se houver correspondência no extrato.
    if (kind === "expense" && entries.length === 0) {
      toast.error(
        "Importe primeiro o EXTRATO BANCÁRIO do mês. Despesas só são aceitas com correspondência no extrato."
      );
      return;
    }

    setImporting(kind);
    const tid = toast.loading(`Interpretando ${kind === "bank" ? "extrato" : "despesas"} com IA...`);
    try {
      const prep = await preparePayload(file);
      const payload: {
        kind: "bank" | "expense";
        monthRef: string;
        filename: string;
        text?: string;
        imageDataUrl?: string;
        imageDataUrls?: string[];
      } = {
        kind,
        monthRef: month.reference,
        filename: prep.filename,
      };
      if (prep.kind === "text") payload.text = prep.text;
      else if (prep.kind === "image") payload.imageDataUrl = prep.imageDataUrl;
      else payload.imageDataUrls = prep.imageDataUrls;
      const result = await parseStatement({ data: payload });
      if (result.transactions.length === 0) {
        toast.error("Nenhum lançamento encontrado para este mês.", { id: tid });
        return;
      }

      let itemsToInsert = result.transactions.map((t) => ({
        entry_date: t.date,
        description: t.description,
        classification: (t.classification as Classification) ?? "nao_classificado",
        credit: kind === "expense" ? 0 : Number(t.credit) || 0,
        debit:
          kind === "expense"
            ? Number(t.debit) || Number(t.credit) || 0
            : Number(t.debit) || 0,
      }));

      let discarded = 0;

      if (kind === "expense") {
        // Conferência: para cada despesa, achar um débito do extrato com mesmo valor
        // e data próxima (±3 dias). Cada lançamento do extrato só pode casar 1 vez.
        const bankDebits = entries
          .filter((e) => Number(e.debit) > 0)
          .map((e) => ({
            id: e.id,
            date: e.entry_date,
            value: Math.round(Number(e.debit) * 100),
            used: false,
          }));

        const matched: typeof itemsToInsert = [];
        for (const item of itemsToInsert) {
          const cents = Math.round((item.debit || 0) * 100);
          if (cents <= 0) {
            discarded++;
            continue;
          }
          const itemTime = new Date(item.entry_date).getTime();
          const idx = bankDebits.findIndex((b) => {
            if (b.used || b.value !== cents) return false;
            const diff = Math.abs(new Date(b.date).getTime() - itemTime);
            return diff <= 3 * 24 * 60 * 60 * 1000;
          });
          if (idx === -1) {
            discarded++;
            continue;
          }
          bankDebits[idx].used = true;
          matched.push(item);
        }
        itemsToInsert = matched;

        if (itemsToInsert.length === 0) {
          toast.error(
            `Nenhuma despesa bateu com o extrato (${discarded} descartada(s)). Confira valores e datas.`,
            { id: tid }
          );
          return;
        }
      }

      const inserted = await bulkCreate.mutateAsync({
        month_id: month.id,
        items: itemsToInsert,
      });

      if (kind === "expense" && discarded > 0) {
        toast.success(
          `${inserted} despesa(s) conferida(s) e importada(s). ${discarded} descartada(s) por não terem correspondência no extrato.`,
          { id: tid }
        );
      } else {
        toast.success(
          `${inserted} lançamento(s) importado(s). Revise os marcados como "Não classificado".`,
          { id: tid }
        );
      }
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
          <MonthReceiptControls
            month={month}
            entries={entries}
            opening={opening}
            settings={settings}
          />
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
              <th className="w-12">N.º Doc.</th>
              <th className="w-24">Data</th>
              <th className="min-w-[420px]">Descrição do Documento</th>
              <th className="w-44">Classificação</th>
              <th className="w-28">Recebimentos<br/>(Créditos)</th>
              <th className="w-28">Desembolsos<br/>(Débitos)</th>
              <th className="w-28">Saldo</th>
              <th className="w-16">Ações</th>
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
    <tr className={cn(isUnclassified && "bg-amber-500/10 dark:bg-amber-500/15 text-amber-900 dark:text-amber-200 transition-colors duration-150")}>
      <td className="center font-medium">
        <Input
          type="number"
          min={1}
          step={1}
          value={v.doc_number ?? entry.doc_number}
          disabled={readOnly}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            setEditing((p) => ({ ...p, doc_number: Number.isFinite(n) ? n : entry.doc_number }));
          }}
          onBlur={commit}
          className="h-7 text-xs px-1 border-0 bg-transparent text-center w-14"
        />
      </td>
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
          <SelectTrigger className={cn("h-7 text-xs border bg-transparent", isUnclassified ? "bg-amber-100/60 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-bold border-amber-300 dark:border-amber-800 rounded px-2" : "border-transparent")}>
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
        <BRNumberInput
          value={v.credit}
          disabled={readOnly}
          onChange={(n) => setEditing((p) => ({ ...p, credit: n }))}
          onCommit={commit}
        />
      </td>
      <td className="num">
        <BRNumberInput
          value={v.debit}
          disabled={readOnly}
          onChange={(n) => setEditing((p) => ({ ...p, debit: n }))}
          onCommit={commit}
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
              if (entry.receipt_path) await deleteReceipt(entry.receipt_path, entry.id);
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

function BRNumberInput({ value, disabled, onChange, onCommit }: {
  value: number;
  disabled: boolean;
  onChange: (n: number) => void;
  onCommit: () => void;
}) {
  const format = (n: number) =>
    !n ? "" : new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  const parse = (s: string): number => {
    const cleaned = s.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  };
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState<string>(format(Number(value) || 0));
  const lastValueRef = (BRNumberInput as unknown as { _r?: WeakMap<object, number> });
  // Sync when external value changes and not focused
  const numValue = Number(value) || 0;
  React.useEffect(() => {
    if (!focused) setText(format(numValue));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numValue, focused]);
  void lastValueRef;

  return (
    <Input
      type="text"
      inputMode="decimal"
      value={text}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onChange={(e) => {
        const s = e.target.value;
        setText(s);
        onChange(parse(s));
      }}
      onBlur={() => {
        setFocused(false);
        const n = parse(text);
        setText(format(n));
        onCommit();
      }}
      className="h-7 text-xs text-right border-0 bg-transparent px-1 tabular-nums"
      placeholder="-"
    />
  );
}


function MonthReceiptControls({
  month,
  entries,
  opening,
  settings,
}: {
  month: { id: string; reference: string; year: number; month: number; closed: boolean; closed_at: string | null; notes: string | null; receipt_url?: string | null; receipt_path?: string | null };
  entries: Entry[];
  opening: number;
  settings: ReturnType<typeof useSettings>["data"];
}) {
  const [busy, setBusy] = useState<null | "upload" | "download" | "remove">(null);
  const hasReceipt = !!month.receipt_url;

  const handlePick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/pdf";
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
        toast.error("Envie um arquivo PDF.");
        return;
      }
      setBusy("upload");
      const tid = toast.loading("Enviando PDF de comprovantes...");
      try {
        await uploadMonthReceipt(f, month.id);
        toast.success("PDF de comprovantes anexado ao mês.", { id: tid });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Falha ao enviar PDF", { id: tid });
      } finally {
        setBusy(null);
      }
    };
    input.click();
  };

  const handleDownload = async () => {
    if (!settings) return;
    setBusy("download");
    const tid = toast.loading("Gerando capa + comprovantes...");
    try {
      await downloadMonthCoverWithReceipts(
        { month: month as any, entries, opening },
        settings,
        month.receipt_url ?? null,
      );
      toast.success("Download iniciado.", { id: tid });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao gerar PDF", { id: tid });
    } finally {
      setBusy(null);
    }
  };

  const handleRemove = async () => {
    if (!confirm("Remover o PDF de comprovantes anexado a este mês?")) return;
    setBusy("remove");
    try {
      await deleteMonthReceipt(month.id);
      toast.success("PDF de comprovantes removido.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao remover");
    } finally {
      setBusy(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={!!busy}>
          {busy ? (
            <><Loader2 className="size-4 mr-1 animate-spin" /> Processando...</>
          ) : (
            <><FileText className="size-4 mr-1" /> Comprovantes do mês{hasReceipt ? " ✓" : ""}</>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuItem onClick={handlePick} disabled={month.closed}>
          <div>
            <div className="font-medium">{hasReceipt ? "Substituir PDF anexado" : "Anexar PDF de comprovantes"}</div>
            <div className="text-xs text-muted-foreground">Notas fiscais e recibos digitalizados (até 50 MB)</div>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDownload}>
          <div>
            <div className="font-medium">Baixar capa + comprovantes</div>
            <div className="text-xs text-muted-foreground">Capa gerada + PDF anexado, mesclados</div>
          </div>
        </DropdownMenuItem>
        {hasReceipt && month.receipt_url && (
          <DropdownMenuItem onClick={() => window.open(month.receipt_url!, "_blank")}>
            <div>
              <div className="font-medium">Abrir só o PDF anexado</div>
              <div className="text-xs text-muted-foreground">Em nova aba</div>
            </div>
          </DropdownMenuItem>
        )}
        {hasReceipt && !month.closed && (
          <DropdownMenuItem onClick={handleRemove}>
            <div>
              <div className="font-medium text-destructive">Remover PDF anexado</div>
              <div className="text-xs text-muted-foreground">A capa continua disponível</div>
            </div>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
