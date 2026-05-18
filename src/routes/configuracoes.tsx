import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { SettingsPage } from "@/components/SettingsPage";

export const Route = createFileRoute("/configuracoes")({
  component: () => (
    <AppShell>
      <SettingsPage />
    </AppShell>
  ),
});
