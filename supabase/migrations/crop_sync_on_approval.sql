-- ============================================================================
-- When the ADMIN approves a crop (new registration OR a change the farmer asked for),
-- the approved details must show up everywhere in the admin's records:
--
--   * Farmer Profiling -> "Plants Grown" (farmer_crops): the approved crop is added,
--     and the old name is removed if the farmer changed it and has no other crop with
--     that name.
--   * Crop Insurance records (insurance_registrations): crop, area and planting date
--     follow the approved change.
--   * The saved PCIC application form (the one the admin views / prints): the lot
--     that was changed shows the approved area, planting date, variety, land category
--     and tenure.
--   * The farmer's "last updated" date.
--
-- It happens automatically inside the database, so it works no matter which page or
-- device the admin uses. If the sync ever fails, the approval itself still goes through.
-- Run AFTER crop_admin_notify.sql. Safe to run more than once. Nothing is deleted.
-- ============================================================================
create or replace function public.sync_crop_records_on_verify() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  since    timestamptz := coalesce(old.verified_at, '-infinity'::timestamptz);
  o_name   text    := new.crop_name;
  o_area   numeric := new.area;
  o_plant  date    := new.planting_date;
  e        record;
  snap_old jsonb := old.pcic_application;
  snap_new jsonb;
  lots     jsonb;
  idx      int;
  i        int;
  sumarea  numeric;
  same_app int;
  first_plant date;
begin
  begin
    -- what the crop said BEFORE the farmer's change(s) since the last approval
    -- (newest edit first, so the last value assigned is the earliest "from")
    for e in
      select changes from public.crop_registration_edits
      where crop_registration_id = new.id and edited_at > since
      order by edited_at desc
    loop
      if e.changes ? 'crop_name'      then o_name  := e.changes->'crop_name'->>'from'; end if;
      if e.changes ? 'area'           then o_area  := (e.changes->'area'->>'from')::numeric; end if;
      if e.changes ? 'planting_date'  then o_plant := (e.changes->'planting_date'->>'from')::date; end if;
    end loop;
  exception when others then
    raise warning 'sync_crop_records_on_verify (history) skipped: %', sqlerrm;
  end;

  begin
    -- 1. Farmer Profiling -> Plants Grown
    insert into public.farmer_crops (farmer_id, crop_name) values (new.farmer_id, new.crop_name)
    on conflict do nothing;
    if o_name is distinct from new.crop_name
       and not exists (select 1 from public.crop_registrations c
                       where c.farmer_id = new.farmer_id and c.id <> new.id and c.crop_name = o_name) then
      delete from public.farmer_crops where farmer_id = new.farmer_id and crop_name = o_name;
    end if;
    update public.farmers set updated_at = now() where id = new.farmer_id;   -- "last updated" on the farmer's record
  exception when others then
    raise warning 'sync_crop_records_on_verify (plants grown) skipped: %', sqlerrm;
  end;

  begin
    -- 2. saved PCIC form + Crop Insurance records
    if snap_old is not null then
      snap_new := snap_old;
      lots := coalesce(snap_old->'lots', '[]'::jsonb);
      idx := null;
      for i in 0 .. jsonb_array_length(lots) - 1 loop
        if coalesce(nullif(lots->i->>'area', '')::numeric, -1) = coalesce(o_area, -1)
           and coalesce(lots->i->>'planting', '') = coalesce(o_plant::text, '') then
          idx := i; exit;
        end if;
      end loop;

      if idx is not null then
        lots := jsonb_set(lots, array[idx::text, 'area'],     to_jsonb(trim_scale(new.area)::text));
        lots := jsonb_set(lots, array[idx::text, 'planting'], to_jsonb(coalesce(new.planting_date::text, '')));
        lots := jsonb_set(lots, array[idx::text, 'variety'],  to_jsonb(coalesce(new.variety, '')));
        if new.land_category in ('Irrigated', 'Non-Irrigated') then
          lots := jsonb_set(lots, array[idx::text, 'land'], to_jsonb(new.land_category));
        end if;
        if new.tenurial_status in ('Owner', 'Lessee') then
          lots := jsonb_set(lots, array[idx::text, 'tenure'], to_jsonb(new.tenurial_status));
        end if;
        snap_new := jsonb_set(snap_new, '{lots}', lots);
        select coalesce(sum(nullif(l->>'area', '')::numeric), 0) into sumarea from jsonb_array_elements(lots) l;
        if sumarea > 0 then snap_new := jsonb_set(snap_new, '{totalArea}', to_jsonb(trim_scale(sumarea)::text)); end if;
      end if;

      -- the form has ONE crop for the whole application: only rename it when this
      -- application has just this one crop record
      select count(*) into same_app from public.crop_registrations
        where farmer_id = new.farmer_id and pcic_application = snap_old;
      if same_app = 1 and new.crop_name is distinct from o_name then
        if new.crop_name in ('Rice', 'Corn') then
          snap_new := jsonb_set(jsonb_set(snap_new, '{crop}', to_jsonb(new.crop_name)), '{hvc}', '""'::jsonb);
        else
          snap_new := jsonb_set(jsonb_set(snap_new, '{crop}', '"High-Value (Please Specify)"'::jsonb), '{hvc}', to_jsonb(new.crop_name));
        end if;
      end if;

      if snap_new is distinct from snap_old then
        first_plant := nullif(snap_new->'lots'->0->>'planting', '')::date;
        update public.crop_registrations set pcic_application = snap_new
          where farmer_id = new.farmer_id and pcic_application = snap_old;
        update public.insurance_registrations set
            pcic_application = snap_new,
            crop_name = case when same_app = 1 then new.crop_name else crop_name end,
            area = case when sumarea > 0 then sumarea else area end,
            planting_date = coalesce(first_plant, planting_date),
            coverage_start_date = coalesce(first_plant, coverage_start_date)
          where farmer_id = new.farmer_id and pcic_application = snap_old;
      end if;
    else
      -- older insurance records that never kept the PCIC form
      update public.insurance_registrations set crop_name = new.crop_name, area = new.area, planting_date = new.planting_date
        where farmer_id = new.farmer_id and pcic_application is null
          and crop_name = o_name and planting_date = o_plant and area = o_area;
    end if;
  exception when others then
    raise warning 'sync_crop_records_on_verify (insurance / PCIC form) skipped: %', sqlerrm;   -- never block the approval
  end;
  return new;
end;
$$;

drop trigger if exists trg_sync_crop_records_on_verify on public.crop_registrations;
create trigger trg_sync_crop_records_on_verify
  after update of status on public.crop_registrations
  for each row
  when (new.status = 'Verified' and old.status is distinct from 'Verified')
  execute function public.sync_crop_records_on_verify();

-- One-time catch-up: crops that were ALREADY approved but never reached "Plants Grown".
insert into public.farmer_crops (farmer_id, crop_name)
select distinct c.farmer_id, c.crop_name
from public.crop_registrations c
where c.status = 'Verified'
on conflict do nothing;
