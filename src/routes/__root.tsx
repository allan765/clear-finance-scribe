import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Prestação de Contas — Modelo MP" },
      { name: "description", content: "Sistema de prestação de contas mensal com layout institucional, exportação em PDF e Excel." },
      { property: "og:title", content: "Prestação de Contas — Modelo MP" },
      { name: "twitter:title", content: "Prestação de Contas — Modelo MP" },
      { property: "og:description", content: "Sistema de prestação de contas mensal com layout institucional, exportação em PDF e Excel." },
      { name: "twitter:description", content: "Sistema de prestação de contas mensal com layout institucional, exportação em PDF e Excel." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/916c4b48-ce8b-48ab-961b-75d26f68b06d/id-preview-50ae65c3--973a4e27-78f5-4926-880d-52216d427987.lovable.app-1779125257239.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/916c4b48-ce8b-48ab-961b-75d26f68b06d/id-preview-50ae65c3--973a4e27-78f5-4926-880d-52216d427987.lovable.app-1779125257239.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Source+Serif+4:wght@600;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-3xl font-serif font-bold">Página não encontrada</h1>
        <a href="/" className="text-primary mt-4 inline-block underline">Voltar ao início</a>
      </div>
    </div>
  ),
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
