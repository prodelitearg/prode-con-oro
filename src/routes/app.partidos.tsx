import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { MatchCard, type MatchData } from "@/components/prodelite/MatchCard";
import { BannerCarousel } from "@/components/prodelite/BannerCarousel";

export const Route = createFileRoute("/app/partidos")({
  head: () => ({
    meta: [
      { title: "Partidos — PRODELITE" },
      { name: "description", content: "Pronosticá los partidos de la fecha y ganá créditos." },
    ],
  }),
  component: PartidosPage,
});

interface TournamentRow {
  id: string;
  name: string;
}

interface MatchdayRow {
  id: string;
  number: number;
  starts_at: string;
  entry_cost: number;
  prize_pool: number;
  tournament_id: string;
}

type MatchRow = MatchData & { matchday_id: string };

function PartidosPage() {
  const { user } = useAuth();
  const [tournaments, setTournaments] = useState<TournamentRow[]>([]);
  const [activeTournament, setActiveTournament] = useState<string>("");
  const [matchdays, setMatchdays] = useState<MatchdayRow[]>([]);
  const [activeMd, setActiveMd] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [scores, setScores] = useState<Record<string, { h: string; a: string }>>({});
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingState, setSavingState] = useState(false);
  const [leagueChosen, setLeagueChosen] = useState(false);

  // Cargar torneos + matchdays una vez
  useEffect(() => {
    void (async () => {
      const [{ data: ts, error: et }, { data: mds, error: em }] = await Promise.all([
        supabase.from("tournaments").select("id,name").eq("is_active", true).order("name"),
        supabase
          .from("matchdays")
          .select("id,number,starts_at,entry_cost,prize_pool,tournament_id")
          .order("starts_at", { ascending: true }),
      ]);
      if (et) toast.error("Error cargando ligas: " + et.message);
      if (em) toast.error("Error cargando fechas: " + em.message);
      const tournamentsList = (ts ?? []) as TournamentRow[];
      setTournaments(tournamentsList);
      setMatchdays((mds ?? []) as MatchdayRow[]);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filtrar matchdays por liga activa y elegir la primera por defecto
  const filteredMatchdays = useMemo(
    () => (activeTournament ? matchdays.filter((m) => m.tournament_id === activeTournament) : []),
    [matchdays, activeTournament]
  );

  useEffect(() => {
    if (leagueChosen && filteredMatchdays.length > 0) {
      setActiveMd((curr) =>
        curr && filteredMatchdays.some((m) => m.id === curr) ? curr : filteredMatchdays[0].id
      );
    } else {
      setActiveMd(null);
      setMatches([]);
    }
  }, [filteredMatchdays, leagueChosen]);

  // Cargar matches + predicciones del usuario al cambiar matchday
  useEffect(() => {
    if (!activeMd || !user) return;
    void (async () => {
      const [{ data: m }, { data: p }] = await Promise.all([
        supabase
          .from("matches")
          .select("id,home_team,home_short,home_color,away_team,away_short,away_color,matchday_id,kickoff")
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

  const activeMatchday = filteredMatchdays.find((m) => m.id === activeMd);
  const activeTournamentName = tournaments.find((t) => t.id === activeTournament)?.name ?? "Liga";

  // Agrupar partidos por día
  const matchesByDay = useMemo(() => {
    const groups = new Map<string, { label: string; items: MatchRow[] }>();
    for (const m of matches) {
      const d = m.kickoff ? new Date(m.kickoff) : null;
      const key = d ? d.toISOString().slice(0, 10) : "sin-fecha";
      const label = d
        ? d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })
        : "Sin fecha";
      if (!groups.has(key)) groups.set(key, { label, items: [] });
      groups.get(key)!.items.push(m);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [matches]);

  return (
    <div className="app-wrap">
      {/* Hero carrusel publicitario */}
      <BannerCarousel />

      {/* Selector de liga */}
      <div className="mb-2">
        <label htmlFor="league" className="field-label">Liga</label>
        <select
          id="league"
          className="field-input"
          value={activeTournament}
          onChange={(e) => {
            setActiveTournament(e.target.value);
            setLeagueChosen(Boolean(e.target.value));
          }}
          disabled={loading || tournaments.length === 0}
        >
          <option value="">Seleccioná una liga…</option>
          {tournaments.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      {/* Estado vacío cuando no hay liga elegida */}
      {!leagueChosen && !loading && (
        <div className="league-empty-state">
          <span className="icon" aria-hidden>⚽</span>
          Elegí una liga arriba para ver los partidos disponibles.
        </div>
      )}

      {/* Selector de fechas */}
      {leagueChosen && filteredMatchdays.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-3 -mx-4 px-4 bg-navy-2 border-b border-border/40 matches-fade-in">
          {filteredMatchdays.map((md) => {
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
      )}

      {/* Pozo */}
      {leagueChosen && activeMatchday && (
        <div
          className="mt-3 mb-3 flex items-center justify-between rounded-xl border border-primary/25 px-4 py-3 matches-fade-in"
          style={{
            background: "linear-gradient(135deg, var(--card), var(--navy-deep))",
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
              {activeTournamentName} · Premio 1°: {Math.round(activeMatchday.prize_pool * 0.2).toLocaleString("es-AR")} cr
            </div>
          </div>
          <button type="button" className="btn-mini">
            Entrar · {activeMatchday.entry_cost} cr
          </button>
        </div>
      )}

      {/* Partidos */}
      {leagueChosen && (
      <div className="mt-2 matches-fade-in" key={activeMd ?? "none"}>
        {!loading && activeMd && matches.length === 0 && (
          <div className="card-base text-center text-sm text-muted-foreground py-6">
            Los partidos de esta fecha se cargarán próximamente ⚽
          </div>
        )}
        {matchesByDay.map(([key, group], gi) => (
          <div key={key} className="mb-3">
            <div className="day-header">
              {group.label}
            </div>
            {group.items.map((m, i) => (
              <MatchCard
                key={m.id}
                match={m}
                homeScore={scores[m.id]?.h ?? ""}
                awayScore={scores[m.id]?.a ?? ""}
                onChange={handleScore}
                highlight={gi === 0 && i === 0}
              />
            ))}
          </div>
        ))}
      </div>
      )}

      {leagueChosen && matches.length > 0 && (
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
