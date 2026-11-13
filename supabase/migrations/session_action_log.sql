-- ============================================================================
-- MIGRATION — Activity Log (admin): record the ACTION TAKEN when a session is terminated
-- or when someone logs out of all devices.
--
--   * every session action is written with the device that was affected
--     (browser, system, device type, screen), so the admin can see which one
--   * when the ADMIN ends someone's session(s), TWO entries are written:
--       - under the affected user:  "Session ended by admin <name> on <device>"
--       - under the admin:          "Terminated a session of <name> on <device>"
--   * a user terminating his / her own sessions or logging out of all devices is
--     written under that user ("Terminated a session on …", "Logged out all devices (n)")
-- The admin finds them in Activity Log > All activity (filters: Terminated sessions /
-- Logged out all devices). Run AFTER user_sessions.sql. Safe to run more than once.
-- ============================================================================

-- write one session action; copies the device of the session it is about
create or replace function public._session_log(p_user uuid, p_text text, p_session uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare s public.user_sessions;
begin
  if p_session is not null then select * into s from public.user_sessions where id = p_session; end if;
  insert into public.activity_log (user_id, action, category, description, page, device_type, browser, os, screen, device_key)
  values (p_user, 'action', 'session', p_text, '/activity-log', s.device_type, s.browser, s.os, s.screen, s.device_key);
end;
$$;
revoke all on function public._session_log(uuid, text, uuid) from public;

create or replace function public._person_name(p_id uuid) returns text
language sql security definer set search_path = public as $$
  select coalesce(nullif(trim(full_name), ''), email, 'a user') from public.profiles where id = p_id;
$$;
revoke all on function public._person_name(uuid) from public;

create or replace function public.terminate_session(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s public.user_sessions; mine boolean; dev text;
begin
  select * into s from public.user_sessions where id = p_id and ended_at is null;
  if not found then return; end if;
  mine := s.user_id = auth.uid();
  if not mine and public.current_role() is distinct from 'admin' then raise exception 'Not allowed'; end if;
  update public.user_sessions
     set ended_at = now(), ended_by = auth.uid(), end_reason = case when mine then 'terminated' else 'admin' end
   where id = p_id;
  dev := coalesce(s.browser, 'a device') || coalesce(' · ' || s.os, '');
  if mine then
    perform public._session_log(s.user_id, 'Terminated a session on ' || dev, p_id);
  else
    perform public._session_log(s.user_id, 'Session ended by admin ' || public._person_name(auth.uid()) || ' on ' || dev, p_id);
    perform public._session_log(auth.uid(), 'Terminated a session of ' || public._person_name(s.user_id) || ' on ' || dev, p_id);
  end if;
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
  perform public._session_log(auth.uid(), 'Logged out all devices (' || n || ' session' || case when n = 1 then '' else 's' end || ' ended)');
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
  if n > 0 then
    perform public._session_log(p_user, 'All sessions ended by admin ' || public._person_name(auth.uid()) || ' (' || n || ')');
    perform public._session_log(auth.uid(), 'Terminated all sessions of ' || public._person_name(p_user) || ' (' || n || ')');
  end if;
  return n;
end;
$$;

revoke all on function public.terminate_session(uuid), public.terminate_other_sessions(text),
  public.logout_all_devices(), public.admin_terminate_user_sessions(uuid) from public;
grant execute on function public.terminate_session(uuid), public.terminate_other_sessions(text),
  public.logout_all_devices(), public.admin_terminate_user_sessions(uuid) to authenticated;
