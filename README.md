# ACDMS – Automated Census Data Management System
Next.js 14 · React · TypeScript · Tailwind · Supabase (PostgreSQL + Auth + Realtime) · IndexedDB + Service Worker (PWA).
Implements prj_ch1-5 design: EA→Household→Individual hierarchy, role-based access (RLS), offline queue with ack-then-delete sync,
duplicate flagging for review, audit log, live progress dashboard.
## Run
1. Create a Supabase project; run `supabase/schema.sql`, then `002_hardening.sql`, `003_role_enforcement.sql`, `004_citizen_accounts.sql`, `006_profile_trigger_repair.sql`, `007_citizen_submissions.sql`, `007a_add_analyst_role.sql`, `008_citizen_routing.sql`, `009_refresh_geography.sql`, `010_sync_attempt_logging.sql`, `011_geography_import_metadata.sql`, `012a_add_state_admin_role.sql`, `012b_state_admin_access.sql`, and `supabase/migrations/20261021021600_npc01_questionnaire_responses.sql` in the SQL editor (in that order, on a Supabase branch first). For an existing project that already ran the earlier scripts, run the missing scripts in order. `009_refresh_geography.sql` only refreshes lookup rows from existing EAs; use the reproducible importer below for an authoritative geography extract.
2. Copy `.env.example` to `.env.local` and fill the public URL plus publishable key (the legacy anon key is also supported). Public household intake also needs the server-only `SUPABASE_URL` and `SUPABASE_SECRET_KEY`; the legacy `SUPABASE_SERVICE_ROLE_KEY` remains supported for existing deployments. Never prefix the secret key with `NEXT_PUBLIC_` or commit it.
3. `npm install && npm run dev` (production: `npm run build && npm start` behind HTTPS).
4. The supplied reference files contain 37 states/territories, 774 LGAs, 7,740 synthetic demo wards, and 38,700 synthetic demo EAs. To sync the State/LGA/reference-Ward lists without touching EAs, add the server-only `ACDMS_DATABASE_URL` and `ACDMS_DATABASE_SSL_CA_FILE` values to the ignored `.env.local` file, then run `npm run geography:sync:dry-run` followed by `npm run geography:sync`. The first command rolls back; the second safely merges reference rows and synthetic demo wards, leaving existing EAs untouched. The importer never logs the connection string or CA path. The supplied wards are not official and must not be used for census reporting; the app keeps real record creation/submission disabled until verified ward data is loaded.
5. In Supabase Auth settings, enable email/password sign-ups and keep email confirmation enabled. Add `http://localhost:3000/auth/callback` (plus the production HTTPS callback URL) under Redirect URLs. In the Confirm signup email template, keep the link as `<a href="{{ .ConfirmationURL }}">Confirm email address</a>`; if using a custom link, do not replace it with `{{ .SiteURL }}` because that always points to the configured Vercel Site URL. Configure a production SMTP provider before relying on email delivery. The app’s callback returns users to the correct portal after confirmation.
6. Citizens can register at `/login/citizen` without administrator approval. They must verify their email before signing in; after sign-in they land on their distinct dashboard at `/citizen`. Public submissions can be made at `/citizen/form` without login, then tracked with the reference code at `/citizen/status`; server-side routing sends resolvable entries to the assigned enumerator and unresolved entries to the administrator queue. Enumerator profiles remain inactive until an administrator approves them in the control room. Supabase Auth enforces one account per email.
7. To bootstrap the first superadmin, create that user in Supabase Dashboard > Authentication > Users, copy the Auth user UUID, replace `REPLACE_WITH_AUTH_USER_UUID` in `supabase/005_superadmin_bootstrap.sql`, and run it once in the SQL editor. Do not expose a service-role key in the browser.
## Not yet built (see Ch.5)
Report exports beyond enumeration progress, GIS/maps, biometrics, fuzzy name matching, load/pen testing, NDPA data-protection impact assessment.
Prototype only: use simulated data until the security review and DPIA are completed and signed off. See `docs/SECURITY_REVIEW.md` and `docs/DPIA.md`.

## Citizen routing and geography module

