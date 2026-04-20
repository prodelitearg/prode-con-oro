
CREATE OR REPLACE FUNCTION public.calculate_prediction_points(
  pred_home INTEGER, pred_away INTEGER,
  real_home INTEGER, real_away INTEGER
) RETURNS INTEGER
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF real_home IS NULL OR real_away IS NULL THEN
    RETURN 0;
  END IF;
  IF pred_home = real_home AND pred_away = real_away THEN
    RETURN 3;
  END IF;
  IF sign(pred_home - pred_away) = sign(real_home - real_away) THEN
    RETURN 1;
  END IF;
  RETURN 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_predictions_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.home_score IS NOT NULL AND NEW.away_score IS NOT NULL THEN
    UPDATE public.predictions
    SET points = public.calculate_prediction_points(home_score, away_score, NEW.home_score, NEW.away_score),
        locked = true,
        updated_at = now()
    WHERE match_id = NEW.id;
  ELSE
    UPDATE public.predictions
    SET points = 0, locked = false, updated_at = now()
    WHERE match_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_matches_score_update ON public.matches;
CREATE TRIGGER trg_matches_score_update
AFTER UPDATE OF home_score, away_score ON public.matches
FOR EACH ROW
WHEN (
  NEW.home_score IS DISTINCT FROM OLD.home_score
  OR NEW.away_score IS DISTINCT FROM OLD.away_score
)
EXECUTE FUNCTION public.update_predictions_points();
