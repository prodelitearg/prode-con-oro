import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/app/historial")({
  head: () => ({
    meta: [
      { title: "Mis Pronósticos — PRODELITE" },
      { name: "description", content: "Historial completo de tus fechas jugadas, aciertos y créditos." },
    ],
  }),
  component: HistorialPage,
});

interface EntryRow {
  matchday_id: string;
  paid_credits: number;
  created_at: string;
}

interface MatchdayRow {
  id: string;
  number: number;
  starts_at: string;
  closed_at: string | null;
  tournament_id: string;
}

interface TournamentRow {
  id: string;
  name: string;
}

interface MatchRow {
  id: string;
  matchday_id: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
  kickoff: string;
}

interface PredictionRow {
  match_id: string;
  home_score: number;
  away_score: number;
  points: number;
}

type StatusFilter = "all" | "pending" | "finished";

function HistorialPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [matchdays, setMatchdays] = useState<MatchdayRow[]>([]);
  const [tournaments, setTournaments] = useState<TournamentRow[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [predictions, setPredictions] = useState<PredictionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tournamentFilter, setTournamentFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data: ents } = await supabase
        .from("matchday_entries")
        .select("matchday_id, paid_credits, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      const entryRows = (ents ?? []) as EntryRow[];
      setEntries(entryRows);

      const mdIds = entryRows.map((e) => e.matchday_id);
      if (mdIds.length === 0) {
        setLoading(false);
        return;
      }

      const [{ data: mds }, { data: mts }, { data: preds }] = await Promise.all([
        supabase
          .from("matchdays")
          .select("id, number, starts_at, closed_at, tournament_id")
          .in("id", mdIds),
        supabase
          .from("matches")
          .select("id, matchday_id, home_team, away_team, home_score, away_score, status, kickoff")
          .in("matchday_id", mdIds)
          .order("kickoff", { ascending: true }),
        supabase
          .from("predictions")
          .select("match_id, home_score, away_score, points")
          .eq("user_id", user.id),
      ]);
      const mdRows = (mds ?? []) as MatchdayRow[];
      setMatchdays(mdRows);
      setMatches((mts ?? []) as MatchRow[]);
      setPredictions((preds ?? []) as PredictionRow[]);

      const tIds = Array.from(new Set(mdRows.map((m) => m.tournament_id)));
      if (tIds.length > 0) {
        const { data: ts } = await supabase
          .from("tournaments")
          .select("id, name")
          .in("id", tIds);
        setTournaments((ts ?? []) as TournamentRow[]);
      }

      setLoading(false);
    })();
  }, [user]);

  const mdMap = useMemo(() => new Map(matchdays.map((m) => [m.id, m])), [matchdays]);
  const tMap = useMemo(() => new Map(tournaments.map((t) => [t.id, t])), [tournaments]);
  const predMap = useMemo(() => new Map(predictions.map((p) => [p.match_id, p])), [predictions]);

  // Calcular ganancias por fecha (suma de créditos por aciertos)
  const winningsByMatchday = useMemo(() => {
    const map = new Map<string, { won: number; exact: number; winner: number; failed: number; played: number }>();
    for (const md of matchdays) map.set(md.id, { won: 0, exact: 0, winner: 0, failed: 0, played: 0 });
    for (const m of matches) {
      const p = predMap.get(m.id);
      if (!p) continue;
      const stats = map.get(m.matchday_id);
      if (!stats) continue;
      stats.played += 1;
      if (m.status === "finished") {
        if (p.points === 3) {
          stats.exact += 1;
          stats.won += 3;
        } else if (p.points === 1) {
          stats.winner += 1;
          stats.won += 1;
        } else {
          stats.failed += 1;
        }
      }
    }
    return map;
  }, [matchdays, matches, predMap]);

  const decoratedEntries = useMemo(() => {
    return entries.map((e) => {
      const md = mdMap.get(e.matchday_id);
      const t = md ? tMap.get(md.tournament_id) : undefined;
      const stats = winningsByMatchday.get(e.matchday_id) ?? {
        won: 0, exact: 0, winner: 0, failed: 0, played: 0,
      };
      const status: "pending" | "finished" | "in-progress" = !md
        ? "pending"
        : md.closed_at
        ? "finished"
        : "in-progress";
      return { entry: e, md, tournament: t, stats, status };
    });
  }, [entries, mdMap, tMap, winningsByMatchday]);

  const filtered = useMemo(() => {
    return decoratedEntries.filter((d) => {
      if (tournamentFilter !== "all" && d.md?.tournament_id !== tournamentFilter) return false;
      if (statusFilter === "pending" && d.status === "finished") return false;
      if (statusFilter === "finished" && d.status !== "finished") return false;
      return true;
    });
  }, [decoratedEntries, tournamentFilter, statusFilter]);

  // Resumen general (sobre todas las fechas, sin filtro)
  const summary = useMemo(() => {
    let played = 0;
    let spent = 0;
    let won = 0;
    let totalPredictions = 0;
    let exactHits = 0;
    let winnerHits = 0;
    for (const d of decoratedEntries) {
      played += 1;
      spent += d.entry.paid_credits;
      won += d.stats.won;
      totalPredictions += d.stats.exact + d.stats.winner + d.stats.failed;
      exactHits += d.stats.exact;
      winnerHits += d.stats.winner;
    }
    const exactPct = totalPredictions > 0 ? Math.round((exactHits / totalPredictions) * 100) : 0;
    const winnerPct = totalPredictions > 0 ? Math.round((winnerHits / totalPredictions) * 100) : 0;
    return { played, spent, won, balance: won - spent, exactPct, winnerPct };
  }, [decoratedEntries]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const fmtDate = (iso?: string) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
  };

  return (
    <div className="app-wrap">
      <h1 className="font-display text-xl font-extrabold tracking-wider uppercase">Mis Pronósticos</h1>
      <p className="text-xs text-muted-foreground mt-1">Historial completo de tus fechas jugadas.</p>

      {/* Resumen general */}
      <div className="card-elevated mt-3">
        <div className="grid grid-cols-3 gap-2.5">
          <div className="stat-box">
            <div className="font-display text-xl font-extrabold text-primary">{summary.played}</div>
            <div className="text-[0.6rem] tracking-[0.15em] text-muted-foreground uppercase mt-0.5">Fechas</div>
          </div>
          <div className="stat-box">
            <div className="font-display text-xl font-extrabold text-foreground">-{summary.spent}</div>
            <div className="text-[0.6rem] tracking-[0.15em] text-muted-foreground uppercase mt-0.5">Gastado</div>
          </div>
          <div className="stat-box">
            <div className="font-display text-xl font-extrabold text-success">+{summary.won}</div>
            <div className="text-[0.6rem] tracking-[0.15em] text-muted-foreground uppercase mt-0.5">Ganado</div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2.5">
          <div className="stat-box">
            <div className={`font-display text-lg font-extrabold ${summary.balance >= 0 ? "text-success" : "text-destructive"}`}>
              {summary.balance >= 0 ? "+" : ""}{summary.balance} cr
            </div>
            <div className="text-[0.6rem] tracking-[0.15em] text-muted-foreground uppercase mt-0.5">Balance</div>
          </div>
          <div className="stat-box">
            <div className="font-display text-lg font-extrabold text-primary">{summary.exactPct}%</div>
            <div className="text-[0.6rem] tracking-[0.15em] text-muted-foreground uppercase mt-0.5">Exactos</div>
          </div>
          <div className="stat-box">
            <div className="font-display text-lg font-extrabold text-primary">{summary.winnerPct}%</div>
            <div className="text-[0.6rem] tracking-[0.15em] text-muted-foreground uppercase mt-0.5">Ganador</div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-2 gap-2 mt-3">
        <div>
          <label className="field-label">Liga</label>
          <select
            className="field-input"
            value={tournamentFilter}
            onChange={(e) => setTournamentFilter(e.target.value)}
          >
            <option value="all">Todas</option>
            {tournaments.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">Estado</label>
          <select
            className="field-input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          >
            <option value="all">Todos</option>
            <option value="pending">Pendientes</option>
            <option value="finished">Finalizados</option>
          </select>
        </div>
      </div>

      {/* Lista */}
      <div className="mt-4">
        {loading && <div className="text-sm text-muted-foreground">Cargando historial…</div>}

        {!loading && filtered.length === 0 && (
          <div className="card-base text-center !py-6">
            <div className="text-3xl mb-2">📊</div>
            <div className="text-sm text-muted-foreground">
              {entries.length === 0
                ? "Aún no jugaste ninguna fecha. Pagá una entrada en Partidos para empezar."
                : "No hay fechas que coincidan con los filtros."}
            </div>
          </div>
        )}

        {!loading && filtered.map((d) => {
          const id = d.entry.matchday_id;
          const liga = d.tournament?.name ?? "—";
          const balance = d.stats.won - d.entry.paid_credits;
          const statusLabel =
            d.status === "finished" ? "Finalizada" : d.status === "in-progress" ? "En curso" : "Pendiente";
          const statusClass =
            d.status === "finished" ? "tag-success" : d.status === "in-progress" ? "tag-info" : "tag";
          const open = expanded.has(id);
          const mdMatches = matches.filter((m) => m.matchday_id === id);

          return (
            <div key={id} className="card-base !py-3 mb-2">
              <button
                type="button"
                onClick={() => toggle(id)}
                className="w-full text-left"
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <div className="text-[0.65rem] tracking-[0.15em] text-muted-foreground uppercase font-semibold truncate">
                      {liga}
                    </div>
                    <div className="text-sm font-bold text-foreground mt-0.5">
                      Fecha {d.md?.number ?? "?"}
                    </div>
                    <div className="text-[0.65rem] text-muted-foreground mt-0.5">
                      Jugada {fmtDate(d.entry.created_at)}
                    </div>
                    <span className={`tag ${statusClass} mt-2 inline-block`}>{statusLabel}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[0.6rem] text-muted-foreground uppercase tracking-[0.12em]">Balance</div>
                    <div className={`font-display text-lg font-extrabold ${balance >= 0 ? "text-success" : "text-destructive"}`}>
                      {balance >= 0 ? "+" : ""}{balance} cr
                    </div>
                    <div className="text-[0.6rem] text-muted-foreground mt-0.5">
                      -{d.entry.paid_credits} / +{d.stats.won}
                    </div>
                  </div>
                </div>
              </button>

              {open && (
                <div className="mt-3 pt-3 border-t border-border/40 space-y-2">
                  {mdMatches.length === 0 && (
                    <div className="text-xs text-muted-foreground">Sin partidos cargados aún.</div>
                  )}
                  {mdMatches.map((m) => {
                    const p = predMap.get(m.id);
                    const finished = m.status === "finished" && m.home_score !== null && m.away_score !== null;
                    let resultLabel = "—";
                    let resultClass = "text-muted-foreground";
                    if (finished) {
                      if (!p) {
                        resultLabel = "Sin pronóstico";
                      } else if (p.points === 3) {
                        resultLabel = "✅ Exacto +3 cr";
                        resultClass = "text-success";
                      } else if (p.points === 1) {
                        resultLabel = "⚽ Ganador +1 cr";
                        resultClass = "text-primary";
                      } else {
                        resultLabel = "❌ Falló";
                        resultClass = "text-destructive";
                      }
                    }
                    return (
                      <div
                        key={m.id}
                        className="rounded-lg px-3 py-2"
                        style={{ background: "oklch(0.22 0.03 250 / 0.5)", border: "1px solid oklch(0.30 0.03 250 / 0.4)" }}
                      >
                        <div className="flex justify-between items-center gap-2">
                          <div className="text-xs font-bold text-foreground truncate">
                            {m.home_team} <span className="text-muted-foreground">vs</span> {m.away_team}
                          </div>
                        </div>
                        <div className="mt-1 grid grid-cols-2 gap-2 text-[0.7rem]">
                          <div>
                            <span className="text-muted-foreground">Mi pronóstico:</span>{" "}
                            <span className="font-bold text-foreground">
                              {p ? `${p.home_score} - ${p.away_score}` : "—"}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Resultado:</span>{" "}
                            <span className="font-bold text-foreground">
                              {finished ? `${m.home_score} - ${m.away_score}` : "Pendiente"}
                            </span>
                          </div>
                        </div>
                        <div className={`mt-1 text-[0.7rem] font-semibold ${resultClass}`}>
                          {resultLabel}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}