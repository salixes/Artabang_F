-- ============================================================================
-- AgriReport — Supabase schema
-- Run this once in the Supabase SQL editor (Project → SQL Editor → New query).
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE where possible.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. ROLES / PROFILES
-- One row per auth.users row. role drives all RBAC (frontend routes + RLS).
-- ----------------------------------------------------------------------------
do $$ begin
  create type public.app_role as enum ('farmer','admin','president');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'farmer',
  full_name text not null,
  email text not null,
  contact_number text,
  avatar_seed text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2. ASSOCIATIONS
-- ----------------------------------------------------------------------------
create table if not exists public.associations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  president_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 3. FARMERS (extends profiles where role = 'farmer')
-- ----------------------------------------------------------------------------
create table if not exists public.farmers (
  id uuid primary key references public.profiles(id) on delete cascade,
  location text,
  farm_size numeric(10,2),
  is_association_member boolean not null default false,
  association_id uuid references public.associations(id),
  photo_url text,
  validated boolean not null default false,
  validated_by uuid references public.profiles(id),
  validated_at timestamptz,
  updated_at timestamptz not null default now()
);

-- crops the farmer currently declares as "Plants Grown" on their profile
create table if not exists public.farmer_crops (
  farmer_id uuid not null references public.farmers(id) on delete cascade,
  crop_name text not null,
  primary key (farmer_id, crop_name)
);

-- ----------------------------------------------------------------------------
-- 4. CROP REFERENCE DATA (farmgate price list used for insurance coverage calc)
-- ----------------------------------------------------------------------------
create table if not exists public.crop_prices (
  crop_name text primary key,
  price_per_kg numeric(10,2) not null
);

insert into public.crop_prices (crop_name, price_per_kg) values
  ('Corn',14), ('Rice',20), ('Banana',15), ('Coffee',120), ('Sugarcane',3),
  ('Pineapple',12), ('Cassava',10), ('Sweet Potato (Camote)',25), ('Tomato',30),
  ('Pechay',25), ('Eggplant (Talong)',30), ('Ampalaya',35), ('Okra',35),
  ('String Beans (Sitaw)',30), ('Cabbage',25)
on conflict (crop_name) do nothing;

