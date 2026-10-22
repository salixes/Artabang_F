-- ============================================================================
-- FIX — A crop a farmer REGISTERS or CHANGES must show up for the ADMIN right away:
--   * the crop becomes "Pending" on the admin's Crop Approval page
--   * the ADMIN gets a notification (bell icon at the top + Notifications page)
--
-- This file puts the whole crop verification + notification chain in place again,
-- so it works no matter which older crop SQL files were (or were not) run before.
-- It also adds a function the app calls directly after a farmer registers/changes a
-- crop (so the admin is told even if a trigger is missing), and makes the RSBSA
-- notifications clickable.
-- Safe to run more than once. Nothing is deleted.
-- ============================================================================
alter table public.notifications add column if not exists category text;

/* ------------------------------------------------------------------------ */
/* 1. Crop verification                                                      */
/* ------------------------------------------------------------------------ */
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'crop_registrations' and column_name = 'status') then
    alter table public.crop_registrations
      add column status text not null default 'Pending' check (status in ('Pending','Verified','Rejected'));
    -- crops registered BEFORE this feature were already accepted: don't lock farmers out
    update public.crop_registrations set status = 'Verified';
  end if;
end $$;
alter table public.crop_registrations add column if not exists verified_by uuid references public.profiles(id);
alter table public.crop_registrations add column if not exists verified_at timestamptz;
alter table public.crop_registrations add column if not exists remarks text;

create or replace function public.guard_crop_verification() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r public.app_role := public.current_role();
begin
  if tg_op = 'INSERT' then
    if r is distinct from 'admin' then          -- farmers (and anyone else) always start Pending
      new.status := 'Pending'; new.verified_by := null; new.verified_at := null; new.remarks := null;
    end if;
    return new;
  end if;

  -- UPDATE
  if new.status is distinct from old.status then
    if r is distinct from 'admin' then
      raise exception 'Only the admin can verify or reject a crop registration.';
    end if;
    if new.status in ('Verified','Rejected') then
      new.verified_by := auth.uid(); new.verified_at := now();
    else
      new.verified_by := null; new.verified_at := null;
    end if;
  elsif r is distinct from 'admin' then
    new.verified_by := old.verified_by; new.verified_at := old.verified_at; new.remarks := old.remarks;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_guard_crop_verification on public.crop_registrations;
create trigger trg_guard_crop_verification
  before insert or update on public.crop_registrations
  for each row execute function public.guard_crop_verification();

