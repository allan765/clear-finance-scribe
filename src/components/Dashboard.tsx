import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useAllEntries, useMonths, useSettings } from "@/lib/data";
import { formatBRL, monthLabel, monthShort } from "@/lib/format";
import { labelOf } from "@/lib/classifications";
import { TrendingUp, TrendingDown, Wallet, AlertCircle, Lock, FilePlus } from "lucide-react";

export function Dashboard() {
  const { data: months = [] } = useMonths();
  const { data: entries = [] } = useAllEntries();
  const { data: settings } = useSettings();

  const opening = Number(settings?.initial_balance ?? 0);

  const { totalCredit, totalDebit, balance, unclassified } = useMemo(() => {
    let c = 0, d = 0, u = 0;
    for (const e of entries) {
      c += Number(e.credit);
      d += Number(e.debit);
      if (e.classification === "nao_classificado") u++;
    }
    return { totalCredit: c, totalDebit: d, balance: opening + c - d, unclassified: u };
  }, [entries, opening]);

  const monthlyData = useMemo(() => {
    return months.map((m) => {
      const me = entries.filter((e) => e.month_id === m.id);
      return {
        ref: m.reference,
        label: monthShort(m.reference),
        credit: me.reduce((s, e) => s + Number(e.credit), 0),
        debit: me.reduce((s, e) => s + Number(e.debit), 0),
      };
    });
  }, [months, entries]);

  const monthlyMax = useMemo(() => {
    return monthlyData.reduce((max, item) => Math.max(max, item.credit, item.debit), 0);
  }, [monthlyData]);

  const categoryData = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of entries) {
      if (e.classification === "nao_classificado" || Number(e.debit) === 0) continue;
      const key = labelOf(e.classification);
      map.set(key, (map.get(key) ?? 0) + Number(e.debit));
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 11);
  }, [entries]);

  const categoryMax = useMemo(() => {
    return categoryData.reduce((max, item) => Math.max(max, item.value), 0);
  }, [categoryData]);

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h1 className="font-serif text-2xl md:text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Resumo geral da prestação de contas — {settings ? `${monthLabel(settings.period_start)} a ${monthLabel(settings.period_end)}` : ""}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <KPI label="Saldo inicial" value={formatBRL(opening)} icon={<Wallet className="size-5" />} tone="muted" />
        <KPI label="Total receitas" value={formatBRL(totalCredit)} icon={<TrendingUp className="size-5" />} tone="success" />
        <KPI label="Total despesas" value={formatBRL(totalDebit)} icon={<TrendingDown className="size-5" />} tone="destructive" />
        <KPI label="Saldo final" value={formatBRL(balance)} icon={<Wallet className="size-5" />} tone="primary" />
      </div>

      {unclassified > 0 && (
        <div className="flex items-start gap-3 p-4 rounded border border-warning/50 bg-warning/10 text-warning-foreground">
          <AlertCircle className="size-5 text-warning shrink-0 mt-0.5" />
          <div className="text-sm">
            <strong>{unclassified}</strong> lançamento(s) ainda sem classificação. Revise cada mês para deixar a prestação completa.
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border rounded p-4">
          <h2 className="font-serif font-semibold mb-3">Receitas vs Despesas por mês</h2>
          <div className="space-y-3">
            {monthlyData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
                Nenhum mês disponível ainda.
              </div>
            ) : (
              monthlyData.map((item) => (
                <div key={item.ref} className="grid gap-2 rounded border border-border p-3 md:grid-cols-[90px_1fr_112px] md:items-center">
                  <div className="text-sm font-medium text-foreground">{item.label}</div>
                  <div className="space-y-2">
                    <MetricBar
                      label="Receitas"
                      value={item.credit}
                      max={monthlyMax}
                      tone="success"
                    />
                    <MetricBar
                      label="Despesas"
                      value={item.debit}
                      max={monthlyMax}
                      tone="destructive"
                    />
                  </div>
                  <div className="text-right text-xs text-muted-foreground space-y-1">
                    <div>{formatBRL(item.credit)}</div>
                    <div>{formatBRL(item.debit)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-card border rounded p-4">
          <h2 className="font-serif font-semibold mb-3">Despesas por categoria</h2>
          <div className="space-y-3 min-h-64">
            {categoryData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
                Nenhum lançamento classificado ainda.
              </div>
            ) : (
              categoryData.map((item, index) => (
                <CategoryRow
                  key={item.name}
                  name={item.name}
                  value={item.value}
                  max={categoryMax}
                  tone={index % 4}
                />
              ))
            )}
          </div>
        </div>
      </div>

      <div className="bg-card border rounded">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h2 className="font-serif font-semibold">Meses do período</h2>
          <Link to="/relatorio" className="text-xs text-primary font-medium hover:underline">Ver relatório final →</Link>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 p-4">
          {months.map((m) => {
            const me = entries.filter((e) => e.month_id === m.id);
            const c = me.reduce((s, e) => s + Number(e.credit), 0);
            const d = me.reduce((s, e) => s + Number(e.debit), 0);
            return (
              <Link
                key={m.id}
                to="/mes/$ref"
                params={{ ref: m.reference }}
                className="block border rounded p-3 hover:border-primary hover:shadow-sm transition group"
              >
                <div className="flex items-center justify-between">
                  <div className="font-serif font-semibold text-foreground">{monthLabel(m.reference)}</div>
                  {m.closed ? (
                    <span className="text-[10px] flex items-center gap-1 bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded">
                      <Lock className="size-3" /> Fechado
                    </span>
                  ) : (
                    <span className="text-[10px] flex items-center gap-1 bg-accent text-accent-foreground px-1.5 py-0.5 rounded">
                      <FilePlus className="size-3" /> Aberto
                    </span>
                  )}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">{me.length} lançamento(s)</div>
                <div className="mt-2 flex justify-between text-xs">
                  <span className="text-success font-medium">{formatBRL(c)}</span>
                  <span className="text-destructive font-medium">{formatBRL(d)}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function KPI({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone: "primary" | "success" | "destructive" | "muted" }) {
  const toneClass = {
    primary: "bg-primary text-primary-foreground",
    success: "bg-success text-success-foreground",
    destructive: "bg-destructive text-destructive-foreground",
    muted: "bg-secondary text-secondary-foreground",
  }[tone];
  return (
    <div className="bg-card border rounded p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</div>
        <div className={`size-9 rounded flex items-center justify-center ${toneClass}`}>{icon}</div>
      </div>
      <div className="mt-2 font-serif text-xl md:text-2xl font-bold text-foreground tabular-nums">{value}</div>
    </div>
  );
}

function MetricBar({ label, value, max, tone }: { label: string; value: number; max: number; tone: "success" | "destructive" }) {
  const width = max > 0 ? Math.max((value / max) * 100, value > 0 ? 6 : 0) : 0;
  const fillClass = tone === "success" ? "bg-success" : "bg-destructive";

  return (
    <div className="grid grid-cols-[70px_1fr] items-center gap-2">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="h-2.5 rounded bg-muted overflow-hidden">
        <div className={`h-full rounded ${fillClass}`} style={{ width: `${Math.min(width, 100)}%` }} />
      </div>
    </div>
  );
}

function CategoryRow({ name, value, max, tone }: { name: string; value: number; max: number; tone: number }) {
  const width = max > 0 ? Math.max((value / max) * 100, 8) : 0;
  const fillClass = ["bg-primary", "bg-secondary", "bg-accent", "bg-muted-foreground"][tone] ?? "bg-primary";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="truncate text-foreground">{name}</span>
        <span className="shrink-0 text-muted-foreground">{formatBRL(value)}</span>
      </div>
      <div className="h-2.5 rounded bg-muted overflow-hidden">
        <div className={`h-full rounded ${fillClass}`} style={{ width: `${Math.min(width, 100)}%` }} />
      </div>
    </div>
  );
}
