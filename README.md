# ACDMS – Automated Census Data Management System
Next.js 14 · React · TypeScript · Tailwind · Supabase (PostgreSQL + Auth + Realtime) · IndexedDB + Service Worker (PWA).
Implements prj_ch1-5 design: EA→Household→Individual hierarchy, role-based access (RLS), offline queue with ack-then-delete sync,
duplicate flagging for review, audit log, live progress dashboard.
## Run
1. Create a Supabase project; run `supabase/schema.sql`, then `002_hardening.sql`, `003_role_enforcement.sql`, `004_citizen_accounts.sql`, `006_profile_trigger_repair.sql`, and `007_citizen_submissions.sql` in the SQL editor (in that order, on a Supabase branch first). For an existing project that already ran the earlier scripts, run `006_profile_trigger_repair.sql` and then `007_citizen_submissions.sql`.
2. Copy `.env.example` to `.env.local` and fill the URL plus publishable key (the legacy anon key is also supported).
3. `npm install && npm run dev` (production: `npm run build && npm start` behind HTTPS).
4. In Supabase Auth settings, enable email/password sign-ups and keep email confirmation enabled. Add `http://localhost:3000/auth/callback` (plus the production HTTPS callback URL) under Redirect URLs. In the Confirm signup email template, keep the link as `<a href="{{ .ConfirmationURL }}">Confirm email address</a>`; if using a custom link, do not replace it with `{{ .SiteURL }}` because that always points to the configured Vercel Site URL. Configure a production SMTP provider before relying on email delivery. The app’s callback returns users to the correct portal after confirmation.
5. Citizens can register at `/login/citizen` without administrator approval. They must verify their email before signing in; after sign-in they land on their distinct dashboard at `/citizen`, where they can track household submissions or open `/citizen/form` to submit one. Submissions stay pending until an administrator reviews them and approves them into a matching enumeration area. Enumerator profiles remain inactive until an administrator approves them in the control room. Supabase Auth enforces one account per email.
6. To bootstrap the first superadmin, create that user in Supabase Dashboard > Authentication > Users, copy the Auth user UUID, replace `REPLACE_WITH_AUTH_USER_UUID` in `supabase/005_superadmin_bootstrap.sql`, and run it once in the SQL editor. Do not expose a service-role key in the browser.
## Not yet built (see Ch.5)
Report exports beyond enumeration progress, GIS/maps, biometrics, fuzzy name matching, load/pen testing, NDPA data-protection impact assessment.
Prototype only: use simulated data until a DPIA and security review are done.