-- ----------------------------------------------------------------------------
-- 5. CROP REGISTRATION (general farm declaration each season)
-- ----------------------------------------------------------------------------
create table if not exists public.crop_registrations (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.farmers(id) on delete cascade,
  crop_name text not null,
  area numeric(10,2) not null,
  planting_date date not null,
  variety text,
  land_category text,
  tenurial_status text,
  registered_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 6. CROP INSURANCE REGISTRATION (establishes insurance eligibility)
-- ----------------------------------------------------------------------------
create table if not exists public.insurance_registrations (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.farmers(id) on delete cascade,
  crop_name text not null,
  area numeric(10,2) not null,
  planting_date date not null,
  status text not null default 'Registered',
  registered_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 7. YIELD / HARVEST RECORDS
-- ----------------------------------------------------------------------------
create table if not exists public.yield_records (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.farmers(id) on delete cascade,
  crop_name text not null,
  season text not null,
  kilograms numeric(10,2) not null,
  harvest_date date not null,
  status text not null default 'Pending' check (status in ('Pending','Verified','Rejected')),
  verified_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 8. ASSISTANCE RECORDS
-- ----------------------------------------------------------------------------
create table if not exists public.assistance_records (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.farmers(id) on delete cascade,
  assistance_type text not null check (assistance_type in ('Cash Aid','Seeds','Fertilizer','Farming Equipment','Crop Insurance')),
  value_description text,
  source text not null default 'MAO' check (source in ('MAO','Other Program')),
  status text not null default 'Pending' check (status in ('Pending','Under Review','Released','Denied')),
  requested_at timestamptz not null default now(),
  resolved_by uuid references public.profiles(id),
  resolved_at timestamptz
);

-- ----------------------------------------------------------------------------
-- 9. PROFILE UPDATE REQUESTS (two-step: president then admin)
-- ----------------------------------------------------------------------------
create table if not exists public.profile_update_requests (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.farmers(id) on delete cascade,
  new_values jsonb not null,
  old_values jsonb not null,
  president_status text not null default 'Pending' check (president_status in ('Pending','Approved','Rejected')),
  president_at timestamptz,
  admin_status text not null default 'Pending' check (admin_status in ('Pending','Approved','Rejected')),
  admin_at timestamptz,
  overall_status text not null default 'Pending Review' check (overall_status in ('Pending Review','Approved','Rejected')),
  submitted_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 10. MEETINGS & ATTENDANCE (Association President)
-- ----------------------------------------------------------------------------
create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  association_id uuid references public.associations(id),
  title text not null,
  meeting_type text not null default 'Meeting' check (meeting_type in ('Meeting','Gathering')),
  meeting_date date not null,
  location text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.attendance (
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  farmer_id uuid not null references public.farmers(id) on delete cascade,
  present boolean not null default false,
  primary key (meeting_id, farmer_id)
);

-- ----------------------------------------------------------------------------
-- 11. POLICIES (Association President)
-- ----------------------------------------------------------------------------
create table if not exists public.policies (
  id uuid primary key default gen_random_uuid(),
  association_id uuid references public.associations(id),
  title text not null,
  icon text default 'fa-scroll',
  body text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 12. ANNOUNCEMENTS
-- ----------------------------------------------------------------------------
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  icon text default 'fa-bullhorn',
  title text not null,
  body text not null,
  posted_by uuid references public.profiles(id),
  posted_by_role public.app_role not null default 'admin',
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 13. NOTIFICATIONS
-- ----------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  icon text default 'fa-bell',
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.associations enable row level security;
alter table public.farmers enable row level security;
alter table public.farmer_crops enable row level security;
alter table public.crop_prices enable row level security;
alter table public.crop_registrations enable row level security;
alter table public.insurance_registrations enable row level security;
alter table public.yield_records enable row level security;
alter table public.assistance_records enable row level security;
alter table public.profile_update_requests enable row level security;
alter table public.meetings enable row level security;
alter table public.attendance enable row level security;
alter table public.policies enable row level security;
alter table public.announcements enable row level security;
alter table public.notifications enable row level security;

-- Helper: current caller's role, read once per statement.
create or replace function public.current_role() returns public.app_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select public.current_role() in ('admin','president');
$$;

-- ---- profiles ----
drop policy if exists "profiles_select_own_or_staff" on public.profiles;
create policy "profiles_select_own_or_staff" on public.profiles for select
  using (id = auth.uid() or public.is_staff());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update
  using (id = auth.uid() or public.current_role() = 'admin');

-- profile INSERT is done by the admin-create-user Edge Function using the
-- service role key, which bypasses RLS — no public insert policy needed.

-- ---- associations ----
drop policy if exists "associations_select_all" on public.associations;
create policy "associations_select_all" on public.associations for select using (true);

drop policy if exists "associations_write_staff" on public.associations;
create policy "associations_write_staff" on public.associations for all
  using (public.is_staff()) with check (public.is_staff());

-- ---- farmers ----
drop policy if exists "farmers_select" on public.farmers;
create policy "farmers_select" on public.farmers for select
  using (id = auth.uid() or public.is_staff());

drop policy if exists "farmers_update" on public.farmers;
create policy "farmers_update" on public.farmers for update
  using (id = auth.uid() or public.is_staff());

drop policy if exists "farmers_insert_staff" on public.farmers;
create policy "farmers_insert_staff" on public.farmers for insert
  with check (public.is_staff());

drop policy if exists "farmers_delete_staff" on public.farmers;
create policy "farmers_delete_staff" on public.farmers for delete
  using (public.current_role() = 'admin');

-- ---- farmer_crops ----
drop policy if exists "farmer_crops_select" on public.farmer_crops;
create policy "farmer_crops_select" on public.farmer_crops for select
  using (farmer_id = auth.uid() or public.is_staff());

drop policy if exists "farmer_crops_write" on public.farmer_crops;
create policy "farmer_crops_write" on public.farmer_crops for all
  using (farmer_id = auth.uid() or public.is_staff())
  with check (farmer_id = auth.uid() or public.is_staff());

-- ---- crop_prices (public reference data) ----
drop policy if exists "crop_prices_select_all" on public.crop_prices;
create policy "crop_prices_select_all" on public.crop_prices for select using (true);
drop policy if exists "crop_prices_write_admin" on public.crop_prices;
create policy "crop_prices_write_admin" on public.crop_prices for all
  using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

-- ---- crop_registrations ----
drop policy if exists "crop_reg_select" on public.crop_registrations;
create policy "crop_reg_select" on public.crop_registrations for select
  using (farmer_id = auth.uid() or public.is_staff());
drop policy if exists "crop_reg_insert" on public.crop_registrations;
create policy "crop_reg_insert" on public.crop_registrations for insert
  with check (farmer_id = auth.uid() or public.is_staff());
drop policy if exists "crop_reg_update" on public.crop_registrations;
create policy "crop_reg_update" on public.crop_registrations for update
  using (farmer_id = auth.uid() or public.is_staff());
drop policy if exists "crop_reg_delete" on public.crop_registrations;
create policy "crop_reg_delete" on public.crop_registrations for delete
  using (farmer_id = auth.uid() or public.is_staff());

-- ---- insurance_registrations ----
drop policy if exists "ins_reg_select" on public.insurance_registrations;
create policy "ins_reg_select" on public.insurance_registrations for select
  using (farmer_id = auth.uid() or public.is_staff());
drop policy if exists "ins_reg_insert" on public.insurance_registrations;
create policy "ins_reg_insert" on public.insurance_registrations for insert
  with check (farmer_id = auth.uid() or public.is_staff());
drop policy if exists "ins_reg_update" on public.insurance_registrations;
create policy "ins_reg_update" on public.insurance_registrations for update
  using (farmer_id = auth.uid() or public.is_staff());
drop policy if exists "ins_reg_delete" on public.insurance_registrations;
create policy "ins_reg_delete" on public.insurance_registrations for delete
  using (public.is_staff());

-- ---- yield_records ----
drop policy if exists "yield_select" on public.yield_records;
create policy "yield_select" on public.yield_records for select
  using (farmer_id = auth.uid() or public.is_staff());
drop policy if exists "yield_insert" on public.yield_records;
create policy "yield_insert" on public.yield_records for insert
  with check (farmer_id = auth.uid() or public.is_staff());
drop policy if exists "yield_update" on public.yield_records;
create policy "yield_update" on public.yield_records for update
  using (public.is_staff() or (farmer_id = auth.uid() and status = 'Pending'));
drop policy if exists "yield_delete" on public.yield_records;
create policy "yield_delete" on public.yield_records for delete
  using (public.is_staff());

-- ---- assistance_records ----
drop policy if exists "assist_select" on public.assistance_records;
create policy "assist_select" on public.assistance_records for select
  using (farmer_id = auth.uid() or public.is_staff());
drop policy if exists "assist_insert" on public.assistance_records;
create policy "assist_insert" on public.assistance_records for insert
  with check (farmer_id = auth.uid() or public.is_staff());
drop policy if exists "assist_update" on public.assistance_records;
create policy "assist_update" on public.assistance_records for update
  using (public.is_staff());
drop policy if exists "assist_delete" on public.assistance_records;
create policy "assist_delete" on public.assistance_records for delete
  using (public.current_role() = 'admin');

-- ---- profile_update_requests ----
drop policy if exists "req_select" on public.profile_update_requests;
create policy "req_select" on public.profile_update_requests for select
  using (farmer_id = auth.uid() or public.is_staff());
drop policy if exists "req_insert" on public.profile_update_requests;
create policy "req_insert" on public.profile_update_requests for insert
  with check (farmer_id = auth.uid());
drop policy if exists "req_update" on public.profile_update_requests;
create policy "req_update" on public.profile_update_requests for update
  using (public.is_staff());

-- ---- meetings ----
drop policy if exists "meetings_select" on public.meetings;
create policy "meetings_select" on public.meetings for select using (true);
drop policy if exists "meetings_write_president" on public.meetings;
create policy "meetings_write_president" on public.meetings for all
  using (public.current_role() = 'president') with check (public.current_role() = 'president');

-- ---- attendance ----
drop policy if exists "attendance_select" on public.attendance;
create policy "attendance_select" on public.attendance for select
  using (farmer_id = auth.uid() or public.is_staff());
drop policy if exists "attendance_write_president" on public.attendance;
create policy "attendance_write_president" on public.attendance for all
  using (public.current_role() = 'president') with check (public.current_role() = 'president');

-- ---- policies (association policy documents) ----
drop policy if exists "policies_select_all" on public.policies;
create policy "policies_select_all" on public.policies for select using (true);
drop policy if exists "policies_write_president" on public.policies;
create policy "policies_write_president" on public.policies for all
  using (public.current_role() = 'president') with check (public.current_role() = 'president');

-- ---- announcements ----
drop policy if exists "announce_select_all" on public.announcements;
create policy "announce_select_all" on public.announcements for select using (true);
drop policy if exists "announce_write_staff" on public.announcements;
create policy "announce_write_staff" on public.announcements for all
  using (public.is_staff()) with check (public.is_staff());

-- ---- notifications ----
drop policy if exists "notif_select_own" on public.notifications;
create policy "notif_select_own" on public.notifications for select
  using (recipient_id = auth.uid());
drop policy if exists "notif_update_own" on public.notifications;
create policy "notif_update_own" on public.notifications for update
  using (recipient_id = auth.uid());
drop policy if exists "notif_insert_staff" on public.notifications;
create policy "notif_insert_staff" on public.notifications for insert
  with check (public.is_staff() or true); -- server-side triggers / edge functions also insert

-- ============================================================================
-- TRIGGERS — two-step profile-update approval is evaluated and applied
-- server-side, so it happens the same way regardless of which side (admin or
-- president) approves last, and regardless of which client is calling.
-- ============================================================================
create or replace function public.evaluate_request_status() returns trigger
language plpgsql as $$
begin
  if new.president_status = 'Rejected' or new.admin_status = 'Rejected' then
    new.overall_status := 'Rejected';
  elsif new.president_status = 'Approved' and new.admin_status = 'Approved' then
    new.overall_status := 'Approved';
  else
    new.overall_status := 'Pending Review';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_evaluate_request_status on public.profile_update_requests;
create trigger trg_evaluate_request_status
  before insert or update of president_status, admin_status on public.profile_update_requests
  for each row execute function public.evaluate_request_status();

create or replace function public.apply_approved_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  nv jsonb := new.new_values;
begin
  if new.overall_status = 'Approved' and (old.overall_status is distinct from 'Approved') then
    update public.profiles set
      contact_number = coalesce(nv->>'contact_number', contact_number),
      updated_at = now()
    where id = new.farmer_id;

    update public.farmers set
      location = coalesce(nv->>'location', location),
      farm_size = coalesce((nv->>'farm_size')::numeric, farm_size),
      is_association_member = coalesce((nv->>'is_association_member')::boolean, is_association_member),
      photo_url = coalesce(nv->>'photo_url', photo_url),
      updated_at = now()
    where id = new.farmer_id;

    if nv ? 'crops' then
      delete from public.farmer_crops where farmer_id = new.farmer_id;
      insert into public.farmer_crops (farmer_id, crop_name)
      select new.farmer_id, jsonb_array_elements_text(nv->'crops');
    end if;

    insert into public.notifications (recipient_id, icon, message)
    values (new.farmer_id, 'fa-circle-check', 'Your profile update was approved and is now reflected in your profile.');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_apply_approved_profile_update on public.profile_update_requests;
create trigger trg_apply_approved_profile_update
  after update of overall_status on public.profile_update_requests
  for each row execute function public.apply_approved_profile_update();

-- ============================================================================
-- VIEWS — convenience read models used directly by the frontend
-- ============================================================================
-- (farmer_directory and dashboard_stats are defined once, later in this
-- file, after the columns they depend on — including yield_records'
-- quantity_kg — exist. Defining them here too, on top of assumptions about
-- column names that later migrations change, is exactly what caused repeat
-- "column does not exist" errors on re-runs.)


-- ============================================================================
-- NOTE ON CREATING FARMER ACCOUNTS
-- Farmer accounts are created from the app (ADMIN → Farmer Profiling → Add
-- Farmer), which calls the admin-create-user Edge Function. Creating an
-- auth.users row normally requires the service_role key, which must never
-- ship in the frontend — the Edge Function is what keeps that key server-side.
-- ============================================================================

-- ============================================================================
-- STORAGE — public "avatars" bucket used for farmer profile photos
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars_authenticated_upload" on storage.objects;
create policy "avatars_authenticated_upload" on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.role() = 'authenticated');

drop policy if exists "avatars_owner_update" on storage.objects;
create policy "avatars_owner_update" on storage.objects for update
  using (bucket_id = 'avatars' and auth.role() = 'authenticated');

-- ============================================================================
-- MIGRATION — RSBSA (Registry System for Basic Sectors in Agriculture) fields
-- Safe to re-run on an existing database: every column uses IF NOT EXISTS.
-- This is the official DA enrollment form data model, captured on the
-- `farmers` table so Farmer Profiling / Add Farmer matches the real form.
-- ============================================================================

-- ---- Part 1: Personal Information ----
alter table public.farmers add column if not exists surname text;
alter table public.farmers add column if not exists first_name text;
alter table public.farmers add column if not exists middle_name text;
alter table public.farmers add column if not exists extension_name text;
alter table public.farmers add column if not exists sex text check (sex in ('Male','Female'));
alter table public.farmers add column if not exists date_of_birth date;
alter table public.farmers add column if not exists place_of_birth text;
alter table public.farmers add column if not exists mobile_number text;
alter table public.farmers add column if not exists mothers_maiden_name text;
alter table public.farmers add column if not exists civil_status text check (civil_status in ('Single','Married','Widowed','Separated','Divorced'));
alter table public.farmers add column if not exists spouse_name text;
alter table public.farmers add column if not exists religion text;

-- ---- Permanent Address ----
alter table public.farmers add column if not exists house_no_purok text;
alter table public.farmers add column if not exists street_sitio_subdivision text;
alter table public.farmers add column if not exists barangay text default 'Lindaban';
alter table public.farmers add column if not exists city_municipality text default 'Manolo Fortich';
alter table public.farmers add column if not exists province text default 'Bukidnon';
alter table public.farmers add column if not exists region text default 'Region X (Northern Mindanao)';

-- ---- Identifiers / classification ----
alter table public.farmers add column if not exists highest_formal_education text;
alter table public.farmers add column if not exists proof_of_identity text;
alter table public.farmers add column if not exists id_document_number text;
alter table public.farmers add column if not exists rsbsa_number text unique;
alter table public.farmers add column if not exists is_icc_ip boolean not null default false;
alter table public.farmers add column if not exists is_pwd boolean not null default false;
alter table public.farmers add column if not exists is_4ps_beneficiary boolean not null default false;

-- ---- Part 2: Livelihood Profile (a farmer can be more than one) ----
alter table public.farmers add column if not exists is_farmer boolean not null default true;
alter table public.farmers add column if not exists is_farmworker boolean not null default false;
alter table public.farmers add column if not exists is_fisherfolk boolean not null default false;
alter table public.farmers add column if not exists is_agri_youth boolean not null default false;

-- ---- Part 3: Farm Parcel Information ----
-- farm_size (already existed) is used as "Total Parcel Area (ha)".
alter table public.farmers add column if not exists farm_location text;
alter table public.farmers add column if not exists farm_type text;
alter table public.farmers add column if not exists within_ancestral_domain boolean not null default false;
alter table public.farmers add column if not exists agrarian_reform_beneficiary boolean not null default false;
alter table public.farmers add column if not exists organic_agriculture_practitioner boolean not null default false;
alter table public.farmers add column if not exists ownership_tenure_type text;
alter table public.farmers add column if not exists land_owner_name text;
alter table public.farmers add column if not exists cropping_schedule text;
alter table public.farmers add column if not exists commodity text;
alter table public.farmers add column if not exists commodity_size numeric(10,2);
alter table public.farmers add column if not exists no_of_heads_trees text;

-- ---- Part 4: Consent Form and Data Privacy Notice ----
alter table public.farmers add column if not exists consent_given boolean not null default false;
alter table public.farmers add column if not exists consent_date date;

-- Refresh the farmer_directory view so it exposes the RSBSA fields too.
-- (DROP + CREATE, not CREATE OR REPLACE, because the column set/order changed.)
-- CASCADE is required here on re-runs: yield_report (defined further below
-- in this file) depends on this view. It gets recreated later in this same
-- script, so dropping it here along with farmer_directory is safe.
--
-- total_verified_yield is a PLACEHOLDER (0) here, not a real computation:
-- whether the real yield column is still named `kilograms` or has already
-- been renamed to `quantity`/`quantity_kg` depends on whether this script
-- has been run before on this database, so neither name is safe to
-- reference at this exact point. The correct, final definition of this
-- view (computed from quantity_kg) is created later in this same script,
-- after that column is guaranteed to exist — this version is fully
-- replaced before anyone ever reads from it.
drop view if exists public.farmer_directory cascade;
create view public.farmer_directory as
select
  f.*,
  p.full_name,
  p.email,
  p.contact_number,
  p.avatar_seed,
  a.name as association_name,
  coalesce(
    (select array_agg(fc.crop_name) from public.farmer_crops fc where fc.farmer_id = f.id),
    array[]::text[]
  ) as crops,
  0::numeric as total_verified_yield
from public.farmers f
join public.profiles p on p.id = f.id
left join public.associations a on a.id = f.association_id;

grant select on public.farmer_directory to authenticated;

-- Security hardening: without security_invoker, a view runs with the
-- VIEW OWNER's privileges for RLS purposes — meaning it can silently bypass
-- Row Level Security on the underlying tables for every caller. Setting
-- security_invoker = true makes these views respect the *querying* user's
-- RLS instead, so a farmer only ever sees their own row through them.
alter view public.farmer_directory set (security_invoker = true);

-- ============================================================================
-- MIGRATION — Insurance record overhaul, Assistance quantity/source/status,
-- and a Yield Reports view. Safe to re-run (IF NOT EXISTS / DROP+CREATE).
-- ============================================================================

-- ---- INSURANCE: record-centric fields ----
alter table public.insurance_registrations add column if not exists registration_type text check (registration_type in ('New Registration','Renewal'));
alter table public.insurance_registrations add column if not exists previous_insurance_id uuid references public.insurance_registrations(id);
alter table public.insurance_registrations add column if not exists coverage_start_date date;
alter table public.insurance_registrations add column if not exists coverage_end_date date;
alter table public.insurance_registrations add column if not exists insurance_source text default 'PCIC';
alter table public.insurance_registrations add column if not exists coverage_rate numeric(4,2) not null default 0.80;
alter table public.insurance_registrations add column if not exists estimated_damage_percentage numeric(5,2);
alter table public.insurance_registrations add column if not exists estimated_damage_amount numeric(12,2);
alter table public.insurance_registrations add column if not exists estimated_insurance_amount numeric(12,2);
alter table public.insurance_registrations add column if not exists claim_date date;

-- status becomes an administrative state; "Expired" is derived at query time
-- from coverage_end_date, never hard-coded (see computeInsuranceStatus in the app).
alter table public.insurance_registrations drop constraint if exists insurance_registrations_status_check;
alter table public.insurance_registrations add constraint insurance_registrations_status_check
  check (status in ('Pending','Active','Claimed','Cancelled','Registered'));
alter table public.insurance_registrations drop constraint if exists insurance_registrations_dates_check;
alter table public.insurance_registrations add constraint insurance_registrations_dates_check
  check (coverage_end_date is null or coverage_start_date is null or coverage_end_date >= coverage_start_date);

-- Backfill existing rows (registered before this migration) with sane defaults
-- so old records aren't left with NULL coverage dates forever.
update public.insurance_registrations
set coverage_start_date = coalesce(coverage_start_date, planting_date),
    coverage_end_date = coalesce(coverage_end_date, planting_date + interval '120 days'),
    status = case when status = 'Registered' then 'Active' else status end
where coverage_start_date is null;

-- Automatically classify New Registration vs Renewal from the farmer's own
-- insurance history for that crop, and block a duplicate ACTIVE policy —
-- exactly the renewal logic requested, computed server-side from real data.
create or replace function public.set_insurance_registration_type() returns trigger
language plpgsql as $$
declare
  prev record;
begin
  select id, status, coverage_end_date into prev
  from public.insurance_registrations
  where farmer_id = new.farmer_id and crop_name = new.crop_name
    and id is distinct from new.id
  order by registered_at desc
  limit 1;

  if prev.id is null then
    new.registration_type := 'New Registration';
    new.previous_insurance_id := null;
  else
    new.registration_type := 'Renewal';
    new.previous_insurance_id := prev.id;
    if prev.status = 'Active' and (prev.coverage_end_date is null or prev.coverage_end_date >= current_date) then
      raise exception 'This farmer already has an active % insurance policy (registered %). It must expire, be claimed, or be cancelled before a renewal can be registered.', new.crop_name, to_char(prev.coverage_end_date, 'YYYY-MM-DD');
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_insurance_registration_type on public.insurance_registrations;
create trigger trg_set_insurance_registration_type
  before insert on public.insurance_registrations
  for each row execute function public.set_insurance_registration_type();

-- ---- ASSISTANCE: quantity, unit, expected/distribution dates, Incoming status ----
alter table public.assistance_records add column if not exists quantity numeric(10,2) check (quantity is null or quantity >= 0);
alter table public.assistance_records add column if not exists unit text;
alter table public.assistance_records add column if not exists expected_date date;
alter table public.assistance_records add column if not exists distribution_date date;

alter table public.assistance_records drop constraint if exists assistance_records_status_check;
alter table public.assistance_records add constraint assistance_records_status_check
  check (status in ('Pending','Under Review','Incoming','Released','Denied'));

-- ============================================================================
-- (yield_report is created once, later in this file, after quantity_kg
-- exists — an earlier version of this migration defined it here too using
-- the yield_records column name as it existed on a fresh database, which
-- broke on any re-run after that column had already been renamed further
-- down in this same script.)
-- ============================================================================

-- ============================================================================
-- SEED DATA (moved to the end of the file so it runs AFTER every migration
-- above it — these inserts use RSBSA columns that only exist once the
-- migrations have run in this same script execution).
-- ============================================================================
-- ============================================================================
-- SEED: default associations referenced by the original demo data
-- ============================================================================
insert into public.associations (name) values ('LARFA'), ('LIFA')
on conflict (name) do nothing;

-- ============================================================================
-- SEED ACCOUNTS — creates the ADMIN and Association President logins directly.
-- (Farmers are NOT seeded here — per your workflow, ADMIN creates farmer
-- accounts from inside the app, which calls the admin-create-user Edge
-- Function so each farmer is created with Supabase Auth + a proper profile.)
--
-- Rename full_name / email / password below before running if you'd like
-- different values — this block is idempotent (safe to re-run; it skips an
-- email that already has an account).
-- ============================================================================
do $$
declare
  admin_id uuid;
  new_president_id uuid;
  larfa_id uuid;
  farmer_id uuid;
begin
  -- ---- ADMIN ----
  if not exists (select 1 from auth.users where email = 'admin@agritabang.ph') then
    admin_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', admin_id, 'authenticated', 'authenticated',
      'admin@agritabang.ph', crypt('Admin123', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{}', now(), now(),
      '', '', '', ''
    );
    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), admin_id, admin_id::text,
      jsonb_build_object('sub', admin_id::text, 'email', 'admin@agritabang.ph'),
      'email', now(), now(), now()
    );
    insert into public.profiles (id, role, full_name, email)
    values (admin_id, 'admin', 'Ralph Daigdigan', 'admin@agritabang.ph');
  end if;

  -- ---- ASSOCIATION PRESIDENT ----
  if not exists (select 1 from auth.users where email = 'president@agritabang.ph') then
    new_president_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', new_president_id, 'authenticated', 'authenticated',
      'president@agritabang.ph', crypt('president123', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{}', now(), now(),
      '', '', '', ''
    );
    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), new_president_id, new_president_id::text,
      jsonb_build_object('sub', new_president_id::text, 'email', 'president@agritabang.ph'),
      'email', now(), now(), now()
    );
    insert into public.profiles (id, role, full_name, email)
    values (new_president_id, 'president', 'Neil Oblina', 'president@agritabang.ph');

    -- Make this president the head of LARFA (created in the associations seed above).
    select id into larfa_id from public.associations where name = 'LARFA';
    if larfa_id is not null then
      update public.associations set president_id = new_president_id where id = larfa_id;
    end if;
  end if;

  -- ---- FARMER (demo/test account) ----
  if not exists (select 1 from auth.users where email = 'farmer@agritabang.ph') then
    farmer_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', farmer_id, 'authenticated', 'authenticated',
      'farmer@agritabang.ph', crypt('Farmer123', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{}', now(), now(),
      '', '', '', ''
    );
    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), farmer_id, farmer_id::text,
      jsonb_build_object('sub', farmer_id::text, 'email', 'farmer@agritabang.ph'),
      'email', now(), now(), now()
    );
    insert into public.profiles (id, role, full_name, email, contact_number)
    values (farmer_id, 'farmer', 'Saliz Pag-oy', 'farmer@agritabang.ph', '0923-857-8801');

    select id into larfa_id from public.associations where name = 'LARFA';
    insert into public.farmers (
      id, location, farm_size, is_association_member, association_id, validated,
      surname, first_name, middle_name, sex, date_of_birth, place_of_birth, mobile_number,
      civil_status, house_no_purok, street_sitio_subdivision, barangay, city_municipality,
      province, region, highest_formal_education, proof_of_identity, rsbsa_number,
      is_farmer, farm_location, farm_type, ownership_tenure_type, cropping_schedule,
      commodity, commodity_size, consent_given, consent_date
    ) values (
      farmer_id, 'Purok 5, Lindaban, Manolo Fortich, Bukidnon', 1.5, true, larfa_id, true,
      'Pag-oy', 'Saliz', null, 'Male', '1985-04-12', 'Manolo Fortich, Bukidnon', '0923-857-8801',
      'Married', 'Purok 5', null, 'Lindaban', 'Manolo Fortich',
      'Bukidnon', 'Region X (Northern Mindanao)', 'High School Graduate', 'Barangay Certification', null,
      true, 'Lindaban, Manolo Fortich, Bukidnon', 'Upland', 'Registered Owner', 'Year-round',
      'Rice, Cassava', 1.5, false, null
    );
    insert into public.farmer_crops (farmer_id, crop_name) values (farmer_id, 'Rice'), (farmer_id, 'Cassava');
  end if;
