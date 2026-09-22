# AgriTabang — React + Tailwind + Supabase

This is your original AgriTabang system (Farmer Profiling & Assistance Management),
converted to **React + Tailwind CSS + Supabase**, with the original design, colors,
layout, and modules preserved.

## What's real vs. what you still need to do

Every button, form, and table in this app talks to a real Supabase table — there
are no fake "Success" messages and no hard-coded numbers. But **you** still need to:

1. Create a Supabase project and run the provided SQL (this also creates your
   ADMIN and Association President logins — see step 6).
2. Deploy two small Edge Functions (used only for admin-created farmer accounts).

Follow the steps below in order.

---

## 1. Create a Supabase project

Go to [supabase.com](https://supabase.com), create a new project, and note down:
- **Project URL** (Settings → API)
- **anon public key** (Settings → API)

## 2. Run the database schema

Open **SQL Editor → New query** in your Supabase dashboard, paste the entire
contents of `supabase/schema.sql`, and run it. This creates every table,
relationship, Row Level Security policy, the two-step profile-approval trigger,
the `avatars` storage bucket, and seed data (crop prices, default associations).

It's safe to re-run if you make edits later.

> **If the SQL errors out on the `auth.identities` insert** (schema differs
> slightly between Supabase Postgres versions), skip that block and instead
> create the two accounts manually: **Authentication → Users → Add user**
> (check "Auto Confirm User") for each email/password above, then insert a
> matching row in **Table Editor → profiles** with the same `id`, `role`
> (`admin` or `president`), `full_name`, and `email`.

## 3. Deploy the Edge Functions

Account creation/deletion needs Supabase's `service_role` key, which must never
ship in the frontend — so it lives in two small server-side functions instead.

```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR-PROJECT-REF
supabase functions deploy admin-create-user
supabase functions deploy admin-delete-user
```

No extra configuration needed — Supabase automatically provides
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions.

## 4. Configure the frontend

```bash
cp .env.example .env
```

Edit `.env`:
```
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

## 5. Install and run

```bash
npm install
npm run dev
```

Open the printed local URL (usually `http://localhost:5173`).

## 6. Log in

The schema seeds two accounts for you automatically:

| Role | Email | Password |
|---|---|---|
| ADMIN | `admin@agritabang.ph` | `Admin123` |
| Association President | `president@agritabang.ph` | `president123` |

**Change these passwords after first login** (Supabase Dashboard → Authentication →
Users → select the user → Reset password), especially before deploying anywhere
real users can reach it.

From the ADMIN account, use **Farmer Profiling → Add Farmer** to create farmer
accounts — this uses the `admin-create-user` Edge Function, so each farmer gets
a real Supabase Auth login plus a matching profile/farmer record automatically.

---

## Project structure

```
src/
├── components/     Sidebar, Topbar, Layout, Modal, ProtectedRoute, badges
├── context/        AuthContext (Supabase session/role), ToastContext
├── lib/            supabaseClient.js, businessRules.js (ported calc/rules)
├── pages/
│   ├── auth/       Login
│   ├── farmer/     11 fully-wired farmer modules
│   ├── admin/      Dashboard, Farmer Profiling, Requests, Yield, Insurance,
│   │               Assistance, Announcements
│   ├── president/  Dashboard, Validation, Crops, Allocation, Qualification,
│   │               Assistance Distribution, Policies, Meetings, Requests
│   └── shared/     Association, Reports, StaffProfile, Settings — reused by
│                   both ADMIN and President with role-based behavior
supabase/
├── schema.sql              Run this once in the SQL editor
└── functions/
    ├── admin-create-user/  Creates auth user + profile + farmer row
    └── admin-delete-user/  Deletes a user account
```

## RSBSA Enrollment

**Farmer Profiling → Add Farmer** now matches the official **RSBSA (Registry
System for Basic Sectors in Agriculture)** enrollment form used by the
Department of Agriculture — all 4 parts (Personal Information, Livelihood
Profile, Farm Parcel Information, Consent) — instead of a simplified form.

From any farmer's card, **View Details → View/Print RSBSA Form** renders the
official form layout populated with that farmer's real data, ready to print
(a "2x2 PICTURE" box and signature lines are left blank for the physical copy,
matching the paper form).

If you already ran an earlier version of `schema.sql`, just **re-run the
whole file again** — the new RSBSA columns are added via `ALTER TABLE ... ADD
COLUMN IF NOT EXISTS`, so it won't touch your existing data.

## How key business rules were preserved

- **Two-step profile approval**: a farmer's edit is stored in
  `profile_update_requests`. A **Postgres trigger** (not frontend code)
  applies the change automatically the moment *both* President and ADMIN
  approve — so it's correct no matter who approves last, and cannot be
  bypassed from the client.
- **Insurance coverage estimate** and the **automatic qualification checks**
  for each assistance type are ported 1:1 from the original `script.js` into
  `src/lib/businessRules.js`, now computed from real Supabase data (crop
  prices, verified yield, association membership, etc.) instead of the demo
  arrays.
- **Row Level Security** enforces on the database itself that a farmer can
  only ever see/edit their own records, and that only ADMIN/President can
  see everything — this holds even if someone bypasses the React app
  entirely and calls the Supabase API directly.

## Known follow-ups

- The chunk-size build warning (`670 kB` JS bundle) is cosmetic; splitting
  `chart.js` into a lazy-loaded chunk would trim it if you care about initial
  load time.
- `Association`/`Meetings` currently match farmers to associations by
  `association_name` text match against `associations.name` (via the
  `farmer_directory` view) — this is fine for the current 2-association setup
  but if you expect associations to be renamed often, join on `association_id`
  directly instead.
- Real-time UI updates are wired for notifications (Supabase Realtime). Other
  tables refetch after each action rather than subscribing live — add
  `.channel()` subscriptions the same way if you want e.g. the admin Farmers
  grid to update the instant a *different* logged-in admin edits a record.
