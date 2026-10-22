-- ============================================================================
-- MIGRATION — Farmers fill out the RSBSA Enrollment Form in their own account
--             and submit it to the ADMIN for validation.
--
--   * rsbsa_submissions : one row per submitted form (Pending / Approved / Returned)
--   * The ADMIN reviews it, may correct it, then Approves (the form is saved to the
--     farmer's record) or Returns it with remarks (the farmer fixes and resubmits).
--   * Notifications are automatic: admins are told about a new submission, and the
--     farmer is told when it is approved or returned.
-- Safe to run more than once.
-- ============================================================================
create table if not exists public.rsbsa_submissions (
  id           uuid primary key default gen_random_uuid(),
  farmer_id    uuid not null references public.farmers(id) on delete cascade,
  form         jsonb not null,
  status       text not null default 'Pending' check (status in ('Pending','Approved','Returned')),
  remarks      text,
  submitted_at timestamptz not null default now(),
  reviewed_by  uuid references public.profiles(id),
  reviewed_at  timestamptz
);
create index if not exists rsbsa_submissions_farmer_idx on public.rsbsa_submissions (farmer_id, submitted_at desc);
-- a farmer can only have ONE form waiting for review at a time
create unique index if not exists rsbsa_submissions_one_pending on public.rsbsa_submissions (farmer_id) where status = 'Pending';

alter table public.rsbsa_submissions enable row level security;

drop policy if exists "rsbsa_sub_select" on public.rsbsa_submissions;
create policy "rsbsa_sub_select" on public.rsbsa_submissions for select
  using (farmer_id = auth.uid() or public.is_staff());

drop policy if exists "rsbsa_sub_insert_own" on public.rsbsa_submissions;
create policy "rsbsa_sub_insert_own" on public.rsbsa_submissions for insert
  with check (farmer_id = auth.uid() and status = 'Pending');

drop policy if exists "rsbsa_sub_update_admin" on public.rsbsa_submissions;
create policy "rsbsa_sub_update_admin" on public.rsbsa_submissions for update
  using (public.current_role() = 'admin');

-- ---- automatic notifications ------------------------------------------------
create or replace function public.notify_rsbsa_submission() returns trigger
language plpgsql security definer set search_path = public as $$
declare who text;
begin
  if tg_op = 'INSERT' then
    select coalesce(full_name, 'A farmer') into who from public.profiles where id = new.farmer_id;
    insert into public.notifications (recipient_id, icon, message)
    select id, 'fa-file-signature', who || ' submitted an RSBSA Enrollment Form for validation.'
      from public.profiles where role = 'admin';
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'Approved' then
      insert into public.notifications (recipient_id, icon, message)
      values (new.farmer_id, 'fa-circle-check', 'Your RSBSA Enrollment Form was validated by the ADMIN.');
    elsif new.status = 'Returned' then
      insert into public.notifications (recipient_id, icon, message)
      values (new.farmer_id, 'fa-rotate-left',
              'Your RSBSA Enrollment Form was returned for corrections' || coalesce(': ' || new.remarks, '.') || ' Please fix it and submit again.');
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_rsbsa_submission on public.rsbsa_submissions;
create trigger trg_notify_rsbsa_submission
  after insert or update of status on public.rsbsa_submissions
  for each row execute function public.notify_rsbsa_submission();
