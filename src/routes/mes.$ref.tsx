import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { MonthPage } from "@/components/MonthPage";

export const Route = createFileRoute("/mes/$ref")({
  component: RouteComponent,
});

function RouteComponent() {
  const { ref } = Route.useParams();
  return (
    <AppShell>
      <MonthPage reference={ref} />
    </AppShell>
  );
}
