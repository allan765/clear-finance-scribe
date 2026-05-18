import { Link, useLocation } from "@tanstack/react-router";
import { AppSidebar, MobileMonthBar } from "./AppSidebar";
import { useSettings } from "@/lib/data";
import { LayoutDashboard, FileText, Settings as SettingsIcon, Menu } from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: settings } = useSettings();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b bg-card flex items-center px-4 gap-3">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button className="md:hidden p-2 -ml-2 rounded hover:bg-muted" aria-label="Menu">
                <Menu className="size-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72 bg-sidebar text-sidebar-foreground border-sidebar-border">
              <div className="px-5 py-5 border-b border-sidebar-border">
                <div className="font-serif text-lg font-bold">Prestação de Contas</div>
              </div>
              <nav className="px-3 py-3 space-y-1">
                <MobileNav to="/" icon={<LayoutDashboard className="size-4" />} label="Dashboard" active={location.pathname === "/"} onClick={() => setOpen(false)} />
                <MobileNav to="/relatorio" icon={<FileText className="size-4" />} label="Relatório final" active={location.pathname === "/relatorio"} onClick={() => setOpen(false)} />
                <MobileNav to="/configuracoes" icon={<SettingsIcon className="size-4" />} label="Configurações" active={location.pathname === "/configuracoes"} onClick={() => setOpen(false)} />
              </nav>
            </SheetContent>
          </Sheet>

          <div className="min-w-0">
            <div className="font-serif font-semibold text-sm md:text-base truncate">
              {settings?.identification ?? "Prestação de Contas"}
            </div>
            <div className="text-[11px] text-muted-foreground truncate">
              {settings?.responsible}
            </div>
          </div>
        </header>

        <MobileMonthBar />

        <main className="flex-1 min-w-0 overflow-x-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

function MobileNav({ to, icon, label, active, onClick }: { to: string; icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <Link
      to={to}
      onClick={onClick}
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
