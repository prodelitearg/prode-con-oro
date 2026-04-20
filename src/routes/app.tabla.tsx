import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app/tabla")({
  head: () => ({
    meta: [
      { title: "Tabla de posiciones — PRODELITE" },
      { name: "description", content: "Mirá tu posición en el ranking de jugadores." },
    ],
  }),
  component: TablaPage,
});

interface TournamentRow { id: string; name: string }
interface LeaderRow {
  user_id: string;
  display_name: string;
  played: number;
  exact_hits: number;
  total_points: number;
  accuracy: number;
}

function TablaPage() {
  const { user, profile } = useAuth();
  const [tournaments, setTournaments] = useState<TournamentRow[]>([]);
  const [activeTour, setActiveTour] = useState<string>("");
  const [rows, setRows] = useState<LeaderRow[]>([]);
  const [loading, setLoading] = useState(true);

  const myInitials = ((profile?.nombre?.[0] ?? "") + (profile?.apellido?.[0] ?? "")).toUpperCase() || "JG";

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase
        .from("tournaments")
        .select("id,name")
        .eq("is_active", true)
        .order("name");
      if (error) {
        toast.error("Error cargando ligas: " + error.message);
        setLoading(false);
        return;
      }
      const list = (data ?? []) as TournamentRow[];
      setTournaments(list);
      if (list.length) setActiveTour(list[0].id);
      else setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!activeTour) return;
    setLoading(true);
    void (async () => {
      // RPC no está en types generados → cast suelto
      const client = supabase as unknown as {
        rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: LeaderRow[] | null; error: { message: string } | null }>;
      };
      const { data, error } = await client.rpc("tournament_leaderboard", { _tournament_id: activeTour });
      if (error) {
        toast.error("Error cargando tabla: " + error.message);
        setRows([]);
      } else {
        setRows(data ?? []);
      }
      setLoading(false);
    })();
  }, [activeTour]);

  const myRow = useMemo(() => {
    const idx = rows.findIndex((r) => r.user_id === user?.id);
    return idx >= 0 ? { ...rows[idx], position: idx + 1 } : null;
  }, [rows, user?.id]);

  const top5Cut = rows[4]?.total_points ?? 0;
  const pointsToTop5 = myRow && myRow.position > 5 ? Math.max(0, top5Cut - myRow.total_points + 1) : 0;

  return (
    <div className="app-wrap">
      <div className="mb-3">
        <label htmlFor="tour" className="field-label">Liga</label>
        <select
          id="tour"
          className="field-input"
          value={activeTour}
          onChange={(e) => setActiveTour(e.target.value)}
          disabled={loading || tournaments.length === 0}
        >
          {tournaments.length === 0 && <option value="">No hay ligas</option>}
          {tournaments.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      {myRow ? (
        <div className="card-base mb-4 text-sm text-muted-foreground">
          <span className="text-foreground font-semibold">Estás en el puesto {myRow.position}</span>
          {pointsToTop5 > 0
            ? ` — te faltan ${pointsToTop5} pt${pointsToTop5 === 1 ? "" : "s"} para el top 5.`
            : myRow.position <= 5
            ? " — ¡seguí así, estás en el top 5!"
            : "."}
        </div>
      ) : !loading && rows.length > 0 ? (
        <div className="card-base mb-4 text-sm text-muted-foreground">
          Todavía no jugaste partidos puntuados en esta liga.
        </div>
      ) : null}

      <div className="section-label">Tabla de posiciones</div>

      {loading ? (
        <div className="card-base text-center text-sm text-muted-foreground py-6">
          Cargando ranking…
        </div>
      ) : rows.length === 0 ? (
        <div className="card-base text-center text-sm text-muted-foreground py-6">
          Aún no hay resultados cargados en esta liga ⚽
        </div>
      ) : (
        <div className="card-base !p-0 overflow-hidden">
          <div className="grid grid-cols-[40px_1fr_44px_44px_56px] px-4 py-2.5 border-b border-border/60">
            <div className="text-[0.65rem] font-bold tracking-[0.18em] text-muted-foreground uppercase text-center">Pos</div>
            <div className="text-[0.65rem] font-bold tracking-[0.18em] text-muted-foreground uppercase">Usuario</div>
            <div className="text-[0.65rem] font-bold tracking-[0.18em] text-muted-foreground uppercase text-center">PJ</div>
            <div className="text-[0.65rem] font-bold tracking-[0.18em] text-muted-foreground uppercase text-center">%</div>
            <div className="text-[0.65rem] font-bold tracking-[0.18em] text-muted-foreground uppercase text-center">Pts</div>
          </div>
          {rows.map((r, idx) => {
            const pos = idx + 1;
            const isGold = pos === 1;
            const isMe = r.user_id === user?.id;
            const initials = r.display_name
              .split(" ")
              .map((s) => s[0])
              .filter(Boolean)
              .slice(0, 2)
              .join("")
              .toUpperCase() || "??";
            return (
              <div
                key={r.user_id}
                className="grid grid-cols-[40px_1fr_44px_44px_56px] px-4 py-2.5 items-center border-b border-border/40 last:border-b-0"
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
                    {pos}
                  </span>
                </div>
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[0.65rem] font-bold shrink-0"
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
                    {isMe ? myInitials : initials}
                  </div>
                  <span
                    className="text-sm font-bold truncate"
                    style={{
                      color: isGold ? "var(--primary)" : isMe ? "var(--success)" : "var(--foreground)",
                    }}
                  >
                    {isMe ? "Vos" : r.display_name}
                  </span>
                </div>
                <div className="text-center text-xs font-semibold text-muted-foreground">{r.played}</div>
                <div className="text-center text-xs font-semibold text-muted-foreground">{r.accuracy}%</div>
                <div
                  className="text-center text-sm font-extrabold"
                  style={{ color: isGold ? "var(--primary)" : "var(--foreground)" }}
                >
                  {r.total_points}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
