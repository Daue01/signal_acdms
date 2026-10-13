# ACDMS – Automated Census Data Management System
Next.js 14 · React · TypeScript · Tailwind · Supabase (PostgreSQL + Auth + Realtime) · IndexedDB + Service Worker (PWA).
Implements prj_ch1-5 design: EA→Household→Individual hierarchy, role-based access (RLS), offline queue with ack-then-delete sync,
duplicate flagging for review, audit log, live progress dashboard.
## Run
1. Create a Supabase project; run `supabase/schema.sql`, then `002_hardening.sql`, `003_role_enforcement.sql`, and `004_citizen_accounts.sql` in the SQL editor (in that order, on a Supabase branch first). Enable email/password sign-ups in Auth settings if citizens and enumerators should self-register; otherwise keep sign-ups off and use invitations.
2. `cp .env.example .env.local` and fill URL + anon key.
3. `npm install && npm run dev` (production: `npm run build && npm start` behind HTTPS).
4. New accounts are created from `/login` as citizens or enumerators. Citizen profiles activate after email confirmation; enumerator profiles remain inactive until approved by an administrator. A profile is auto-created from the selected account type; administrators can manage roles, then create `enumeration_areas` and assign enumerators. Supabase Auth enforces one account per email.
## Not yet built (see Ch.5)
Admin CRUD screens for users/EAs, report exports, GIS/maps, biometrics, fuzzy name matching, load/pen testing, NDPA data-protection impact assessment.
Prototype only: use simulated data until a DPIA and security review are done.
