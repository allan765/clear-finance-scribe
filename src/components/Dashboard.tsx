import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useAllEntries, useMonths, useSettings } from "@/lib/data";
import { formatBRL, monthLabel, monthShort } from "@/lib/format";
import { labelOf } from "@/lib/classifications";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { TrendingUp, TrendingDown, Wallet, AlertCircle, Lock, FilePlus } from "lucide-react";

const PIE_COLORS = ["#2c3e6e", "#d4a84b", "#5a8a76", "#c8634a", "#7a5a9e", "#4a8aae", "#aa6c4c", "#6a8e3d", "#a44c6e", "#506a8a", "#8c8c8c"];

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
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.01 250)" />
                <XAxis dataKey="label" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => formatBRL(Number(v))} cursor={{ fill: "oklch(0.95 0.01 250)" }} />
                <Legend />
                <Bar dataKey="credit" name="Receitas" fill="#5a8a76" radius={[4, 4, 0, 0]} isAnimationActive={false} activeBar={false} />
                <Bar dataKey="debit" name="Despesas" fill="#c8634a" radius={[4, 4, 0, 0]} isAnimationActive={false} activeBar={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card border rounded p-4">
          <h2 className="font-serif font-semibold mb-3">Despesas por categoria</h2>
          <div className="h-64">
            {categoryData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                Nenhum lançamento classificado ainda.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={80} isAnimationActive={false} activeShape={false}>
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatBRL(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
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
