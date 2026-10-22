-- ============================================================================
-- MIGRATION — Assistance records can come from the Department of Agriculture.
-- The admin now announces where each assistance comes from
-- (MAO / Department of Agriculture / Other Program); the application keeps it.
-- The old check only allowed MAO and Other Program. Safe to run more than once.
-- ============================================================================
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.assistance_records'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%source%'
  loop
    execute format('alter table public.assistance_records drop constraint %I', r.conname);
  end loop;
end;
$$;
alter table public.assistance_records
  add constraint assistance_records_source_check
  check (source in ('MAO', 'Department of Agriculture', 'Other Program'));
