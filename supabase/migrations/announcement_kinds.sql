-- ============================================================================
-- MIGRATION — One "Announcements" page for every kind of announcement.
--
--   * announcements.kind            General / Alert / Event
--   * assistance_announcements.details   what the program gives (amount, seed
--                                         type, quantity ... per kind of assistance)
--   * assistance_records.details         what was actually released to the farmer
--
-- The separate "Assistance Announcement" page is removed in the app; assistance
-- is now posted from Announcements (kind = Assistance) and still reaches each
-- matching farmer's Eligibility page. Safe to run more than once.
-- ============================================================================
alter table public.announcements add column if not exists kind text not null default 'General';
alter table public.announcements drop constraint if exists announcements_kind_check;
alter table public.announcements add constraint announcements_kind_check check (kind in ('General','Alert','Event'));

-- keep the kind of announcements that were already posted (they only had an icon)
update public.announcements
   set kind = case icon when 'fa-triangle-exclamation' then 'Alert' when 'fa-calendar-days' then 'Event' else 'General' end
 where kind = 'General' and icon in ('fa-triangle-exclamation', 'fa-calendar-days');

alter table public.assistance_announcements add column if not exists details jsonb not null default '{}'::jsonb;
alter table public.assistance_records        add column if not exists details jsonb not null default '{}'::jsonb;