end $$;

-- ============================================================================
-- MIGRATION — Direct profile editing, crop-change approval, flexible yield
-- units. Safe to re-run (IF NOT EXISTS / DROP+CREATE / guarded constraints).
-- ============================================================================

-- ---- FARMER PROFILE: personal info + photo + password are now edited
-- directly by the farmer (no request needed) — RLS already allows this via
-- the existing farmers_update / profiles_update_own policies, so no policy
-- changes are required here. Password changes go through Supabase Auth
-- directly (supabase.auth.updateUser), which never needs admin approval.

-- ---- CROP CHANGES: still require admin review (single-step, not the old
-- two-step profile_update_requests flow) since crops/plants are "important
-- farm information" per the updated business rule.
create table if not exists public.crop_change_requests (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.farmers(id) on delete cascade,
  old_crops text[] not null,
  new_crops text[] not null,
  status text not null default 'Pending' check (status in ('Pending','Verified','Rejected')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  requested_at timestamptz not null default now()
);

alter table public.crop_change_requests enable row level security;

drop policy if exists "crop_req_select" on public.crop_change_requests;
create policy "crop_req_select" on public.crop_change_requests for select
  using (farmer_id = auth.uid() or public.is_staff());
drop policy if exists "crop_req_insert" on public.crop_change_requests;
create policy "crop_req_insert" on public.crop_change_requests for insert
  with check (farmer_id = auth.uid());
drop policy if exists "crop_req_update" on public.crop_change_requests;
create policy "crop_req_update" on public.crop_change_requests for update
  using (public.current_role() = 'admin');

-- Applying an approved crop change happens server-side, atomically, the
-- moment ADMIN marks it Verified — mirrors the profile_update_requests
-- pattern used elsewhere in this schema.
create or replace function public.apply_verified_crop_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'Verified' and (old.status is distinct from 'Verified') then
    delete from public.farmer_crops where farmer_id = new.farmer_id;
    if array_length(new.new_crops, 1) > 0 then
      insert into public.farmer_crops (farmer_id, crop_name)
      select new.farmer_id, unnest(new.new_crops);
    end if;
    insert into public.notifications (recipient_id, icon, message)
    values (new.farmer_id, 'fa-circle-check', 'Your crop registration change was approved by ADMIN.');
  elsif new.status = 'Rejected' and (old.status is distinct from 'Rejected') then
    insert into public.notifications (recipient_id, icon, message)
    values (new.farmer_id, 'fa-circle-xmark', 'Your crop registration change request was rejected by ADMIN.');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_apply_verified_crop_change on public.crop_change_requests;
create trigger trg_apply_verified_crop_change
  after update of status on public.crop_change_requests
  for each row execute function public.apply_verified_crop_change();

-- ---- YIELD: flexible units. `quantity` replaces `kilograms` as the
-- farmer-facing value (in whichever unit they select); `quantity_kg` is a
-- server-computed kg-equivalent used internally for totals and insurance
-- calculations, so existing calculation logic keeps working unchanged.
drop view if exists public.yield_report;

alter table public.yield_records add column if not exists unit text not null default 'kg' check (unit in ('kg','Sacks','Cavans','Other'));
alter table public.yield_records add column if not exists quantity_kg numeric(10,2);

do $$ begin
  alter table public.yield_records rename column kilograms to quantity;
exception when undefined_column then null; end $$;

-- No type change needed here — the column was already numeric(10,2) from
-- table creation. (An explicit ALTER COLUMN TYPE, even to the same type,
-- would fail once dashboard_stats depends on this column after the rename.)

-- Standard weight-per-unit used only to compute the kg-equivalent for
-- totals/insurance math. "Other" is treated 1:1 (assumed already farmer-
-- estimated in kg) since an arbitrary custom unit has no fixed weight.
create or replace function public.compute_yield_quantity_kg() returns trigger
language plpgsql as $$
begin
  new.quantity_kg := new.quantity * case new.unit
    when 'kg' then 1
    when 'Sacks' then 50
    when 'Cavans' then 50
    else 1
  end;
  return new;
end;
$$;

drop trigger if exists trg_compute_yield_quantity_kg on public.yield_records;
create trigger trg_compute_yield_quantity_kg
  before insert or update of quantity, unit on public.yield_records
  for each row execute function public.compute_yield_quantity_kg();

update public.yield_records set quantity_kg = quantity * case unit when 'kg' then 1 when 'Sacks' then 50 when 'Cavans' then 50 else 1 end
where quantity_kg is null;

-- dashboard_stats summed `kilograms` directly — repoint it at quantity_kg.
create or replace view public.dashboard_stats as
select
  (select count(*) from public.farmers) as total_farmers,
  (select coalesce(sum(quantity_kg),0) from public.yield_records where status = 'Verified') as total_yield_kg,
  (select count(*) from public.assistance_records) as total_assistance_records,
  (select count(*) from public.assistance_records where assistance_type = 'Crop Insurance') as insurance_claims,
  (select count(*) from public.farmers where validated = false) as pending_validations,
  (select count(*) from public.assistance_records where status = 'Pending' or status = 'Under Review') as pending_applications,
  (select count(*) from public.assistance_records where status = 'Released') as released_assistance;
alter view public.dashboard_stats set (security_invoker = true);
grant select on public.dashboard_stats to authenticated;

create view public.yield_report as
select
  y.id, y.farmer_id, fd.full_name as farmer_name, y.crop_name, y.season,
  y.quantity, y.unit, y.quantity_kg, y.harvest_date, y.status, y.verified_by,
  vp.full_name as verified_by_name, y.created_at as submitted_at,
  cr.area as farm_area, cr.planting_date
from public.yield_records y
join public.farmer_directory fd on fd.id = y.farmer_id
left join public.profiles vp on vp.id = y.verified_by
left join lateral (
  select cr2.area, cr2.planting_date
  from public.crop_registrations cr2
  where cr2.farmer_id = y.farmer_id and cr2.crop_name = y.crop_name
  order by cr2.registered_at desc
  limit 1
) cr on true;

alter view public.yield_report set (security_invoker = true);
grant select on public.yield_report to authenticated;

-- farmer_directory (defined earlier in this file) summed y.kilograms for
-- total_verified_yield; after the rename above that silently became
-- sum(y.quantity) — the farmer's raw entered number, in whatever unit they
-- picked (kg, Sacks, ...), which is meaningless once units are mixed.
-- Re-point it at quantity_kg now that that column exists. Same column
-- name/type/position as before, so CREATE OR REPLACE is safe here.
create or replace view public.farmer_directory as
select
  f.*,
  p.full_name,
  p.email,
  p.contact_number,
  p.avatar_seed,
  a.name as association_name,
  coalesce(
    (select array_agg(fc.crop_name) from public.farmer_crops fc where fc.farmer_id = f.id),
    array[]::text[]
  ) as crops,
  coalesce((select sum(y.quantity_kg) from public.yield_records y where y.farmer_id = f.id and y.status = 'Verified'), 0) as total_verified_yield
from public.farmers f
join public.profiles p on p.id = f.id
left join public.associations a on a.id = f.association_id;

alter view public.farmer_directory set (security_invoker = true);


-- ============================================================================
-- MIGRATION — Admin can create farmer accounts without an Edge Function.
-- profiles previously had NO insert/delete policy at all (only the
-- service-role Edge Function could write to it). That Edge Function has been
-- unreliable to deploy, so Add Farmer now creates the auth user with the
-- standard client (via a session-isolated Supabase client) and inserts the
-- profile/farmer rows directly as ADMIN — which needs these two policies.
-- ============================================================================
drop policy if exists "profiles_insert_admin" on public.profiles;
create policy "profiles_insert_admin" on public.profiles for insert
  with check (public.current_role() = 'admin');

drop policy if exists "profiles_delete_admin" on public.profiles;
create policy "profiles_delete_admin" on public.profiles for delete
  using (public.current_role() = 'admin');
