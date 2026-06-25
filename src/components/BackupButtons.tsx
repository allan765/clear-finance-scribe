import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Download, Upload } from "lucide-react";
import { useAllEntries, useMonths, useRestoreBackup } from "@/lib/data";
import { toast } from "sonner";

export function BackupButtons() {
  const { data: entries = [] } = useAllEntries();
  const { data: months = [] } = useMonths();
  const restore = useRestoreBackup();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const payload = {
      exported_at: new Date().toISOString(),
      version: 1,
      months: months.map((m) => ({
        id: m.id,
        reference: m.reference,
        year: m.year,
        month: m.month,
        closed: m.closed,
        notes: m.notes,
      })),
      entries: entries.map((e) => ({
        id: e.id,
        month_id: e.month_id,
        doc_number: e.doc_number,
        entry_date: e.entry_date,
        description: e.description,
        classification: e.classification,
        credit: Number(e.credit),
        debit: Number(e.debit),
        notes: e.notes,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "prestacao-de-contas-backup.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success(`Backup exportado: ${payload.months.length} mes(es), ${payload.entries.length} lançamento(s).`);
  };

  const handleImport = async (file: File) => {
    const tid = toast.loading("Importando backup...");
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || !Array.isArray(parsed.months) || !Array.isArray(parsed.entries)) {
        throw new Error("Arquivo inválido: faltam 'months' ou 'entries'.");
      }
      const res = await restore.mutateAsync({
        months: parsed.months,
        entries: parsed.entries,
      });
      toast.success(
        `Importado: ${res.entriesUp} lançamento(s) atualizado(s)/criado(s), ${res.monthsUp} mês(es). Pendentes sem classificação: ${res.unclassified}.`,
        { id: tid }
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao importar backup", { id: tid });
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={handleExport}>
        <Download className="size-4 mr-1" /> Exportar backup (.json)
      </Button>
      <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={restore.isPending}>
        <Upload className="size-4 mr-1" /> Importar backup
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleImport(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
