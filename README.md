# ACDMS – Automated Census Data Management System
Next.js 14 · React · TypeScript · Tailwind · Supabase (PostgreSQL + Auth + Realtime) · IndexedDB + Service Worker (PWA).
Implements prj_ch1-5 design: EA→Household→Individual hierarchy, role-based access (RLS), offline queue with ack-then-delete sync,
duplicate flagging for review, audit log, live progress dashboard.
## Run
1. Create a Supabase project; run `supabase/schema.sql`, then `002_hardening.sql`, `003_role_enforcement.sql`, and `004_citizen_accounts.sql` in the SQL editor (in that order, on a Supabase branch first). Enable email/password sign-ups in Auth settings if citizens and enumerators should self-register.
2. Copy `.env.example` to `.env.local` and fill the URL plus publishable key (the legacy anon key is also supported).
3. `npm install && npm run dev` (production: `npm run build && npm start` behind HTTPS).
4. In Supabase Auth settings, keep email confirmation enabled and add `http://localhost:3000/auth/callback` (plus the production HTTPS callback URL) under Redirect URLs. Configure a production SMTP provider before relying on email delivery. The app’s callback returns users to the correct portal after confirmation.
5. Use `/login/citizen`, `/login/enumerator`, or `/login/administrator`. Citizen profiles activate after confirmation; enumerator profiles remain inactive until approved by an administrator. Supabase Auth enforces one account per email.
6. To bootstrap the first superadmin, create that user in Supabase Dashboard > Authentication > Users, copy the Auth user UUID, replace the placeholder in `supabase/005_superadmin_bootstrap.sql`, and run it once in the SQL editor. Do not expose a service-role key in the browser.
## Not yet built (see Ch.5)
Admin CRUD screens for users/EAs, report exports, GIS/maps, biometrics, fuzzy name matching, load/pen testing, NDPA data-protection impact assessment.
Prototype only: use simulated data until a DPIA and security review are done.
