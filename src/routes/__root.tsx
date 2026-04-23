import { Outlet, Link, createRootRouteWithContext, HeadContent, Scripts } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { AuthProvider } from "@/contexts/AuthContext";

interface RouterContext {
  queryClient: QueryClient;
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-extrabold text-primary">404</h1>
        <h2 className="mt-4 font-display text-xl font-bold uppercase tracking-wider text-foreground">
          Página no encontrada
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          La ruta que buscás no existe o fue movida.
        </p>
        <div className="mt-6">
          <Link to="/" className="btn-gold !w-auto inline-block">
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#0B1630" },
      { title: "PRODELITE — Donde el fútbol tiene su recompensa" },
      {
        name: "description",
        content:
          "Pronosticá partidos, ganá créditos retirables y competí por el pozo de la fecha. Liga Profesional, Champions, Libertadores y más.",
      },
      { property: "og:title", content: "PRODELITE — Donde el fútbol tiene su recompensa" },
      {
        property: "og:description",
        content: "Donde el fútbol tiene su recompensa. Sumate a 2.400+ jugadores.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "PRODELITE — Donde el fútbol tiene su recompensa" },
      { name: "description", content: "Prode Elite is an app for predicting football match results and winning credits." },
      { property: "og:description", content: "Prode Elite is an app for predicting football match results and winning credits." },
      { name: "twitter:description", content: "Prode Elite is an app for predicting football match results and winning credits." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/312b2b6d-2f1d-4b5b-9777-1ec123c3f9a3/id-preview-652bf2c3--4ed8986a-fd2a-4a37-949f-7e9d10ad5c45.lovable.app-1776960308793.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/312b2b6d-2f1d-4b5b-9777-1ec123c3f9a3/id-preview-652bf2c3--4ed8986a-fd2a-4a37-949f-7e9d10ad5c45.lovable.app-1776960308793.png" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
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
      <AuthProvider>
        <Outlet />
        <Toaster theme="dark" position="top-center" richColors closeButton />
      </AuthProvider>
    </QueryClientProvider>
  );
}
