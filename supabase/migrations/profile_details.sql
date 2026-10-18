-- ============================================================================
-- MIGRATION — Admin / President profile: photo + more details.
-- (Farmers already keep their photo in farmers.photo_url.)
-- Photos are uploaded to the existing public "avatars" storage bucket.
-- Safe to run more than once.
-- ============================================================================
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists position text;
alter table public.profiles add column if not exists address text;
alter table public.profiles add column if not exists birth_date date;