Run `supabase/007a_add_analyst_role.sql` after `007_citizen_submissions.sql`, then `supabase/008_citizen_routing.sql` and `supabase/009_refresh_geography.sql`, on a Supabase branch first. The routing migration preserves existing households and individuals while adding:

- public, rate-limited citizen submission through `/api/citizen/submit`, with server-side Zod and geography-ID validation;
- cascading State → LGA → Ward controls at `/citizen/form`, reference-code status tracking at `/citizen/status`, and geography-only downloads at `/geography`;
- NPC 01-aligned sections on citizen and enumerator household forms, with household and individual responses captured for demographics, social characteristics, education, work, migration, ICT, functional difficulties, fertility, mortality, housing and sanitation. These prompts are original adaptations of the sections listed on the official NPC page, not a verbatim reproduction of the questionnaire. Apply `supabase/migrations/20261021021600_npc01_questionnaire_responses.sql` to persist the structured responses in the normalized household and individual records;
- server-side EA routing to an active enumerator, an administrator resolution queue, and enumerator review at `/enumerator/review`;
- administrator assignment controls that can assign or reassign multiple EAs in one state to an active enumerator, with current ownership shown before changes; assignment history, status-change audit records, aggregate-only population counts, small-count suppression, and `pg_trgm` search through the admin console.

The public submission route has a CAPTCHA hook controlled by `CAPTCHA_VERIFY_URL`, `CAPTCHA_SECRET_KEY`, and `CAPTCHA_REQUIRED=true`. Keep CAPTCHA required before production use. The current repository does not contain the requested `docs/EA_MODULE.md`; the existing SQL migrations and application code were used as the compatibility reference.

### Netlify deployment variables

In the Netlify site settings, add these variables for the production deploy context, then redeploy:

- `NEXT_PUBLIC_SUPABASE_URL` — the Supabase project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — the browser-safe publishable key
- `SUPABASE_URL` — the same project URL, server-only
- `SUPABASE_SECRET_KEY` — the server-only secret key from Supabase Dashboard → Settings → API Keys

Do not put `SUPABASE_SECRET_KEY` in the browser or in source control. `SUPABASE_SERVICE_ROLE_KEY` can be used instead only for a legacy deployment that has not migrated its server key.

### State administrators

A system administrator can assign an enumerator the **State administrator** role from the control room, after assigning that profile to a state. Only one state administrator can be designated per state. State administrators sign in through the Admin or Enumerator portal and land on a state-scoped control room where they can approve/deactivate enumerators assigned to their state and assign/reassign that state's EAs. They retain the Enumerator capture form and can submit data only for EAs assigned to their account. They cannot change roles, move accounts between states, or access global admin tools or cross-state census records. Existing enumerator state scopes are backfilled when their assigned EAs all belong to one known state; set a state manually in the system-admin account table for ambiguous or unassigned enumerators.

Apply `012a_add_state_admin_role.sql` and then `012b_state_admin_access.sql` after migration 011. The second script adds database-enforced row and update guards; do not grant state-admin permissions by changing only the client UI.

Real geography still needs to be imported and verified. Do not use synthetic EA identifiers for official census reporting. The public form also collects sensitive housing, wealth and service indicators; complete a DPIA and agree retention/access rules before collecting real data.

## Offline and synchronisation limits

The enumerator client stores pending submissions in IndexedDB and retries them when the browser reports an `online` event or when the user presses **Sync**. The Service Worker caches the application shell and GET responses. This is not full background sync: the browser may stop JavaScript, evict storage, or delay the online event. A physical phone/tablet test is still required over HTTPS: load the assigned EA online, switch to airplane mode, save an interview, reload while offline, restore connectivity, press **Sync**, and verify one server row and one successful `sync_log` row. Do not claim this test is complete until it has been run on the target devices.

The server records authenticated, server-observed sync attempts, including validation and RPC failures, in `sync_log`. A submission that fails before the device can reach the server remains a local failure and cannot be centrally logged until a later retry reaches the server.

The analyst role is added by `supabase/007a_add_analyst_role.sql`, which must be run after migration 007 and before migration 008 because PostgreSQL enum values must be committed before they are referenced.