-- admin is told about every crop waiting for verification
create or replace function public.notify_admin_crop_pending() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  who text; msg text;
begin
  if new.status <> 'Pending' then return new; end if;
  select coalesce(p.full_name, 'A farmer') into who from public.profiles p where p.id = new.farmer_id;
  msg := '<b>' || replace(replace(replace(who, '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '</b> registered <b>'
      || replace(replace(replace(new.crop_name, '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '</b> — waiting for your verification.';
  insert into public.notifications (recipient_id, icon, message, category)
  select a.id, 'fa-seedling', msg, 'crop_verification'
  from public.profiles a
  where a.role = 'admin'
    and not exists (select 1 from public.notifications n where n.recipient_id = a.id and n.message = msg and n.read = false);
  return new;
end;
$$;
drop trigger if exists trg_notify_admin_crop_pending on public.crop_registrations;
create trigger trg_notify_admin_crop_pending
  after insert on public.crop_registrations
  for each row execute function public.notify_admin_crop_pending();

-- farmer is told the result
create or replace function public.notify_farmer_crop_result() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  crop text := replace(replace(replace(new.crop_name, '&', '&amp;'), '<', '&lt;'), '>', '&gt;');
begin
  if new.status is not distinct from old.status then return new; end if;
  if new.status = 'Verified' then
    insert into public.notifications (recipient_id, icon, message, category)
    values (new.farmer_id, 'fa-circle-check', 'Your registered crop <b>' || crop || '</b> was <b>verified</b> by the MAO.', 'crop');
  elsif new.status = 'Rejected' then
    insert into public.notifications (recipient_id, icon, message, category)
    values (new.farmer_id, 'fa-circle-xmark',
            'Your registered crop <b>' || crop || '</b> was <b>rejected</b>.'
              || coalesce(' Reason: ' || replace(replace(replace(nullif(trim(new.remarks), ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), ''),
            'crop');
  end if;
  return new;
end;
$$;
drop trigger if exists trg_notify_farmer_crop_result on public.crop_registrations;
create trigger trg_notify_farmer_crop_result
  after update of status on public.crop_registrations
  for each row execute function public.notify_farmer_crop_result();

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


-- ============================================================================
-- The app calls this right after a farmer registers or changes a crop.
-- It tells every admin (same message as the triggers, so nobody gets it twice).
-- ============================================================================
create or replace function public.notify_admin_crop(p_crop uuid, p_kind text default 'registered', p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  c public.crop_registrations;
  who text; msg text; why text;
begin
  select * into c from public.crop_registrations where id = p_crop;
  if not found or c.farmer_id is distinct from auth.uid() then return; end if;
  select coalesce(p.full_name, 'A farmer') into who from public.profiles p where p.id = c.farmer_id;
  if p_kind = 'edited' then
    why := coalesce(nullif(trim(c.last_edit_reason), ''), nullif(trim(p_reason), ''), 'details changed');
    msg := '<b>' || replace(replace(replace(who, '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '</b> edited their <b>'
        || replace(replace(replace(c.crop_name, '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '</b> registration — reason: '
        || replace(replace(replace(why, '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '. Waiting for your verification.';
    insert into public.notifications (recipient_id, icon, message, category)
    select a.id, 'fa-pen-to-square', msg, 'crop_verification' from public.profiles a
    where a.role = 'admin'
      and not exists (select 1 from public.notifications n where n.recipient_id = a.id and n.message = msg and n.read = false);
  else
    msg := '<b>' || replace(replace(replace(who, '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '</b> registered <b>'
        || replace(replace(replace(c.crop_name, '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '</b> — waiting for your verification.';
    insert into public.notifications (recipient_id, icon, message, category)
    select a.id, 'fa-seedling', msg, 'crop_verification' from public.profiles a
    where a.role = 'admin'
      and not exists (select 1 from public.notifications n where n.recipient_id = a.id and n.message = msg and n.read = false);
  end if;
end;
$$;
grant execute on function public.notify_admin_crop(uuid, text, text) to authenticated;

-- ============================================================================
-- Tell the admin about crops that are ALREADY waiting (registered / changed in the
-- last 30 days) and were never announced because the notification was missing.
-- ============================================================================
with m as (
  select c.id,
         '<b>' || replace(replace(replace(coalesce(f.full_name, 'A farmer'), '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '</b> registered <b>'
           || replace(replace(replace(c.crop_name, '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '</b> — waiting for your verification.' as msg
  from public.crop_registrations c
  left join public.profiles f on f.id = c.farmer_id
  where c.status = 'Pending' and coalesce(c.edited_at, c.registered_at) > now() - interval '30 days'
)
insert into public.notifications (recipient_id, icon, message, category)
select a.id, 'fa-seedling', m.msg, 'crop_verification'
from m cross join public.profiles a
where a.role = 'admin'
  and not exists (select 1 from public.notifications n where n.recipient_id = a.id and n.message = m.msg);

-- ============================================================================
-- RSBSA notifications: make them clickable (admin -> RSBSA Validation, farmer -> RSBSA Enrollment)
-- ============================================================================
create or replace function public.notify_rsbsa_submission() returns trigger
language plpgsql security definer set search_path = public as $$
declare who text;
begin
  if tg_op = 'INSERT' then
    select coalesce(full_name, 'A farmer') into who from public.profiles where id = new.farmer_id;
    insert into public.notifications (recipient_id, icon, message, category)
    select id, 'fa-file-signature', '<b>' || replace(replace(replace(who, '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '</b> submitted an RSBSA Enrollment Form for validation.', 'rsbsa'
      from public.profiles where role = 'admin';
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'Approved' then
      insert into public.notifications (recipient_id, icon, message, category)
      values (new.farmer_id, 'fa-circle-check', 'Your RSBSA Enrollment Form was <b>validated</b> by the ADMIN.', 'rsbsa');
    elsif new.status = 'Returned' then
      insert into public.notifications (recipient_id, icon, message, category)
      values (new.farmer_id, 'fa-rotate-left',
              'Your RSBSA Enrollment Form was <b>returned</b> for corrections' || coalesce(': ' || replace(replace(replace(new.remarks, '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '.') || ' Please fix it and submit again.', 'rsbsa');
    end if;
  end if;
  return new;
end;
$$;

-- live bell: let the app receive new notifications instantly (ignored if already on)
do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception when others then null;
end $$;
