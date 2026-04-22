
-- STEP 1: Free up the unique constraint by deleting duplicates first.
-- Delete the API-seeded rows (which currently hold external_ids) when they have no matchdays;
-- we will instead set external_id on the originally-seeded rows.

DELETE FROM public.tournaments
WHERE id IN (
  'bb79a27e-fd70-4dd8-ae40-88a07d92e71f', -- dup Liga Profesional Argentina (128)
  '72859bcd-3a6a-4d59-a190-c7b1ea8c2c40', -- dup Copa Libertadores (13)
  '772837d6-f0f2-440f-88ca-8480593db6b6', -- dup Copa Sudamericana (11, wrong)
  '5acaa109-1e9a-4375-9764-b074e92a80db', -- dup UEFA Champions League (2)
  'd750768c-39a5-42d7-9804-9dbc57b035b4'  -- dup B Nacional (no external_id)
)
AND NOT EXISTS (SELECT 1 FROM public.matchdays md WHERE md.tournament_id = public.tournaments.id);

-- Also clear the wrong external_id from Primera Nacional before re-setting it,
-- to avoid any constraint issues if 130 had been pre-assigned anywhere.
UPDATE public.tournaments SET external_id = NULL WHERE id = 'bbb0ef17-9481-43d5-b03c-0e9e4dab1810';

-- STEP 2: Set correct external IDs on the canonical rows.
UPDATE public.tournaments
SET external_id = 128, external_provider = 'api-football', is_active = true
WHERE id = '11111111-1111-1111-1111-111111111111';

UPDATE public.tournaments
SET external_id = 2, external_provider = 'api-football', is_active = true, name = 'Champions League'
WHERE id = '22222222-2222-2222-2222-222222222222';

UPDATE public.tournaments
SET external_id = 13, external_provider = 'api-football', is_active = true
WHERE id = '6b955272-7ee0-4b20-8163-bf1ca974b234';

UPDATE public.tournaments
SET external_id = 14, external_provider = 'api-football', is_active = true
WHERE id = '3a769421-487e-4b03-93f3-8e5cd289933d';

UPDATE public.tournaments
SET external_id = 130, external_provider = 'api-football', is_active = true, name = 'Primera Nacional'
WHERE id = 'bbb0ef17-9481-43d5-b03c-0e9e4dab1810';

UPDATE public.tournaments
SET external_id = 1, external_provider = 'api-football', is_active = true
WHERE id = '0ce6e5f2-30fe-4008-aa11-8aeea020222b';
