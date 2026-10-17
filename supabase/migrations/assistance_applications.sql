-- ============================================================================
-- MIGRATION — Applications for posted Assistance Announcements.
--
-- A farmer who received an assistance announcement sees it in "My Eligibility"
-- with an eligibility check, and (if eligible) can apply. The application is a
-- normal assistance_records row linked to the announcement, so it shows up in
-- the admin's Assistance Management together with every other application.
-- Run AFTER assistance_announcement.sql. Safe to run more than once.
-- ============================================================================

alter table public.assistance_records add column if not exists announcement_id uuid
  references public.assistance_announcements(id) on delete set null;
alter table public.assistance_records add column if not exists program_title text;

-- "Other Support Program" announcements need a matching record type
alter table public.assistance_records drop constraint if exists assistance_records_assistance_type_check;
alter table public.assistance_records add constraint assistance_records_assistance_type_check
  check (assistance_type in ('Cash Aid','Seeds','Fertilizer','Farming Equipment','Crop Insurance','Other Support Program'));

-- one application per farmer per announcement
create unique index if not exists uq_assistance_application_per_announcement
  on public.assistance_records (farmer_id, announcement_id) where announcement_id is not null;
create index if not exists idx_assistance_records_announcement on public.assistance_records (announcement_id);

-- ---- server-side rules for an application to a posted announcement ----
create or replace function public.check_assistance_application() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  a public.assistance_announcements%rowtype;
begin
  if new.announcement_id is null then
    return new;
  end if;

  select * into a from public.assistance_announcements where id = new.announcement_id;
  if not found then
    raise exception 'This assistance announcement no longer exists.';
  end if;

  -- farmers: only if the announcement was sent to them, and only before the deadline
  if public.current_role() = 'farmer' then
    if not exists (select 1 from public.assistance_announcement_recipients r
                   where r.announcement_id = a.id and r.farmer_id = new.farmer_id) then
      raise exception 'This assistance was not announced to you.';
    end if;
    if a.deadline is not null and a.deadline < current_date then
      raise exception 'The application deadline for this assistance has passed.';
    end if;
  end if;

  -- the announcement decides the record type and the program name (snapshot survives deletion)
  new.assistance_type := case a.assistance_type when 'Cash Assistance' then 'Cash Aid' else a.assistance_type end;
  new.program_title := a.title;
  return new;
end;
$$;

drop trigger if exists trg_check_assistance_application on public.assistance_records;
create trigger trg_check_assistance_application
  before insert on public.assistance_records
  for each row execute function public.check_assistance_application();

-- ---- tell every admin when an application for a posted assistance comes in ----
create or replace function public.notify_admin_of_assistance_application() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  who text;
begin
  if new.announcement_id is null then
    return new;
  end if;
  select coalesce(p.full_name, 'A farmer') into who from public.profiles p where p.id = new.farmer_id;
  insert into public.notifications (recipient_id, icon, message, category)
  select a.id, 'fa-file-circle-plus',
         '<b>' || replace(replace(replace(who, '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '</b> applied for <b>'
              || replace(replace(replace(coalesce(new.program_title, new.assistance_type), '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '</b>.',
         'application'
  from public.profiles a where a.role = 'admin';
  return new;
end;
$$;

drop trigger if exists trg_notify_admin_assistance_application on public.assistance_records;
create trigger trg_notify_admin_assistance_application
  after insert on public.assistance_records
  for each row execute function public.notify_admin_of_assistance_application();
