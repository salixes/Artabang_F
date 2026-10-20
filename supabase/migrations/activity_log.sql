-- ============================================================================
-- MIGRATION — Activity Log (all roles).
--
-- Records WHO did WHAT, WHEN and from WHICH DEVICE:
--   sign-ins / sign-outs / failed sign-ins, pages opened, and key actions.
-- * The browser sends the parsed device (browser, OS, device type, screen ...).
-- * The DATABASE adds what the browser can't be trusted with: the real IP
--   address, the raw user-agent and the time (so a log can't be backdated),
--   and flags a sign-in from a device that user hasn't used before.
-- * A user can only read THEIR OWN log. The admin can read everyone's.
-- * Log rows can't be edited or deleted from the app.
-- Safe to run more than once.
-- ============================================================================

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text,
  action text not null check (action in ('login','logout','login_failed','page_view','action')),
  category text,
  description text,
  page text,
  device_type text,
  browser text,
  os text,
  screen text,
  language text,
  timezone text,
  device_key text,
  user_agent text,
  ip_address text,
  is_new_device boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_activity_user_time on public.activity_log (user_id, created_at desc);
create index if not exists idx_activity_time on public.activity_log (created_at desc);
create index if not exists idx_activity_action on public.activity_log (action);

-- server-side fields + new-device detection
create or replace function public.activity_log_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  h json;
begin
  begin
    h := current_setting('request.headers', true)::json;   -- set by Supabase's API for every request
  exception when others then
    h := null;
  end;
  new.ip_address := nullif(trim(split_part(coalesce(h->>'cf-connecting-ip', h->>'x-forwarded-for', h->>'x-real-ip', ''), ',', 1)), '');
  new.user_agent := left(h->>'user-agent', 400);
  new.created_at := now();                                   -- can't be backdated
  new.role := (select p.role::text from public.profiles p where p.id = new.user_id);
  new.description := left(new.description, 300);
  new.page := left(new.page, 200);

  new.is_new_device := false;
  if new.action = 'login' and new.device_key is not null then
    -- a device this user has never signed in from, but only once they already have a history
    new.is_new_device := exists (select 1 from public.activity_log a where a.user_id = new.user_id and a.action = 'login')
                     and not exists (select 1 from public.activity_log a where a.user_id = new.user_id and a.action = 'login' and a.device_key = new.device_key);
  end if;
  return new;
end;
$$;
drop trigger if exists trg_activity_log_before_insert on public.activity_log;
create trigger trg_activity_log_before_insert before insert on public.activity_log
  for each row execute function public.activity_log_before_insert();

-- row level security: own rows for everyone, all rows for the admin; append-only
alter table public.activity_log enable row level security;
drop policy if exists "activity_select" on public.activity_log;
create policy "activity_select" on public.activity_log for select
  using (user_id = auth.uid() or public.current_role() = 'admin');
drop policy if exists "activity_insert_own" on public.activity_log;
create policy "activity_insert_own" on public.activity_log for insert
  with check (user_id = auth.uid() and action <> 'login_failed');

-- failed sign-in attempts happen BEFORE the user is signed in, so they come through here.
-- Only recorded when the e-mail belongs to a real account (no junk rows) and capped
-- at 10 per account per 10 minutes.
create or replace function public.log_login_failure(
  p_email text, p_device_type text default null, p_browser text default null, p_os text default null,
  p_screen text default null, p_language text default null, p_timezone text default null, p_device_key text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid;
begin
  select p.id into uid from public.profiles p where lower(p.email) = lower(trim(p_email)) limit 1;
  if uid is null then return; end if;
  if (select count(*) from public.activity_log a
      where a.user_id = uid and a.action = 'login_failed' and a.created_at > now() - interval '10 minutes') >= 10 then
    return;
  end if;
  insert into public.activity_log (user_id, action, category, description, device_type, browser, os, screen, language, timezone, device_key)
  values (uid, 'login_failed', 'security', 'Failed sign-in attempt (wrong password)',
          left(p_device_type, 40), left(p_browser, 60), left(p_os, 60), left(p_screen, 30), left(p_language, 20), left(p_timezone, 60), left(p_device_key, 160));
end;
$$;
revoke execute on function public.log_login_failure(text, text, text, text, text, text, text, text) from public;
grant execute on function public.log_login_failure(text, text, text, text, text, text, text, text) to anon, authenticated;
