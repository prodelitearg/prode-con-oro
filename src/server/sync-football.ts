import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const API_BASE = "https://v3.football.api-sports.io";

interface ApiFixture {
  fixture: {
    id: number;
    date: string;
    status: { short: string };
  };
  league: {
    id: number;
    season: number;
    round: string;
  };
  teams: {
    home: { id: number; name: string };
    away: { id: number; name: string };
  };
  goals: { home: number | null; away: number | null };
}

function shortCode(name: string): string {
  const clean = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z\s]/g, "")
    .trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "TBD";
  if (words.length === 1) return words[0].slice(0, 4).toUpperCase();
  return words
    .slice(0, 4)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function colorFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const palette = [
    "#1e40af", "#b91c1c", "#15803d", "#7c2d12", "#581c87",
    "#0f766e", "#1e293b", "#9a3412", "#0c4a6e", "#365314",
  ];
  return palette[Math.abs(hash) % palette.length];
}

function extractRoundNumber(round: string): number {
  // "Regular Season - 14" → 14, "Round of 16" → 16, etc.
  const m = round.match(/(\d+)/);
  return m ? Number(m[1]) : 1;
}

const Input = z.object({
  tournamentId: z.string().uuid(),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  season: z.number().int().min(2000).max(2100),
  entryCost: z.number().int().min(0).max(10000).default(30),
});

export const syncMatchdayFromApi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const apiKey = process.env.API_FOOTBALL_KEY;
    if (!apiKey) {
      return { ok: false as const, error: "API_FOOTBALL_KEY no configurada" };
    }

    // Verify superadmin
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isSuper = (roles ?? []).some((r) => r.role === "superadmin");
    if (!isSuper) return { ok: false as const, error: "Solo superadmin" };

    // Get tournament + external_id
    const { data: tournament, error: tErr } = await supabaseAdmin
      .from("tournaments")
      .select("id, name, external_id")
      .eq("id", data.tournamentId)
      .maybeSingle();
    if (tErr || !tournament) {
      return { ok: false as const, error: "Torneo no encontrado" };
    }
    if (!tournament.external_id) {
      return { ok: false as const, error: "Este torneo no tiene API vinculada (es manual)" };
    }

    // Fetch fixtures from API-Football
    const url = `${API_BASE}/fixtures?league=${tournament.external_id}&season=${data.season}&from=${data.fromDate}&to=${data.toDate}`;
    const apiRes = await fetch(url, {
      headers: { "x-apisports-key": apiKey },
    });
    if (!apiRes.ok) {
      const body = await apiRes.text();
      return { ok: false as const, error: `API error ${apiRes.status}: ${body.slice(0, 200)}` };
    }
    const apiJson = (await apiRes.json()) as { response: ApiFixture[]; errors?: unknown };
    const fixtures = apiJson.response ?? [];

    if (fixtures.length === 0) {
      return { ok: false as const, error: "No se encontraron partidos en ese rango" };
    }

    // Group by round (matchday number)
    const byRound = new Map<number, ApiFixture[]>();
    for (const f of fixtures) {
      const n = extractRoundNumber(f.league.round);
      if (!byRound.has(n)) byRound.set(n, []);
      byRound.get(n)!.push(f);
    }

    let createdMatchdays = 0;
    let upsertedMatches = 0;
    let updatedScores = 0;

    for (const [roundNumber, fixturesInRound] of byRound.entries()) {
      // Earliest kickoff = matchday starts_at
      const sortedKick = fixturesInRound
        .map((f) => new Date(f.fixture.date).getTime())
        .sort((a, b) => a - b);
      const startsAt = new Date(sortedKick[0]).toISOString();

      // Upsert matchday by (tournament_id, number)
      const { data: existingMd } = await supabaseAdmin
        .from("matchdays")
        .select("id")
        .eq("tournament_id", tournament.id)
        .eq("number", roundNumber)
        .maybeSingle();

      let matchdayId: string;
      if (existingMd) {
        matchdayId = existingMd.id;
        await supabaseAdmin
          .from("matchdays")
          .update({
            starts_at: startsAt,
            external_league_id: tournament.external_id,
            external_season: data.season,
          })
          .eq("id", matchdayId);
      } else {
        const { data: newMd, error: mdErr } = await supabaseAdmin
          .from("matchdays")
          .insert({
            tournament_id: tournament.id,
            number: roundNumber,
            starts_at: startsAt,
            entry_cost: data.entryCost,
            prize_pool: 0,
            is_open: true,
            external_league_id: tournament.external_id,
            external_season: data.season,
          })
          .select("id")
          .single();
        if (mdErr || !newMd) continue;
        matchdayId = newMd.id;
        createdMatchdays++;
      }

      // Upsert each match by external_id
      for (const f of fixturesInRound) {
        const homeName = f.teams.home.name;
        const awayName = f.teams.away.name;
        const finished = f.fixture.status.short === "FT" || f.fixture.status.short === "AET" || f.fixture.status.short === "PEN";

        const { data: existingMatch } = await supabaseAdmin
          .from("matches")
          .select("id, home_score, away_score")
          .eq("external_id", f.fixture.id)
          .maybeSingle();

        if (existingMatch) {
          // Update kickoff + scores if changed
          const newHome = finished ? f.goals.home : null;
          const newAway = finished ? f.goals.away : null;
          const scoreChanged =
            existingMatch.home_score !== newHome || existingMatch.away_score !== newAway;
          await supabaseAdmin
            .from("matches")
            .update({
              kickoff: f.fixture.date,
              home_score: newHome,
              away_score: newAway,
              status: finished ? "finished" : "scheduled",
            })
            .eq("id", existingMatch.id);
          if (scoreChanged) updatedScores++;
        } else {
          await supabaseAdmin.from("matches").insert({
            matchday_id: matchdayId,
            home_team: homeName.slice(0, 60),
            home_short: shortCode(homeName),
            home_color: colorFromName(homeName),
            away_team: awayName.slice(0, 60),
            away_short: shortCode(awayName),
            away_color: colorFromName(awayName),
            kickoff: f.fixture.date,
            home_score: finished ? f.goals.home : null,
            away_score: finished ? f.goals.away : null,
            status: finished ? "finished" : "scheduled",
            external_id: f.fixture.id,
          });
          upsertedMatches++;
        }
      }
    }

    return {
      ok: true as const,
      createdMatchdays,
      upsertedMatches,
      updatedScores,
      totalFixtures: fixtures.length,
      rounds: Array.from(byRound.keys()).sort((a, b) => a - b),
    };
  });