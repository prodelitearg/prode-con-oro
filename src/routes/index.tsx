import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/prodelite/Logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PRODELITE — Donde el fútbol tiene su recompensa" },
      {
        name: "description",
        content:
          "Pronosticá partidos de Argentina, Europa y Libertadores. Ganá créditos retirables por cada acierto y competí por el pozo de la fecha.",
      },
      { property: "og:title", content: "PRODELITE — Pronósticos deportivos" },
      {
        property: "og:description",
        content: "Donde el fútbol tiene su recompensa.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-10 text-center">
      <Logo size="xl" />
      <p className="mt-2 max-w-sm font-body text-base sm:text-lg text-muted-foreground tracking-wide">
        Donde el fútbol tiene su recompensa
      </p>

      <section
        aria-label="Estadísticas"
        className="mt-8 grid w-full max-w-sm grid-cols-3 gap-2.5"
      >
        {[
          { v: "2.400+", l: "Jugadores" },
          { v: "8", l: "Ligas" },
          { v: "$50", l: "Desde" },
        ].map((s) => (
          <div key={s.l} className="stat-box border-primary/15">
            <div className="font-display text-xl font-extrabold text-primary">{s.v}</div>
            <div className="font-display text-[0.6rem] font-semibold tracking-[0.15em] text-muted-foreground uppercase mt-0.5">
              {s.l}
            </div>
          </div>
        ))}
      </section>

      <ul className="mt-8 flex w-full max-w-sm flex-col gap-2.5 text-left">
        {[
          ["⚽", <>Pronosticá partidos de <strong className="text-foreground">Argentina, Europa y Libertadores</strong></>],
          ["💰", <>Ganá <strong className="text-foreground">créditos retirables</strong> por cada acierto</>],
          ["🏆", <>Competí por el <strong className="text-foreground">pozo de la fecha</strong></>],
          ["🔗", <>Referí amigos y ganá <strong className="text-foreground">créditos extra</strong></>],
        ].map(([icon, txt], i) => (
          <li key={i} className="card-base flex items-center gap-3 !py-3 !px-4">
            <span className="text-xl flex-shrink-0" aria-hidden>{icon}</span>
            <span className="font-body text-sm text-muted-foreground leading-tight">{txt}</span>
          </li>
        ))}
      </ul>

      <div className="mt-9 flex w-full max-w-sm flex-col gap-2.5">
        <Link to="/register" className="btn-gold inline-block text-center">
          Quiero jugar
        </Link>
        <Link to="/login" className="btn-outline inline-block text-center">
          Ya tengo cuenta
        </Link>
      </div>

      <p className="mt-5 text-xs text-muted-foreground">
        ¿Sos administrador?{" "}
        <Link to="/login-admin" className="text-primary font-bold hover:opacity-80">
          Ingresá acá
        </Link>
      </p>
    </main>
  );
}
