-- ============================================================================
-- MIGRATION — Farmers can EDIT (not delete) a crop registration, with a reason.
--
--   * Farmers can no longer delete a crop registration (only the admin can).
--   * A farmer who changes a crop (wrong plant, area, planting date, variety,
--     land category, tenure) MUST give a reason. The change is logged, the crop goes
--     back to "Pending" and the admin is notified to verify it again.
--   * The admin sees what changed (old -> new) and why.
-- Run AFTER crop_verification_qualified_notify_yield_other.sql. Safe to run more than once.
-- ============================================================================

alter table public.crop_registrations add column if not exists edit_reason text;       -- input channel: filled by the farmer, cleared by the trigger
alter table public.crop_registrations add column if not exists last_edit_reason text; -- the reason of the most recent edit
alter table public.crop_registrations add column if not exists edited_at timestamptz;

create table if not exists public.crop_registration_edits (
  id uuid primary key default gen_random_uuid(),
  crop_registration_id uuid not null references public.crop_registrations(id) on delete cascade,
  farmer_id uuid not null references public.farmers(id) on delete cascade,
  reason text not null,
  changes jsonb not null,
  edited_at timestamptz not null default now()
);
create index if not exists idx_crop_edits_crop on public.crop_registration_edits(crop_registration_id);
alter table public.crop_registration_edits enable row level security;
drop policy if exists "crop_edits_select" on public.crop_registration_edits;
create policy "crop_edits_select" on public.crop_registration_edits for select
  using (farmer_id = auth.uid() or public.is_staff());

-- only the admin may delete a crop registration
drop policy if exists "crop_reg_delete" on public.crop_registrations;
create policy "crop_reg_delete" on public.crop_registrations for delete
  using (public.current_role() = 'admin');

create or replace function public.guard_crop_verification() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r public.app_role := public.current_role();
  ch jsonb := '{}'::jsonb;
  reason text;
begin
  if tg_op = 'INSERT' then
    if r is distinct from 'admin' then          -- farmers (and anyone else) always start Pending
      new.status := 'Pending'; new.verified_by := null; new.verified_at := null; new.remarks := null;
    end if;
    new.edit_reason := null;
    return new;
  end if;

  -- ---------------- UPDATE ----------------
  if r = 'admin' then                            -- admin: verify / reject / correct
    if new.status is distinct from old.status then
      if new.status in ('Verified','Rejected') then
        new.verified_by := auth.uid(); new.verified_at := now();
      else
        new.verified_by := null; new.verified_at := null;
      end if;
    end if;
    new.edit_reason := null;
    return new;
  end if;

  -- farmer / anyone else: can never verify, reject or touch the verification fields
  if new.status is distinct from old.status then
    raise exception 'Only the admin can verify or reject a crop registration.';
  end if;
  new.verified_by := old.verified_by; new.verified_at := old.verified_at; new.remarks := old.remarks;
  new.last_edit_reason := old.last_edit_reason; new.edited_at := old.edited_at;

  if new.crop_name        is distinct from old.crop_name        then ch := ch || jsonb_build_object('crop_name',        jsonb_build_object('from', old.crop_name,        'to', new.crop_name)); end if;
  if new.area             is distinct from old.area             then ch := ch || jsonb_build_object('area',             jsonb_build_object('from', old.area,             'to', new.area)); end if;
  if new.planting_date    is distinct from old.planting_date    then ch := ch || jsonb_build_object('planting_date',    jsonb_build_object('from', old.planting_date,    'to', new.planting_date)); end if;
  if new.variety          is distinct from old.variety          then ch := ch || jsonb_build_object('variety',          jsonb_build_object('from', old.variety,          'to', new.variety)); end if;
  if new.land_category    is distinct from old.land_category    then ch := ch || jsonb_build_object('land_category',    jsonb_build_object('from', old.land_category,    'to', new.land_category)); end if;
  if new.tenurial_status  is distinct from old.tenurial_status  then ch := ch || jsonb_build_object('tenurial_status',  jsonb_build_object('from', old.tenurial_status,  'to', new.tenurial_status)); end if;

  if ch <> '{}'::jsonb then
    reason := nullif(trim(coalesce(new.edit_reason, '')), '');
    if reason is null then
      raise exception 'Please give a reason for changing this crop registration.';
    end if;
    new.status := 'Pending';                     -- the MAO must verify the corrected details again
    new.last_edit_reason := reason;
    new.edited_at := now();
    insert into public.crop_registration_edits (crop_registration_id, farmer_id, reason, changes)
    values (old.id, old.farmer_id, reason, ch);
  end if;
  new.edit_reason := null;                       -- a reason is needed again for the next change
  return new;
end;
$$;

-- tell the admin a crop was edited and needs verifying again
create or replace function public.notify_admin_crop_edited() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  who text; msg text;
begin
  if new.edited_at is not distinct from old.edited_at then return new; end if;
  select coalesce(p.full_name, 'A farmer') into who from public.profiles p where p.id = new.farmer_id;
  msg := '<b>' || replace(replace(replace(who, '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '</b> edited their <b>'
      || replace(replace(replace(new.crop_name, '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '</b> registration — reason: '
      || replace(replace(replace(new.last_edit_reason, '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '. Waiting for your verification.';
  insert into public.notifications (recipient_id, icon, message, category)
  select a.id, 'fa-pen-to-square', msg, 'crop_verification'
  from public.profiles a
  where a.role = 'admin'
    and not exists (select 1 from public.notifications n where n.recipient_id = a.id and n.message = msg and n.read = false);
  return new;
end;
$$;
drop trigger if exists trg_notify_admin_crop_edited on public.crop_registrations;
create trigger trg_notify_admin_crop_edited
  after update on public.crop_registrations
  for each row execute function public.notify_admin_crop_edited();
