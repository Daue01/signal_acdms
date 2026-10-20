# Security review status

Status: prototype review in progress — not a production approval.

## Scope reviewed

- Next.js client, API routes, IndexedDB queue and Service Worker.
- Supabase Auth, PostgreSQL schema, RLS policies, triggers and migrations.
- Citizen intake, enumerator capture, routing, search and aggregate reporting.

## Controls present

- Browser clients use publishable/anonymous Supabase keys; no service-role key belongs in the client.
- Role and active-account checks are enforced in PostgreSQL RLS, not only in React routing.
- Enumerator submissions use an idempotent client UUID and an atomic RPC.
- Sensitive household indicators are separated from the operational household table.
- Public status uses reference codes and aggregate suppression rather than exposing census rows.
- Sync failures observed by the server are centrally logged without granting failed users data access.

## Open findings before production

1. Run Supabase advisors and review every migration on a disposable branch and the production change plan.
2. Import an authoritative geography extract with `scripts/import-geography.mjs`; verify counts, duplicates, spelling and every EA `ward_id`.
3. Test the offline flow on each supported phone/tablet/browser over HTTPS. The current design is IndexedDB plus an online-event/manual retry; it is not full background sync.
4. Confirm Auth redirect URLs, confirmation email templates, SMTP delivery, account recovery and session expiry in the deployed environment.
5. Add automated authenticated/RLS tests for administrator, analyst, supervisor, enumerator, citizen, inactive and anonymous actors.
6. Review rate limiting and enforce CAPTCHA before enabling public intake in production.
7. Define retention, deletion, export, correction, breach response, support access and audit-log retention.
8. Complete and approve the DPIA in `docs/DPIA.md`; obtain the responsible organisation's data-protection sign-off.
9. Perform dependency, secret, HTTPS, headers, backup/restore, logging and incident-response checks in the deployment environment.

## Decision

The repository remains prototype-only until the open findings are evidenced as closed. Passing `npm run build` is not a security certification or device-compatibility result.
