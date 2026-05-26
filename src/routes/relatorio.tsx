import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ReportPage } from "@/components/ReportPage";

export const Route = createFileRoute("/relatorio")({
  component: () => (
    <AppShell>
      <ReportPage />
    </AppShell>
  ),
});
