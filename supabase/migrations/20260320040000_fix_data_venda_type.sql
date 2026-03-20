-- Fix vendas_produtos.data_venda column type: timestamptz → date
--
-- Background:
--   Migration 20260303_create_produtos.sql created data_venda as
--   "timestamp with time zone".  The intent was always to store a plain
--   calendar date (YYYY-MM-DD), but the timestamptz type caused UTC-midnight
--   ambiguity: values inserted as bare date strings (e.g. '2024-03-15') were
--   stored as 2024-03-15 00:00:00 UTC.  In UTC-3 (Brazil) this timestamp
--   falls on the previous calendar day, so the date displayed on the
--   front-end was always one day earlier than the date that was entered.
--
-- Fix:
--   Convert the column to the plain "date" type.  Existing rows already
--   hold UTC-midnight timestamps that map 1-to-1 to the originally-intended
--   calendar date, so using the UTC date component during conversion
--   preserves all existing records correctly.

ALTER TABLE public.vendas_produtos
    ALTER COLUMN data_venda TYPE date
    USING (data_venda AT TIME ZONE 'UTC')::date;

-- Align the column default so new rows inserted without an explicit
-- data_venda value also receive the current UTC date.
ALTER TABLE public.vendas_produtos
    ALTER COLUMN data_venda SET DEFAULT CURRENT_DATE;
