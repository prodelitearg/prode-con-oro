
CREATE OR REPLACE FUNCTION public.tournament_leaderboard(_tournament_id uuid)
RETURNS TABLE (
  user_id uuid,
  display_name text,
  played integer,
  exact_hits integer,
  total_points integer,
  accuracy numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.user_id,
    coalesce(nullif(trim(pr.nombre || ' ' || pr.apellido), ''), 'Jugador') AS display_name,
    count(*)::int AS played,
    count(*) FILTER (WHERE p.points = 3)::int AS exact_hits,
    coalesce(sum(p.points), 0)::int AS total_points,
    CASE WHEN count(*) > 0
      THEN round(count(*) FILTER (WHERE p.points > 0)::numeric / count(*)::numeric * 100, 1)
      ELSE 0
    END AS accuracy
  FROM public.predictions p
  JOIN public.matches m ON m.id = p.match_id
  JOIN public.matchdays md ON md.id = m.matchday_id
  LEFT JOIN public.profiles pr ON pr.user_id = p.user_id
  WHERE md.tournament_id = _tournament_id
    AND m.home_score IS NOT NULL
    AND m.away_score IS NOT NULL
  GROUP BY p.user_id, pr.nombre, pr.apellido
  ORDER BY total_points DESC, exact_hits DESC, played DESC;
$$;

GRANT EXECUTE ON FUNCTION public.tournament_leaderboard(uuid) TO authenticated;
