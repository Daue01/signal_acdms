# ACDMS – Automated Census Data Management System
Next.js 14 · React · TypeScript · Tailwind · Supabase (PostgreSQL + Auth + Realtime) · IndexedDB + Service Worker (PWA).
Implements prj_ch1-5 design: EA→Household→Individual hierarchy, role-based access (RLS), offline queue with ack-then-delete sync,
duplicate flagging for review, audit log, live progress dashboard.
## Run
1. Create a Supabase project; run `supabase/schema.sql`, then `002_hardening.sql`, `003_role_enforcement.sql`, `004_citizen_accounts.sql`, `006_profile_trigger_repair.sql`, `007_citizen_submissions.sql`, `007a_add_analyst_role.sql`, `008_citizen_routing.sql`, and `009_refresh_geography.sql` in the SQL editor (in that order, on a Supabase branch first). For an existing project that already ran the earlier scripts, run the missing scripts in order, ending with `009_refresh_geography.sql` after enumeration areas have been imported.
2. Copy `.env.example` to `.env.local` and fill the URL plus publishable key (the legacy anon key is also supported).
3. `npm install && npm run dev` (production: `npm run build && npm start` behind HTTPS).
4. In Supabase Auth settings, enable email/password sign-ups and keep email confirmation enabled. Add `http://localhost:3000/auth/callback` (plus the production HTTPS callback URL) under Redirect URLs. In the Confirm signup email template, keep the link as `<a href="{{ .ConfirmationURL }}">Confirm email address</a>`; if using a custom link, do not replace it with `{{ .SiteURL }}` because that always points to the configured Vercel Site URL. Configure a production SMTP provider before relying on email delivery. The app’s callback returns users to the correct portal after confirmation.
5. Citizens can register at `/login/citizen` without administrator approval. They must verify their email before signing in; after sign-in they land on their distinct dashboard at `/citizen`. Public submissions can be made at `/citizen/form` without login, then tracked with the reference code at `/citizen/status`; server-side routing sends resolvable entries to the assigned enumerator and unresolved entries to the administrator queue. Enumerator profiles remain inactive until an administrator approves them in the control room. Supabase Auth enforces one account per email.
6. To bootstrap the first superadmin, create that user in Supabase Dashboard > Authentication > Users, copy the Auth user UUID, replace `REPLACE_WITH_AUTH_USER_UUID` in `supabase/005_superadmin_bootstrap.sql`, and run it once in the SQL editor. Do not expose a service-role key in the browser.
## Not yet built (see Ch.5)
Report exports beyond enumeration progress, GIS/maps, biometrics, fuzzy name matching, load/pen testing, NDPA data-protection impact assessment.
Prototype only: use simulated data until a DPIA and security review are done.

## Citizen routing and geography module

Run `supabase/007a_add_analyst_role.sql` after `007_citizen_submissions.sql`, then `supabase/008_citizen_routing.sql` and `supabase/009_refresh_geography.sql`, on a Supabase branch first. The routing migration preserves existing households and individuals while adding:

- public, rate-limited citizen submission through `/api/citizen/submit`, with server-side Zod and geography-ID validation;
- cascading State → LGA → Ward controls at `/citizen/form`, reference-code status tracking at `/citizen/status`, and geography-only downloads at `/geography`;
- server-side EA routing to an active enumerator, an administrator resolution queue, and enumerator review at `/enumerator/review`;
- assignment history, status-change audit records, aggregate-only population counts, small-count suppression, and `pg_trgm` search through the admin console.

The public submission route has a CAPTCHA hook controlled by `CAPTCHA_VERIFY_URL`, `CAPTCHA_SECRET_KEY`, and `CAPTCHA_REQUIRED=true`. Keep CAPTCHA required before production use. The current repository does not contain the requested `docs/EA_MODULE.md`; the existing SQL migrations and application code were used as the compatibility reference.

Real geography still needs to be imported and verified. Do not use synthetic EA identifiers for official census reporting. The public form also collects sensitive housing, wealth and service indicators; complete a DPIA and agree retention/access rules before collecting real data.

The analyst role is added by `supabase/007a_add_analyst_role.sql`, which must be run after migration 007 and before migration 008 because PostgreSQL enum values must be committed before they are referenced.
