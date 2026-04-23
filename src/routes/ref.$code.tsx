import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/ref/$code")({
  head: ({ params }) => ({
    meta: [
      { title: "Sumate a PRODELITE — Pronósticos deportivos" },
      {
        name: "description",
        content:
          "Te invitaron a PRODELITE. Registrate y empezá a pronosticar partidos para ganar créditos retirables.",
      },
      { property: "og:title", content: "Sumate a PRODELITE" },
      {
        property: "og:description",
        content: "Donde el fútbol tiene su recompensa. Usá el código " + params.code + " al registrarte.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/register",
      search: { ref: params.code } as never,
    });
  },
});
