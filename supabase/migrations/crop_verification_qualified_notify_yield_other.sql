-- ============================================================================
-- MIGRATION
--   1. CROP VERIFICATION  – a newly registered crop starts as 'Pending'; only the
--      admin can Verify / Reject it. The farmer and the admin are notified.
--   2. AUTOMATIC "YOU ARE ELIGIBLE" NOTIFICATIONS – when a posted assistance
--      announcement matches a farmer who qualifies, they are notified right away;
--      a farmer who doesn't qualify yet is notified AUTOMATICALLY the moment they
--      become qualified (crop verified, harvest verified, photo/farm size added,
--      insurance registered ...).
--   3. YIELD "OTHER" – when the unit is "Other" the farmer must say which unit
--      (optionally how many kg one such unit weighs).
-- Run AFTER assistance_announcement.sql and assistance_applications.sql.
-- Safe to run more than once.
-- ============================================================================

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

/* ------------------------------------------------------------------------ */
/* 2. Automatic eligibility notifications                                    */
/* ------------------------------------------------------------------------ */
create table if not exists public.assistance_qualified_notified (
  announcement_id uuid not null references public.assistance_announcements(id) on delete cascade,
  farmer_id uuid not null references public.farmers(id) on delete cascade,
  notified_at timestamptz not null default now(),
  primary key (announcement_id, farmer_id)
);
alter table public.assistance_qualified_notified enable row level security;
drop policy if exists "aqn_staff_select" on public.assistance_qualified_notified;
create policy "aqn_staff_select" on public.assistance_qualified_notified for select using (public.is_staff());

-- Same rules as the app's "Automatic Qualification Check" (runQualificationCheck):
--   photo on file, a VERIFIED crop, farm size on file, then
--   Farming Equipment -> association member + none released before
--   everything else   -> a verified yield record
--   Crop Insurance    -> also an insurance registration
create or replace function public.farmer_qualifies(p_farmer uuid, p_assistance_type text)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  f public.farmers%rowtype;
  t text := case p_assistance_type when 'Cash Assistance' then 'Cash Aid' else p_assistance_type end;
begin
  select * into f from public.farmers where id = p_farmer;
  if not found then return false; end if;
  if coalesce(f.photo_url, '') = '' then return false; end if;
  if coalesce(f.farm_size, 0) <= 0 then return false; end if;
  if not exists (select 1 from public.crop_registrations c where c.farmer_id = p_farmer and c.status = 'Verified') then return false; end if;

  if t = 'Farming Equipment' then
    if not coalesce(f.is_association_member, false) then return false; end if;
    if exists (select 1 from public.assistance_records a
               where a.farmer_id = p_farmer and a.assistance_type = 'Farming Equipment' and a.status = 'Released') then return false; end if;
  else
    if not exists (select 1 from public.yield_records y where y.farmer_id = p_farmer and y.status = 'Verified') then return false; end if;
  end if;

  if t = 'Crop Insurance' then
    if not exists (select 1 from public.insurance_registrations i where i.farmer_id = p_farmer) then return false; end if;
  end if;
  return true;
end;
$$;
revoke execute on function public.farmer_qualifies(uuid, text) from public, anon, authenticated;

-- notify every recipient (optionally just one farmer / one announcement) who NOW qualifies and wasn't told yet
create or replace function public.notify_qualified_farmers(p_farmer uuid default null, p_announcement uuid default null)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  rec record;
  n integer := 0;
