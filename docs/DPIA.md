# Data Protection Impact Assessment (DPIA)

Status: working template — incomplete and not approved for live personal-data collection.

This document must be completed by the data controller with the responsible privacy lead/DPO and, where appropriate, relevant users and processors. A DPIA should describe the processing, assess necessity and proportionality, identify risks to people, and document mitigations and residual-risk decisions. See the [ICO DPIA guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/guide-to-accountability-and-governance/data-protection-impact-assessments-dpias/) and the Nigeria Data Protection Commission resources before approval.

## 1. Ownership and approval

- Controller: **TBD**
- Processor(s), hosting and email providers: **TBD**
- Privacy lead/DPO: **TBD**
- Processing location and cross-border transfers: **TBD**
- Version/date: **TBD**
- Approval/signatures: **TBD**

## 2. Processing description

- Purpose: census/household enumeration, citizen intake, routing, quality review and aggregate reporting.
- Data subjects: citizens, household members, respondents, enumerators, supervisors and administrators.
- Data collected: names, age/date of birth, sex, address, household composition, housing, utilities, ownership, income band, vehicle count, location and account/audit metadata.
- Systems: browser IndexedDB, Service Worker cache, Supabase Auth/Postgres, API routes, email provider and administrator tools.
- Offline behavior: records may remain on a device until connectivity returns and a user or browser online event retries synchronization.
- Retention and deletion: **TBD**; specify local-device purge, server retention, backups and audit-log retention.

## 3. Necessity and proportionality

Document why each field is necessary, whether it can be optional or aggregated, the lawful basis under the applicable Nigerian/other law, consent wording, notices, withdrawal handling, and why offline collection is proportionate.

## 4. Risk register

| Risk | Likelihood | Severity | Mitigation/owner | Residual risk/status |
|---|---:|---:|---|---|
| Lost or stolen device exposes cached household data | TBD | High | Device encryption, OS lock, short session expiry, remote wipe/process, local purge | TBD |
| Incorrect EA/geography routes a household | Medium | High | Authoritative import, FK validation, review queue, correction workflow | Open |
| RLS or role mistake exposes another household/tenant | TBD | High | Policy tests, advisors, least privilege, review of SECURITY DEFINER functions | Open |
| Public intake abuse or automated submissions | High | Medium | CAPTCHA, rate limiting, monitoring and abuse response | Open until enabled |
| Duplicate or conflicting offline retries | Medium | Medium | Client UUID idempotency, atomic RPC, conflict review and sync logs | Open/test required |
| Email/account takeover | TBD | High | Verified email, secure recovery, session policy, SMTP and redirect review | Open |
| Excessive staff access to sensitive indicators | TBD | High | Separate table, reasoned lookup, audit, least privilege and training | Open |
| Retention/backups preserve data longer than necessary | TBD | High | Retention schedule, deletion jobs, backup expiry and restore controls | Open |

## 5. Required evidence before approval

- Completed geography validation and import record.
- Physical phone/tablet offline test results for every supported device/browser.
- Supabase RLS/advisor output and authenticated test matrix.
- SMTP, redirect, recovery and session configuration evidence.
- CAPTCHA/rate-limit evidence for public intake.
- Retention, data-subject rights, breach response and staff-access procedures.
- Controller/DPO approval and residual-risk acceptance.
