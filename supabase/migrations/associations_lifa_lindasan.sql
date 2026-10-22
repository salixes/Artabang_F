-- ============================================================================
-- MIGRATION — The two associations are LIFA and Lindasan.
--
--   * renames the old "LARFA" association to "Lindasan" (members stay with it) and
--     makes sure "LIFA" exists
--   * the president heads both associations
--   * announcements can be sent to everyone, or only to LIFA or Lindasan members
--   * a scheduled meeting notifies the association members it is for
-- (Meetings already had an association column: empty = all associations.)
-- Safe to run more than once.
-- ============================================================================
update public.associations set name = 'Lindasan'
 where name = 'LARFA' and not exists (select 1 from public.associations where name = 'Lindasan');
insert into public.associations (name) values ('LIFA'), ('Lindasan') on conflict (name) do nothing;

update public.associations a set president_id = p.id
  from (select id from public.profiles where role = 'president' order by created_at limit 1) p
 where a.president_id is null and a.name in ('LIFA', 'Lindasan');

-- ---- announcements: all associations (null) or one association ----------------------------
alter table public.announcements add column if not exists association_id uuid references public.associations(id) on delete set null;

drop policy if exists "announce_select_all" on public.announcements;
drop policy if exists "announce_select" on public.announcements;
create policy "announce_select" on public.announcements for select using (
  association_id is null
  or public.is_staff()
  or exists (select 1 from public.farmers f where f.id = auth.uid() and f.is_association_member and f.association_id = announcements.association_id)
);

create or replace function public.notify_on_new_announcement() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (recipient_id, icon, message, category)
  select p.id, coalesce(new.icon, 'fa-bullhorn'), new.title, 'announcement'
  from public.profiles p
  where p.id is distinct from new.posted_by
    and (new.association_id is null
         or p.role in ('admin', 'president')
         or exists (select 1 from public.farmers f where f.id = p.id and f.is_association_member and f.association_id = new.association_id));
  return new;
end;
$$;

-- ---- meetings: tell the members it is for ------------------------------------------------------
create or replace function public.notify_on_new_meeting() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  aname text; msg text;
begin
  select name into aname from public.associations where id = new.association_id;
  msg := '<b>' || replace(replace(replace(new.meeting_type, '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || ':</b> '
      || replace(replace(replace(new.title, '&', '&amp;'), '<', '&lt;'), '>', '&gt;')
      || ' — ' || to_char(new.meeting_date, 'Mon DD, YYYY') || ' at '
      || replace(replace(replace(new.location, '&', '&amp;'), '<', '&lt;'), '>', '&gt;')
      || ' (' || coalesce(aname, 'all associations') || ').';
  insert into public.notifications (recipient_id, icon, message, category)
  select f.id, 'fa-people-roof', msg, 'announcement'
  from public.farmers f
  where f.is_association_member and (new.association_id is null or f.association_id = new.association_id);
  return new;
end;
$$;
drop trigger if exists trg_notify_on_new_meeting on public.meetings;
create trigger trg_notify_on_new_meeting after insert on public.meetings
  for each row execute function public.notify_on_new_meeting();
