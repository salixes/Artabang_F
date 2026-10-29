-- ============================================================================
-- MIGRATION — Sessions: terminate a session / log out all devices (Activity Log).
--
--   * public.user_sessions   one row per signed-in browser/device
--   * terminate_session(id)               end ONE session (yours; the admin can end anyone's)
--   * terminate_other_sessions(keep)      end every session except this device
--   * logout_all_devices()                end every session of yours
--   * admin_terminate_user_sessions(user) the admin ends all sessions of a user
-- Each action is also written to the Activity Log (category 'session').
-- A device whose session was ended signs itself out within about 20 seconds.
-- Safe to run more than once.
-- ============================================================================
create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  session_key text not null,
  device_key text, device_type text, browser text, os text, screen text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ended_at timestamptz,
  ended_by uuid references public.profiles(id) on delete set null,
  end_reason text check (end_reason in ('logout', 'terminated', 'logout_all', 'admin')),
  unique (user_id, session_key)
);
create index if not exists idx_user_sessions_user on public.user_sessions (user_id, created_at desc);

alter table public.user_sessions enable row level security;
drop policy if exists "sessions_select" on public.user_sessions;
create policy "sessions_select" on public.user_sessions for select
  using (user_id = auth.uid() or public.current_role() = 'admin');
drop policy if exists "sessions_insert_own" on public.user_sessions;
create policy "sessions_insert_own" on public.user_sessions for insert with check (user_id = auth.uid());
drop policy if exists "sessions_update" on public.user_sessions;
create policy "sessions_update" on public.user_sessions for update
  using (user_id = auth.uid() or public.current_role() = 'admin')
  with check (user_id = auth.uid() or public.current_role() = 'admin');

-- helper: write a session action into the activity log of the affected user
create or replace function public._session_log(p_user uuid, p_text text) returns void
language sql security definer set search_path = public as $$
  insert into public.activity_log (user_id, action, category, description, page)
  values (p_user, 'action', 'session', p_text, '/activity-log');
$$;
revoke all on function public._session_log(uuid, text) from public;

create or replace function public.terminate_session(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s public.user_sessions; mine boolean;
begin
  select * into s from public.user_sessions where id = p_id and ended_at is null;
  if not found then return; end if;
  mine := s.user_id = auth.uid();
  if not mine and public.current_role() is distinct from 'admin' then raise exception 'Not allowed'; end if;
  update public.user_sessions
     set ended_at = now(), ended_by = auth.uid(), end_reason = case when mine then 'terminated' else 'admin' end
   where id = p_id;
  perform public._session_log(s.user_id,
    case when mine then 'Terminated a session on ' else 'An admin terminated a session on ' end
    || coalesce(s.browser, 'a device') || ' · ' || coalesce(s.os, ''));
end;
$$;

create or replace function public.terminate_other_sessions(p_keep text) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update public.user_sessions
     set ended_at = now(), ended_by = auth.uid(), end_reason = 'terminated'
   where user_id = auth.uid() and ended_at is null and session_key is distinct from p_keep;
  get diagnostics n = row_count;
  if n > 0 then perform public._session_log(auth.uid(), 'Terminated ' || n || ' other session' || case when n = 1 then '' else 's' end); end if;
  return n;
end;
$$;

create or replace function public.logout_all_devices() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update public.user_sessions
     set ended_at = now(), ended_by = auth.uid(), end_reason = 'logout_all'
   where user_id = auth.uid() and ended_at is null;
  get diagnostics n = row_count;
  perform public._session_log(auth.uid(), 'Logged out all devices');
  return n;
end;
$$;

create or replace function public.admin_terminate_user_sessions(p_user uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if public.current_role() is distinct from 'admin' then raise exception 'Only the admin can do this'; end if;
  update public.user_sessions
     set ended_at = now(), ended_by = auth.uid(), end_reason = 'admin'
   where user_id = p_user and ended_at is null;
  get diagnostics n = row_count;
  if n > 0 then perform public._session_log(p_user, 'An admin ended all your sessions (' || n || ')'); end if;
  return n;
end;
$$;

revoke all on function public.terminate_session(uuid), public.terminate_other_sessions(text),
  public.logout_all_devices(), public.admin_terminate_user_sessions(uuid) from public;
grant execute on function public.terminate_session(uuid), public.terminate_other_sessions(text),
  public.logout_all_devices(), public.admin_terminate_user_sessions(uuid) to authenticated;
