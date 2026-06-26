import { useMemo } from "react";
import { useAllEntries, useMonths, useSettings } from "@/lib/data";
import { exportFullPDF, exportExcel } from "@/lib/export";
import { Button } from "@/components/ui/button";
import { formatBRL, monthLabel } from "@/lib/format";
import { FileDown, FileSpreadsheet, BookOpen } from "lucide-react";
import { toast } from "sonner";

export function ReportPage() {
  const { data: months = [] } = useMonths();
  const { data: allEntries = [] } = useAllEntries();
  const { data: settings } = useSettings();

  const summary = useMemo(() => {
    const opening = Number(settings?.initial_balance ?? 0);
    let acc = opening;
    const rows = months.map((m) => {
      const me = allEntries.filter((e) => e.month_id === m.id);
      const c = me.reduce((s, e) => s + Number(e.credit), 0);
      const d = me.reduce((s, e) => s + Number(e.debit), 0);
      acc = acc + c - d;
      return {
        ref: m.reference,
        closed: m.closed,
        count: me.length,
        unclassified: me.filter((e) => e.classification === "nao_classificado").length,
        credit: c, debit: d, balance: acc,
      };
    });
    const totalC = rows.reduce((s, r) => s + r.credit, 0);
    const totalD = rows.reduce((s, r) => s + r.debit, 0);
    const totalU = rows.reduce((s, r) => s + r.unclassified, 0);
    return { opening, rows, totalC, totalD, totalU, finalBalance: opening + totalC - totalD };
  }, [months, allEntries, settings]);

  const buildMonthData = () =>
    months.map((m, i) => ({
      month: m,
      entries: allEntries.filter((e) => e.month_id === m.id),
      opening: i === 0 ? summary.opening : summary.rows[i - 1].balance,
      receiptUrl: m.receipt_url ?? null,
    }));

  const handlePDF = async () => {
    if (!settings) return;
    if (summary.totalU > 0) {
      if (!confirm(`Existem ${summary.totalU} lançamento(s) sem classificação. Gerar o PDF mesmo assim?`)) return;
    }
    const tid = toast.loading("Gerando PDF consolidado (incluindo comprovantes)...");
    try {
      await exportFullPDF(buildMonthData(), settings);
      toast.success("PDF gerado", { id: tid });
    } catch (e) {
      console.error(e);
      toast.error("Falha ao gerar PDF", { id: tid });
    }
  };

  const handleExcel = () => {
    if (!settings) return;
    exportExcel(buildMonthData(), settings);
    toast.success("Excel gerado");
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h1 className="font-serif text-2xl md:text-3xl font-bold flex items-center gap-2">
          <BookOpen className="size-7 text-primary" /> Relatório Final
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gere a prestação de contas consolidada do período {settings ? `${monthLabel(settings.period_start)} a ${monthLabel(settings.period_end)}` : ""}.
        </p>
      </div>

      <div className="bg-card border rounded p-4 md:p-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Saldo inicial" value={formatBRL(summary.opening)} />
        <Stat label="Total receitas" value={formatBRL(summary.totalC)} tone="success" />
        <Stat label="Total despesas" value={formatBRL(summary.totalD)} tone="destructive" />
        <Stat label="Saldo final" value={formatBRL(summary.finalBalance)} tone="primary" />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={handlePDF} size="lg">
          <FileDown className="size-4 mr-2" /> Gerar PDF final (com capa)
        </Button>
        <Button onClick={handleExcel} variant="secondary" size="lg">
          <FileSpreadsheet className="size-4 mr-2" /> Exportar Excel
        </Button>
      </div>

      {summary.totalU > 0 && (
        <div className="p-3 rounded bg-warning/10 border border-warning/40 text-sm">
          ⚠ {summary.totalU} lançamento(s) ainda não classificado(s) no período.
        </div>
      )}

      <div className="bg-card border rounded overflow-x-auto">
        <table className="official-table">
          <thead>
            <tr>
              <th>Mês</th>
              <th>Status</th>
              <th>Lançamentos</th>
              <th>Não classificados</th>
              <th>Receitas (R$)</th>
              <th>Despesas (R$)</th>
              <th>Saldo acumulado</th>
            </tr>
          </thead>
          <tbody>
            {summary.rows.map((r) => (
              <tr key={r.ref}>
                <td className="font-medium">{monthLabel(r.ref)}</td>
                <td className="center">
                  <span className={`text-[11px] px-1.5 py-0.5 rounded ${r.closed ? "bg-success/15 text-success" : "bg-accent text-accent-foreground"}`}>
                    {r.closed ? "Fechado" : "Aberto"}
                  </span>
                </td>
                <td className="center">{r.count}</td>
                <td className="center">
                  {r.unclassified > 0 ? <span className="text-warning font-semibold">{r.unclassified}</span> : "-"}
                </td>
                <td className="num">{formatBRL(r.credit)}</td>
                <td className="num">{formatBRL(r.debit)}</td>
                <td className="num font-semibold">{formatBRL(r.balance)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} className="text-right">TOTAIS DO PERÍODO</td>
              <td className="num">{formatBRL(summary.totalC)}</td>
              <td className="num">{formatBRL(summary.totalD)}</td>
              <td className="num">{formatBRL(summary.finalBalance)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "success" | "destructive" | "primary" }) {
  const c = {
    success: "text-success",
    destructive: "text-destructive",
    primary: "text-primary",
    undefined: "text-foreground",
  }[tone ?? "undefined"];
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`font-serif text-xl md:text-2xl font-bold tabular-nums mt-1 ${c}`}>{value}</div>
    </div>
  );
}
