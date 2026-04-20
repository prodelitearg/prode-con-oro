import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/app/tabla")({
  head: () => ({
    meta: [
      { title: "Tabla de posiciones — PRODELITE" },
      { name: "description", content: "Mirá tu posición en el ranking de jugadores." },
    ],
  }),
  component: TablaPage,
});

// Datos demo hasta que el cálculo de puntos esté en producción.
const DEMO_TABLA = [
  { p: 1, i: "MR", n: "Marcos R.", pj: 14, pts: 148 },
  { p: 2, i: "JP", n: "Juan P.", pj: 14, pts: 131 },
  { p: 3, i: "CL", n: "Claudia L.", pj: 13, pts: 119 },
  { p: 4, i: "AG", n: "Andrés G.", pj: 14, pts: 114 },
  { p: 5, i: "SM", n: "Silvana M.", pj: 12, pts: 108 },
  { p: 7, i: "JG", n: "Vos", pj: 14, pts: 104, me: true },
  { p: 8, i: "PB", n: "Pablo B.", pj: 13, pts: 98 },
];

function TablaPage() {
  const { profile } = useAuth();
  const initials = ((profile?.nombre?.[0] ?? "") + (profile?.apellido?.[0] ?? "")).toUpperCase() || "JG";

  return (
    <div className="app-wrap">
      <div className="card-base mb-4 text-sm text-muted-foreground">
        <span className="text-foreground font-semibold">Estás en el puesto 7</span> — te faltan 4 puntos para el top 5.
      </div>

      <div className="section-label">Tabla de posiciones</div>

      <div className="card-base !p-0 overflow-hidden">
        <div className="grid grid-cols-[40px_1fr_40px_56px] px-4 py-2.5 border-b border-border/60">
          <div className="text-[0.65rem] font-bold tracking-[0.18em] text-muted-foreground uppercase text-center">Pos</div>
          <div className="text-[0.65rem] font-bold tracking-[0.18em] text-muted-foreground uppercase">Usuario</div>
          <div className="text-[0.65rem] font-bold tracking-[0.18em] text-muted-foreground uppercase text-center">PJ</div>
          <div className="text-[0.65rem] font-bold tracking-[0.18em] text-muted-foreground uppercase text-center">Pts</div>
        </div>
        {DEMO_TABLA.map((r) => {
          const isGold = r.p === 1;
          const isMe = r.me;
          return (
            <div
              key={r.p}
              className="grid grid-cols-[40px_1fr_40px_56px] px-4 py-2.5 items-center border-b border-border/40 last:border-b-0"
              style={{
                background: isGold
                  ? "linear-gradient(90deg, oklch(0.80 0.155 88 / 0.10) 0%, transparent 70%)"
                  : isMe
                  ? "oklch(0.72 0.18 145 / 0.06)"
                  : undefined,
                borderLeft: isMe ? "3px solid var(--success)" : undefined,
              }}
            >
              <div className="flex justify-center">
                <span
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold"
                  style={{
                    background: isGold ? "var(--primary)" : isMe ? "var(--success)" : "oklch(1 0 0 / 0.06)",
                    color: isGold ? "var(--primary-foreground)" : isMe ? "white" : "var(--muted-foreground)",
                  }}
                >
                  {r.p}
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[0.65rem] font-bold"
                  style={{
                    background: "oklch(1 0 0 / 0.07)",
                    color: isGold ? "var(--primary)" : isMe ? "var(--success)" : "var(--muted-foreground)",
                    border: isGold
                      ? "2px solid var(--primary)"
                      : isMe
                      ? "2px solid var(--success)"
                      : "none",
                  }}
                >
                  {isMe ? initials : r.i}
                </div>
                <span
                  className="text-sm font-bold"
                  style={{
                    color: isGold ? "var(--primary)" : isMe ? "var(--success)" : "var(--foreground)",
                  }}
                >
                  {r.n}
                </span>
              </div>
              <div className="text-center text-xs font-semibold text-muted-foreground">{r.pj}</div>
              <div
                className="text-center text-sm font-extrabold"
                style={{ color: isGold ? "var(--primary)" : "var(--foreground)" }}
              >
                {r.pts}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-muted-foreground text-center">
        Pronto: ranking en vivo basado en tus aciertos reales.
      </p>
    </div>
  );
}
