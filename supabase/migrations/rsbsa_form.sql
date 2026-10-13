-- ============================================================================
-- MIGRATION — RSBSA Enrollment Form (Revised Version 01-2024), full answers.
-- Stores every box of the two-sheet paper form (3 farm parcels x 6 crop rows,
-- PCN/TRN, parcel land-owner and rotational-tiller numbers, signatures, ...)
-- as one JSON document. The usual farmers columns are still filled in too,
-- so profiles, eligibility and reports keep working.
-- Safe to run more than once.
-- ============================================================================
alter table public.farmers add column if not exists rsbsa_form jsonb;
