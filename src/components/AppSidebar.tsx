import { Link, useLocation } from "@tanstack/react-router";
import { useMonths } from "@/lib/data";
import { monthShort, monthLabel } from "@/lib/format";
import { FileText, Settings as SettingsIcon, LayoutDashboard, Lock, CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export function AppSidebar() {
  const { data: months } = useMonths();
  const location = useLocation();

  return (
    <aside className="hidden md:flex w-64 shrink-0 bg-sidebar text-sidebar-foreground flex-col border-r border-sidebar-border">
      <div className="px-5 py-5 border-b border-sidebar-border">
        <div className="font-serif text-lg font-bold leading-tight">
          Prestação de Contas
        </div>
        <div className="text-xs text-sidebar-foreground/70 mt-1">
          Modelo Ministério Público
        </div>
      </div>

      <nav className="px-3 py-3 space-y-1">
        <SideLink to="/" icon={<LayoutDashboard className="size-4" />} label="Dashboard" active={location.pathname === "/"} />
        <SideLink to="/relatorio" icon={<FileText className="size-4" />} label="Relatório final" active={location.pathname === "/relatorio"} />
        <SideLink to="/configuracoes" icon={<SettingsIcon className="size-4" />} label="Configurações" active={location.pathname === "/configuracoes"} />
      </nav>

      <div className="px-5 pt-4 pb-2 text-[11px] uppercase tracking-wider text-sidebar-foreground/60">
        Meses do período
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
        {months?.map((m) => {
          const path = `/mes/${m.reference}`;
          const active = location.pathname === path;
          return (
            <Link
              key={m.id}
              to="/mes/$ref"
              params={{ ref: m.reference }}
              className={cn(
                "flex items-center justify-between gap-2 px-3 py-2 rounded text-sm transition-colors",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold"
                  : "hover:bg-sidebar-accent text-sidebar-foreground/90"
              )}
            >
              <span className="truncate">{monthLabel(m.reference)}</span>
              {m.closed ? (
                <Lock className="size-3.5 opacity-70" />
              ) : (
                <span className="text-[10px] opacity-50">{monthShort(m.reference)}</span>
              )}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}

function SideLink({ to, icon, label, active }: { to: string; icon: React.ReactNode; label: string; active: boolean }) {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded text-sm font-medium",
        active ? "bg-sidebar-primary text-sidebar-primary-foreground" : "hover:bg-sidebar-accent"
      )}
    >
      {icon}
      {label}
    </Link>
  );
}

export function MobileMonthBar() {
  const { data: months } = useMonths();
  const location = useLocation();
  return (
    <div className="md:hidden overflow-x-auto border-b bg-card">
      <div className="flex gap-1 px-2 py-2 min-w-max">
        {months?.map((m) => {
          const path = `/mes/${m.reference}`;
          const active = location.pathname === path;
          return (
            <Link
              key={m.id}
              to="/mes/$ref"
              params={{ ref: m.reference }}
              className={cn(
                "px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap border",
                active ? "bg-primary text-primary-foreground border-primary" : "bg-background text-foreground border-border"
              )}
            >
              {monthShort(m.reference)}
              {m.closed && <Lock className="inline-block size-3 ml-1 opacity-70" />}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