begin
  for rec in
    select a.id as ann_id, a.title, a.assistance_type, a.icon, r.farmer_id
    from public.assistance_announcements a
    join public.assistance_announcement_recipients r on r.announcement_id = a.id
    where (a.deadline is null or a.deadline >= current_date)
      and (p_farmer is null or r.farmer_id = p_farmer)
      and (p_announcement is null or a.id = p_announcement)
      and not exists (select 1 from public.assistance_qualified_notified q where q.announcement_id = a.id and q.farmer_id = r.farmer_id)
      and not exists (select 1 from public.assistance_records ar where ar.announcement_id = a.id and ar.farmer_id = r.farmer_id)
  loop
    if public.farmer_qualifies(rec.farmer_id, rec.assistance_type) then
      insert into public.assistance_qualified_notified (announcement_id, farmer_id) values (rec.ann_id, rec.farmer_id) on conflict do nothing;
      insert into public.notifications (recipient_id, icon, message, category)
      values (rec.farmer_id, coalesce(rec.icon, 'fa-hand-holding-dollar'),
              'You are <b>eligible</b> for <b>' || replace(replace(replace(rec.assistance_type, '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || ':</b> '
                || replace(replace(replace(rec.title, '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '. Open My Eligibility to apply.',
              'assistance');
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;
revoke execute on function public.notify_qualified_farmers(uuid, uuid) from public, anon, authenticated;

-- posting: qualified recipients get "You are eligible"; the rest get "posted — check what you still need"
create or replace function public.notify_on_assistance_announcement() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  insert into public.assistance_announcement_recipients (announcement_id, farmer_id)
  select new.id, r from public.assistance_recipient_ids(new.audience, new.target_crops) r
  on conflict do nothing;

  perform public.notify_qualified_farmers(null, new.id);

  insert into public.notifications (recipient_id, icon, message, category)
  select rc.farmer_id, coalesce(new.icon, 'fa-hand-holding-dollar'),
         '<b>' || replace(replace(replace(new.assistance_type, '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || ':</b> '
              || replace(replace(replace(new.title, '&', '&amp;'), '<', '&lt;'), '>', '&gt;')
              || ' was posted. Open My Eligibility to see what you still need to qualify.',
         'assistance'
  from public.assistance_announcement_recipients rc
  where rc.announcement_id = new.id
    and not exists (select 1 from public.assistance_qualified_notified q where q.announcement_id = new.id and q.farmer_id = rc.farmer_id);

  select count(*) into n from public.assistance_announcement_recipients where announcement_id = new.id;
  update public.assistance_announcements set recipient_count = n where id = new.id;
  return new;
end;
$$;

-- whenever something that affects eligibility changes, re-check that farmer
create or replace function public.trg_recheck_qualified_farmer() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  fid uuid;
begin
  -- to_jsonb(new) so the same function works for tables with `id` (farmers) or `farmer_id`
  fid := (case tg_table_name when 'farmers' then to_jsonb(new)->>'id' else to_jsonb(new)->>'farmer_id' end)::uuid;
  perform public.notify_qualified_farmers(fid, null);
  return new;
end;
$$;

drop trigger if exists trg_requalify_crop on public.crop_registrations;
create trigger trg_requalify_crop after insert or update of status on public.crop_registrations
  for each row when (new.status = 'Verified') execute function public.trg_recheck_qualified_farmer();

drop trigger if exists trg_requalify_yield on public.yield_records;
create trigger trg_requalify_yield after insert or update of status on public.yield_records
  for each row when (new.status = 'Verified') execute function public.trg_recheck_qualified_farmer();

drop trigger if exists trg_requalify_insurance on public.insurance_registrations;
create trigger trg_requalify_insurance after insert on public.insurance_registrations
  for each row execute function public.trg_recheck_qualified_farmer();

drop trigger if exists trg_requalify_farmer on public.farmers;
create trigger trg_requalify_farmer after update of photo_url, farm_size, is_association_member on public.farmers
  for each row execute function public.trg_recheck_qualified_farmer();

/* ------------------------------------------------------------------------ */
/* 3. Yield: "Other" unit must say which unit                                */
/* ------------------------------------------------------------------------ */
alter table public.yield_records add column if not exists unit_other text;
alter table public.yield_records add column if not exists kg_per_unit numeric(10,2) check (kg_per_unit is null or kg_per_unit > 0);
update public.yield_records set unit_other = 'Other (not specified)' where unit = 'Other' and coalesce(trim(unit_other), '') = '';
alter table public.yield_records drop constraint if exists yield_other_unit_chk;
alter table public.yield_records add constraint yield_other_unit_chk check (unit <> 'Other' or length(trim(coalesce(unit_other, ''))) > 0);

create or replace function public.compute_yield_quantity_kg() returns trigger
language plpgsql as $$
begin
  new.quantity_kg := new.quantity * case new.unit
    when 'kg' then 1
    when 'Sacks' then 50
    when 'Cavans' then 50
    else coalesce(new.kg_per_unit, 1)   -- "Other": the farmer's own kg-per-unit if given, else 1:1
  end;
  return new;
end;
$$;
drop trigger if exists trg_compute_yield_quantity_kg on public.yield_records;
create trigger trg_compute_yield_quantity_kg
  before insert or update of quantity, unit, kg_per_unit on public.yield_records
  for each row execute function public.compute_yield_quantity_kg();

-- the admin yield report also shows which "Other" unit was meant (new column goes last)
create or replace view public.yield_report as
select
  y.id, y.farmer_id, fd.full_name as farmer_name, y.crop_name, y.season,
  y.quantity, y.unit, y.quantity_kg, y.harvest_date, y.status, y.verified_by,
  vp.full_name as verified_by_name, y.created_at as submitted_at,
  cr.area as farm_area, cr.planting_date,
  y.unit_other
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
