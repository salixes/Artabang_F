-- ============================================================================
-- MIGRATION — Assistance Announcements (admin) with targeted notifications.
--
-- The admin posts an announcement about cash assistance / other support
-- programs and chooses the audience:
--   * 'all'   -> every farmer
--   * 'crops' -> only farmers who plant one of the selected crops
--                (matched against the crops on their RSBSA profile
--                 [farmer_crops] AND the crops they registered [crop_registrations])
-- On INSERT the database itself works out the matching farmers, stores them,
-- and notifies ONLY them. Farmers who don't match never receive it and can't
-- read it (row level security). Safe to run more than once.
-- ============================================================================

create table if not exists public.assistance_announcements (
  id uuid primary key default gen_random_uuid(),
  assistance_type text not null,
  icon text default 'fa-hand-holding-dollar',
  title text not null,
  body text not null,
  deadline date,
  audience text not null default 'all' check (audience in ('all','crops')),
  target_crops text[] not null default '{}',
  recipient_count integer not null default 0,
  posted_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint assistance_ann_crops_chk check (audience = 'all' or cardinality(target_crops) > 0)
);

create table if not exists public.assistance_announcement_recipients (
  announcement_id uuid not null references public.assistance_announcements(id) on delete cascade,
  farmer_id uuid not null references public.farmers(id) on delete cascade,
  primary key (announcement_id, farmer_id)
);
create index if not exists idx_aa_recipients_farmer on public.assistance_announcement_recipients(farmer_id);

alter table public.notifications add column if not exists category text;

-- ---- who matches an audience? (single source of truth: preview + posting) ----
create or replace function public.assistance_recipient_ids(p_audience text, p_crops text[])
returns setof uuid
language sql stable security definer set search_path = public as $$
  select f.id
  from public.farmers f
  join public.profiles p on p.id = f.id and p.role = 'farmer'
  where p_audience = 'all'
     or (p_audience = 'crops' and (
          exists (
            select 1 from public.farmer_crops fc
            where fc.farmer_id = f.id
              and lower(split_part(fc.crop_name, ' (', 1)) in (select lower(split_part(c, ' (', 1)) from unnest(p_crops) c)
          )
          or exists (
            select 1 from public.crop_registrations cr
            where cr.farmer_id = f.id
              and lower(split_part(cr.crop_name, ' (', 1)) in (select lower(split_part(c, ' (', 1)) from unnest(p_crops) c)
          )
        ));
$$;
-- internal only: never callable straight from the browser
revoke execute on function public.assistance_recipient_ids(text, text[]) from public, anon, authenticated;

-- "How many farmers will receive this?" — live preview for the admin form
create or replace function public.assistance_recipient_count(p_audience text, p_crops text[])
returns integer
language plpgsql stable security definer set search_path = public as $$
begin
  if public.current_role() is distinct from 'admin' then
    raise exception 'Only the admin can preview assistance announcement recipients.';
  end if;
  return (select count(*)::integer from public.assistance_recipient_ids(p_audience, p_crops));
end;
$$;
revoke execute on function public.assistance_recipient_count(text, text[]) from public, anon;
grant execute on function public.assistance_recipient_count(text, text[]) to authenticated;

-- ---- on post: store the matching farmers and notify ONLY them ----
create or replace function public.notify_on_assistance_announcement() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  insert into public.assistance_announcement_recipients (announcement_id, farmer_id)
  select new.id, r from public.assistance_recipient_ids(new.audience, new.target_crops) r
  on conflict do nothing;

  insert into public.notifications (recipient_id, icon, message, category)
  select rc.farmer_id, coalesce(new.icon, 'fa-hand-holding-dollar'),
         '<b>' || replace(replace(replace(new.assistance_type, '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || ':</b> '
              || replace(replace(replace(new.title, '&', '&amp;'), '<', '&lt;'), '>', '&gt;'),
         'assistance'
  from public.assistance_announcement_recipients rc
  where rc.announcement_id = new.id;

  select count(*) into n from public.assistance_announcement_recipients where announcement_id = new.id;
  update public.assistance_announcements set recipient_count = n where id = new.id;
  return new;
end;
$$;

drop trigger if exists trg_notify_on_assistance_announcement on public.assistance_announcements;
create trigger trg_notify_on_assistance_announcement
  after insert on public.assistance_announcements
  for each row execute function public.notify_on_assistance_announcement();

-- ---- row level security ----
alter table public.assistance_announcements enable row level security;
alter table public.assistance_announcement_recipients enable row level security;

drop policy if exists "aa_select" on public.assistance_announcements;
create policy "aa_select" on public.assistance_announcements for select
  using (
    public.is_staff()
    or exists (select 1 from public.assistance_announcement_recipients r
               where r.announcement_id = assistance_announcements.id and r.farmer_id = auth.uid())
  );
drop policy if exists "aa_admin_write" on public.assistance_announcements;
create policy "aa_admin_write" on public.assistance_announcements for all
  using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

drop policy if exists "aa_recipients_select" on public.assistance_announcement_recipients;
create policy "aa_recipients_select" on public.assistance_announcement_recipients for select
  using (farmer_id = auth.uid() or public.is_staff());
