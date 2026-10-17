-- ============================================================================
-- MIGRATION — PCIC Application for Crop Insurance (RC-UPI-01, Rev. 2025/Sep).
-- Keeps the complete filled-in form with the insurance record and the crop
-- record(s) it created, so it can be viewed and printed again. Safe to re-run.
-- ============================================================================
alter table public.insurance_registrations add column if not exists pcic_application jsonb;
alter table public.crop_registrations add column if not exists pcic_application jsonb;
