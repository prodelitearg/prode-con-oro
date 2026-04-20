import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { MatchCard, type MatchData } from "@/components/prodelite/MatchCard";

export const Route = createFileRoute("/app/partidos")({
  head: () => ({
    meta: [
      { title: "Partidos — PRODELITE" },
      { name: "description", content: "Pronosticá los partidos de la fecha y ganá créditos." },
    ],
  }),
  component: PartidosPage,
});

interface MatchdayRow {
  id: string;
  number: number;
  starts_at: string;
  entry_cost: number;
  prize_pool: number;
  tournament_id: string;
  tournaments: { name: string } | null;
}

type MatchRow = MatchData & { matchday_id: string };

function PartidosPage() {
  const { user } = useAuth();
  const [matchdays, setMatchdays] = useState<MatchdayRow[]>([]);
  const [activeMd, setActiveMd] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [scores, setScores] = useState<Record<string, { h: string; a: string }>>({});
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingState, setSavingState] = useState(false);

  // Cargar matchdays
  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase
        .from("matchdays")
        .select("id,number,starts_at,entry_cost,prize_pool,tournament_id,tournaments(name)")
        .order("starts_at", { ascending: true });
      if (error) {
        toast.error("Error cargando fechas: " + error.message);
        return;
      }
      const mds = (data ?? []) as unknown as MatchdayRow[];
      setMatchdays(mds);
      if (mds.length && !activeMd) setActiveMd(mds[0].id);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cargar matches + predicciones del usuario al cambiar matchday
  useEffect(() => {
    if (!activeMd || !user) return;
    void (async () => {
      const [{ data: m }, { data: p }] = await Promise.all([
        supabase
          .from("matches")
          .select("id,home_team,home_short,home_color,away_team,away_short,away_color,matchday_id")
          .eq("matchday_id", activeMd)
          .order("kickoff", { ascending: true }),
        supabase
          .from("predictions")
          .select("match_id,home_score,away_score")
          .eq("user_id", user.id),
      ]);
      const ms = (m ?? []) as MatchRow[];
      setMatches(ms);
      const dict: Record<string, { h: string; a: string }> = {};
      for (const mt of ms) dict[mt.id] = { h: "", a: "" };
      for (const pred of (p ?? []) as { match_id: string; home_score: number; away_score: number }[]) {
        if (dict[pred.match_id]) {
          dict[pred.match_id] = { h: String(pred.home_score), a: String(pred.away_score) };
        }
      }
      setScores(dict);
    })();
  }, [activeMd, user]);

  const handleScore = (matchId: string, side: "h" | "a", value: string) => {
    setScores((p) => ({ ...p, [matchId]: { ...(p[matchId] ?? { h: "", a: "" }), [side]: value } }));
  };

  const handleSave = async () => {
    if (!user) return;
    const rows = matches
      .filter((m) => scores[m.id]?.h !== "" && scores[m.id]?.a !== "")
      .map((m) => ({
        user_id: user.id,
        match_id: m.id,
        home_score: Number(scores[m.id].h),
        away_score: Number(scores[m.id].a),
      }));
    if (rows.length === 0) {
      toast.error("Cargá al menos un pronóstico");
      return;
    }
    setSavingState(true);
    const { error } = await supabase.from("predictions").upsert(rows, { onConflict: "user_id,match_id" });
    setSavingState(false);
    if (error) {
      toast.error("Error guardando: " + error.message);
      return;
    }
    setSaved(true);
    toast.success(`${rows.length} pronóstico${rows.length === 1 ? "" : "s"} guardado${rows.length === 1 ? "" : "s"}`);
    setTimeout(() => setSaved(false), 2200);
  };

  const activeMatchday = matchdays.find((m) => m.id === activeMd);

  return (
    <div className="app-wrap">
      {/* Selector de fechas */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-3 -mx-4 px-4 bg-navy-2 border-b border-border/40">
        {loading && <div className="text-sm text-muted-foreground py-2">Cargando fechas…</div>}
        {matchdays.map((md) => {
          const date = new Date(md.starts_at);
          const day = String(date.getDate()).padStart(2, "0");
          const month = date.toLocaleDateString("es-AR", { month: "short" }).toUpperCase().replace(".", "");
          return (
            <button
              key={md.id}
              type="button"
              className={`date-pill ${activeMd === md.id ? "is-active" : ""}`}
              onClick={() => setActiveMd(md.id)}
            >
              <span className="text-lg font-extrabold leading-none">{day}</span>
              <span className="text-[0.55rem] font-bold tracking-[0.1em] mt-0.5">{month}</span>
              <span className="text-[0.55rem] font-bold tracking-[0.1em] mt-0.5 opacity-80">F{md.number}</span>
            </button>
          );
        })}
      </div>

      {/* Pozo */}
      {activeMatchday && (
        <div
          className="mt-3 mb-3 flex items-center justify-between rounded-xl border border-primary/25 px-4 py-3"
          style={{
            background:
              "linear-gradient(135deg, var(--card), var(--navy-deep))",
          }}
        >
          <div>
            <div className="text-[0.65rem] font-bold tracking-[0.18em] text-muted-foreground uppercase">
              Pozo acumulado
            </div>
            <div className="font-display text-xl font-extrabold text-primary leading-tight">
              {activeMatchday.prize_pool.toLocaleString("es-AR")} cr
            </div>
            <div className="text-[0.7rem] text-muted-foreground mt-0.5">
              {activeMatchday.tournaments?.name ?? "Torneo"} · Premio 1°: {Math.round(activeMatchday.prize_pool * 0.2).toLocaleString("es-AR")} cr
            </div>
          </div>
          <button type="button" className="btn-mini">
            Entrar · {activeMatchday.entry_cost} cr
          </button>
        </div>
      )}

      {/* Partidos */}
      <div className="mt-2">
        {matches.length === 0 && !loading && (
          <div className="card-base text-center text-sm text-muted-foreground">
            No hay partidos para esta fecha.
          </div>
        )}
        {matches.map((m, i) => (
          <MatchCard
            key={m.id}
            match={m}
            homeScore={scores[m.id]?.h ?? ""}
            awayScore={scores[m.id]?.a ?? ""}
            onChange={handleScore}
            highlight={i === 0}
          />
        ))}
      </div>

      {matches.length > 0 && (
        <button
          type="button"
          className={`save-fab ${saved ? "is-saved" : ""}`}
          onClick={handleSave}
          disabled={savingState}
        >
          {saved ? "✓ Guardado" : savingState ? "Guardando…" : "Guardar pronósticos"}
        </button>
      )}
    </div>
  );
}
