-- 1) Créditos: retirables = 0; bonus = 100 si tenía algo, sino 0
UPDATE public.user_credits
SET retirables = 0,
    bonus = CASE WHEN bonus > 0 THEN 100 ELSE 0 END,
    updated_at = now();

-- 2) Limpiar historial de premios y comisiones
DELETE FROM public.match_prediction_payouts;
DELETE FROM public.matchday_payouts;
DELETE FROM public.matchday_commissions;

-- 3) Limpiar todas las compras (eran ficticias)
DELETE FROM public.credit_purchase_requests;

-- 4) Resetear pozos
UPDATE public.matchdays
SET pot_carry = 0,
    prize_pool = 0;