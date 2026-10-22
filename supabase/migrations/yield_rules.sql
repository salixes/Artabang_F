-- ============================================================================
-- MIGRATION — Yield reports: register the crop first, farmers can edit.
--
--   * A farmer can only report yield for a crop he/she has registered
--     (Crop Registration; a rejected registration doesn't count).
--   * A farmer can edit a yield report (typing mistakes). A changed report goes back
--     to 'Pending' so the admin verifies the corrected numbers; only the admin
--     can verify or reject.
--   * The admin is notified of every new or edited report.
-- Safe to run more than once.
-- ============================================================================
drop policy if exists "yield_update" on public.yield_records;
create policy "yield_update" on public.yield_records for update
  using (public.is_staff() or farmer_id = auth.uid())
  with check (public.is_staff() or farmer_id = auth.uid());

create or replace function public.farmer_has_registered_crop(p_farmer uuid, p_crop text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.crop_registrations c
    where c.farmer_id = p_farmer
      and lower(trim(c.crop_name)) = lower(trim(p_crop))
      and coalesce(c.status, 'Pending') <> 'Rejected'
  );
$$;

create or replace function public.guard_yield_record() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r public.app_role := public.current_role();
  details_changed boolean;
begin
  if tg_op = 'INSERT' then
    if r is distinct from 'admin' then
      if not public.farmer_has_registered_crop(new.farmer_id, new.crop_name) then
        raise exception 'You need to register this crop first (Crop Registration) before you can report its yield.';
      end if;
      new.status := 'Pending'; new.verified_by := null;      -- always starts pending
    end if;
    return new;
  end if;

  -- UPDATE
  if r = 'admin' then return new; end if;                       -- the admin verifies / rejects / corrects

  details_changed := (new.crop_name, new.season, new.quantity, new.unit, new.unit_other, new.kg_per_unit, new.harvest_date)
                     is distinct from
                     (old.crop_name, old.season, old.quantity, old.unit, old.unit_other, old.kg_per_unit, old.harvest_date);
  if details_changed then
    if lower(trim(new.crop_name)) is distinct from lower(trim(old.crop_name))
       and not public.farmer_has_registered_crop(new.farmer_id, new.crop_name) then
      raise exception 'You need to register this crop first (Crop Registration) before you can report its yield.';
    end if;
    new.status := 'Pending'; new.verified_by := null;           -- corrected numbers are verified again
  else
    new.status := old.status; new.verified_by := old.verified_by; -- a farmer can't verify his/her own report
  end if;
  return new;
end;
$$;
drop trigger if exists trg_guard_yield_record on public.yield_records;
create trigger trg_guard_yield_record
  before insert or update on public.yield_records
  for each row execute function public.guard_yield_record();

create or replace function public.notify_admin_yield() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  who text; edited boolean; msg text;
begin
  if public.current_role() = 'admin' then return new; end if;
  edited := tg_op = 'UPDATE';
  if edited and (new.crop_name, new.season, new.quantity, new.unit, new.harvest_date)
                is not distinct from (old.crop_name, old.season, old.quantity, old.unit, old.harvest_date) then
    return new;                                                  -- nothing about the report changed
  end if;
  select coalesce(p.full_name, 'A farmer') into who from public.profiles p where p.id = new.farmer_id;
  msg := '<b>' || replace(replace(replace(who, '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '</b> '
      || case when edited then 'edited a yield report' else 'reported a yield' end
      || ' (<b>' || replace(replace(replace(new.crop_name, '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '</b>, '
      || replace(replace(replace(new.season, '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '). Waiting for your verification.';
  insert into public.notifications (recipient_id, icon, message, category)
  select a.id, 'fa-wheat-awn', msg, 'yield'
  from public.profiles a
  where a.role = 'admin'
    and not exists (select 1 from public.notifications n where n.recipient_id = a.id and n.message = msg and n.read = false);
  return new;
end;
$$;
drop trigger if exists trg_notify_admin_yield on public.yield_records;
create trigger trg_notify_admin_yield
  after insert or update on public.yield_records
  for each row execute function public.notify_admin_yield();
