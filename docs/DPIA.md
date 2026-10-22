# Data Protection Impact Assessment (DPIA) — working draft

**Status:** Draft for controller and privacy-lead review. Not approved for live personal-data collection.
**Version:** 0.2
**Prepared:** 21 October 2026
**Decision:** Do not use this prototype to collect real household or census data until this assessment is completed, the listed release gates are evidenced, and the controller's authorised approver records a decision.

> This is a technical project draft, not legal advice, a determination of lawful basis, or a substitute for the controller's DPIA. The controller and its privacy lead/DPO must verify the processing against the Nigeria Data Protection Act 2023, applicable NDPC instruments and guidance, contracts, and the actual deployment. A banner in the application and this draft do not constitute approval.

## 1. Ownership, consultation, and decision

Complete every item before approval. Do not substitute the software developer for the controller.

| Item | Draft position |
|---|---|
| Data controller and contact details | **TBD — responsible organisation and contact** |
| Controller's purpose and authority to conduct this enumeration | **TBD — document mandate and define whether this is an official census, a pilot, or another activity** |
| Joint controllers, if any | **TBD** |
| Processor(s) and subprocessors | Supabase (Auth and Postgres) is configured by the application; hosting, email/SMTP, CAPTCHA provider, monitoring, backup, and support providers depend on deployment and are **TBD** |
| Privacy lead / DPO and contact details | **TBD** |
| Processing location, transfers, and transfer safeguards | **TBD — verify project region, hosting, backups, support access, email, CAPTCHA, and all subprocessors from contracts and deployment settings** |
| People consulted | **TBD — include representatives of affected communities, field enumerators, administrators, and the privacy lead as appropriate** |
| Assessment owner and review date | **TBD** |
| Approval and residual-risk decision | **TBD — name, role, date, decision, and any required escalation** |

## 2. Processing overview

### Purpose and context

The prototype supports household intake, enumeration, offline capture and later synchronisation, assignment of enumeration areas (EAs), citizen-submission routing and review, data-quality checks, audit, and aggregate reporting. Its current wording and questionnaire are adaptations; the application must not be represented as an official NPC system or an officially approved questionnaire without written authority.

The intended production purpose, necessity of each field, population, geography, collection period, and relationship to any official census programme are **not yet approved or fully specified**. The controller must define these before collection.

### People whose data may be processed

- Household respondents and other household members, including children.
- People who submit a citizen intake form and people named or described in that form.
- Enumerators and other staff with accounts, assignments, review, and audit activity.

### Categories of data in the current prototype

- **Identity and household:** names, household relationships and composition, sex, age and optional date of birth, address, locality, and optional latitude/longitude in citizen intake.
- **Person-level questionnaire:** marital status, literacy and education, employment, occupation and industry, migration and place of birth, technology use, functional difficulties/disability-related responses, fertility and child-survival responses, religion, and ethnicity. Some of these may be sensitive or otherwise high-impact personal data; the controller/DPO must determine classification and applicable conditions before processing.
- **Household characteristics and indicators:** building and material details, rooms, tenure, water, toilet, wastewater, waste disposal, cooking fuel, lighting, utilities, electricity access, water access, cars, and an optional income band.
- **Account and operational:** Auth account identifiers and email managed by Supabase Auth, profile name/role/active status/state assignment, EA assignment, submission references and status, consent record/timestamp, sync outcomes, and security/audit events.
- **Technical/device:** browser-held pending submissions in IndexedDB and browser application/cache data. Exact fields and cache lifetime must be verified on supported devices.

The controller should confirm the complete field inventory from the live forms, APIs, database schema, logs, and vendors before approving this assessment. Do not collect national identity numbers, biometrics, or other unlisted information unless the DPIA is updated first.

### Data flow and systems

1. A respondent submits the public citizen form without an account, or an authenticated enumerator records a household in the field.
2. The browser validates form data. The enumerator workflow may retain a pending submission in IndexedDB while offline and retry after connectivity returns or when the enumerator requests sync.
3. Public submissions are sent to an application API and routed for review; authenticated enumerator sync calls a server API and an atomic database RPC.
4. Supabase Auth manages staff/citizen accounts; Supabase Postgres stores profiles, EAs, household/member records, citizen submissions, indicators, aggregates, sync logs, and audit events. Row-level security and database functions enforce parts of the access model.
5. Admin tools support account/role and EA management, submission resolution, audit, and aggregate reporting. State administrators are designed to see/manage enumerators and EA assignments within their assigned state; they retain field-capture access only for EAs assigned to them.
6. Confirmation messages and optional CAPTCHA verification depend on production email and CAPTCHA configuration. Their providers and data flows must be documented by the controller.

The actual hosting topology, encryption configuration, backup/replica locations, vendor access, logs, deletion propagation, and international transfers are **not verified by this repository**. Confirm them in the deployed service and processor contracts.

### Recipients and access

The intended least-privilege model is that enumerators access only assigned EAs and their own capture workflow; system administrators manage the platform; analysts use aggregate/authorised reporting; and state administrators manage enumerators and assignments in one state. The application includes role/RLS controls, but those controls have not been independently tested against a complete production-role matrix. Confirm the effective policies, grants, functions, views, and client queries on a Supabase branch and in the deployed project.

The application does not establish, by itself, which organisation or public authority may lawfully receive or use the data. Recipient categories, onward disclosures, research use, publication, and any linkage with other datasets are **TBD and must be approved before collection**.

### Retention and deletion

No approved retention schedule or complete deletion workflow is established in this draft. The controller must set separate retention periods and deletion procedures for:

- live household, individual, submission, and indicator records;
- rejected, unresolved, duplicate, and corrected submissions;
- account/profile data, authentication records, and access/audit logs;
- local offline queues, browser caches, exports/downloads, and lost-device scenarios;
- database backups, replicas, provider logs, and disaster-recovery copies.

Document who authorises deletion, how deletion is verified, what is retained for legal/accountability reasons, and how restores do not silently reintroduce deleted personal data.

## 3. Necessity, proportionality, and lawful basis

The prototype's presence of a required consent checkbox is not, by itself, a lawful-basis determination or a complete privacy notice. The controller must identify and document the lawful basis and any additional condition required for sensitive personal data under applicable law, and ensure the wording, purpose, data-subject rights, and withdrawal/objection handling are appropriate to that basis and to the controller's actual mandate.

Before approval, complete a field-by-field necessity review:

| Field group | Draft necessity question / minimisation action |
|---|---|
| Names, age/date of birth, sex, household relationships | Explain why each identifier is needed; prefer age over full date of birth if birth date is not required; restrict access and exports. |
| Address, locality, optional coordinates | Use the least precise location that supports the approved purpose; keep GPS optional unless justified; define access, accuracy, retention, and whether it is removed from reporting datasets. |
| Religion and ethnicity | Confirm authority, necessity, sensitivity classification, lawful conditions, notice, access restrictions, and a safe “prefer not to answer” option. Do not require an answer without a documented need. |
| Disability-related difficulties, fertility, child survival, household mortality | Assess risk of stigma, discrimination, distress, and harm; justify each question and restrict use and access. Consider whether sensitive detail can be omitted or reported only in sufficiently aggregated form. |
| Occupation, income band, assets, utilities and housing | Justify indicators, keep optional where feasible, avoid individual decisions or eligibility decisions based on them, and suppress small aggregates. |
| Staff identity, assignments, sync and audit logs | Limit fields, access, and retention to operational/security needs; document monitoring and inform staff. |

The controller must also document: purpose limitation; alternatives and why they are insufficient; who can see identifiable versus aggregate data; a clear collection notice in languages and formats understood by participants; handling of children and people needing assistance; data-subject request routes; correction and challenge processes; complaint/escalation channels; and any reuse, sharing, research, or automated decision-making (none is authorised by this draft).

## 4. Risk assessment

This is an initial qualitative assessment. Likelihood and residual risk are **provisional**, not measured. The controller/DPO must validate impact and likelihood for the actual population, vendors, security configuration, and operating procedures. “Open” means the listed mitigation is unverified or incomplete.

| # | Risk to people | Initial likelihood / impact | Existing or proposed controls | Owner / residual status |
|---:|---|---|---|---|
| 1 | Lost, stolen, shared, or compromised field device exposes identifiable offline household records. | Possible / Severe | Prototype queues pending records in browser IndexedDB; this is not evidence of encryption at rest, remote wipe, device lock, or local expiry. Require managed/encrypted devices, individual accounts, short session policy, minimum local retention, documented purge, lost-device reporting, and physical-device testing. | Controller IT/security + field operations / **Open — high residual until verified** |
| 2 | Unauthorised access, cross-state disclosure, or privilege escalation exposes records or staff accounts. | Possible / Severe | Role checks and database RLS exist; state-admin boundaries are being introduced. Require independent policy/function review, deny-case tests for every role and inactive account, least-privilege grants, MFA where available, session/recovery review, and regular access recertification. | Security owner / **Open — high residual until tests/evidence** |
| 3 | Sensitive religion, ethnicity, disability, fertility, mortality, or economic information causes stigma, discrimination, distress, or other harm. | Possible / Severe | Optional fields and aggregate reporting are present in parts of the application. Complete field-level necessity review, consent/notice and sensitive-data conditions, role/access limits, use restrictions, training, and small-cell disclosure controls. | Controller + DPO / **Open — high residual** |
| 4 | Incorrect or synthetic geography causes misrouting, miscounting, inclusion/exclusion, or false official conclusions. | Likely / Major | UI identifies reference/synthetic lists and record creation is intended to be blocked until verified geography is loaded. Import authoritative sources, validate every state/LGA/ward/EA relationship and provenance, reconcile counts, and obtain independent sign-off. | Geography owner / **Open — do not use for official reporting** |
| 5 | Public intake is abused, spammed, or used to submit false or malicious information about another household. | Possible / Major | Server-side validation and routing exist; CAPTCHA and rate-limit settings are deployment-dependent and not evidenced here. Require verified CAPTCHA, rate limiting, abuse monitoring, correction/complaint routes, review, and no adverse automated decisions. | Application owner / **Open — deployment evidence required** |
| 6 | Offline retries, device sharing, or duplicate submissions lead to loss, misattribution, or unauthorised retention. | Possible / Major | An idempotency key, atomic sync function, and sync logging are implemented. Test retries, shared-device sign-out, conflicting edits, failed sync, and post-sync local deletion on every supported device/browser. | Application owner + field operations / **Open — device test required** |
| 7 | Data remains in production, logs, exports, local caches, or backups longer than the approved purpose. | Likely / Major | No approved schedule or end-to-end deletion evidence is recorded. Set and implement separate retention periods, deletion and backup-expiry procedures, export controls, and audit-log retention. | Controller + processor / **Open — high residual** |
| 8 | Cross-border transfer, vendor access, or inadequate processor arrangements expose data outside approved jurisdiction or safeguards. | Possible / Major | The repository does not establish deployment region, transfer mechanism, processor terms, subprocessors, or support-access controls. Inventory vendors/locations, execute required contracts, assess applicable transfer rules, and record safeguards before production. | Controller procurement + DPO / **Open — high residual** |
| 9 | Account takeover or insecure recovery/email configuration exposes or alters data. | Possible / Major | Email confirmation and role checks are implemented in application flows; production SMTP, recovery, MFA, redirects, session lifetime, and monitoring are not evidenced. Test account lifecycle and enforce an approved authentication baseline. | Identity/security owner / **Open** |
| 10 | Inaccurate responses, mistaken identity, or household conflict harm a person or distort statistics. | Possible / Major | Review and correction workflows exist for some submissions. Provide a clear correction/contest process, safe interviewing guidance, supervisor quality checks, and safeguards against using unverified data for decisions. | Data quality owner / **Open** |
| 11 | Excessive staff access, curious lookups, or misuse of exports disclose personal information. | Possible / Major | Some sensitive lookups require a reason and are audited; state administrators are scoped in the design. Verify all read paths and exports, audit-alert review, staff training, sanctions, periodic access recertification, and separation of duties. | Controller operations / **Open** |
| 12 | A breach is not detected, contained, or reported in time, increasing harm. | Possible / Severe | Sync and audit logging exist but do not establish a complete incident-response capability. Approve an incident plan, reporting/escalation timetable, evidence preservation, containment, affected-person communications, provider coordination, and exercises. | Controller incident lead + DPO / **Open — high residual** |
| 13 | Participants misunderstand the purpose, optional questions, sharing, or consequences and provide invalid or uninformed responses. | Possible / Major | A consent checkbox and translated questionnaire labels exist; a complete multilingual privacy notice and usability evidence are not established. Test the full notice and consent flow in all collection languages, provide non-digital explanation/accessibility, and ensure refusal does not create an undisclosed penalty. | Controller + community engagement / **Open** |
| 14 | Small or granular aggregates allow re-identification, especially when filtered by geography or combined with external data. | Possible / Major | Some aggregate output suppresses small counts. Test every report/API, repeated differencing, rare categories, and geographic filters; set minimum thresholds and independent disclosure review. | Statistical disclosure owner / **Open** |

### Overall assessment

The processing is likely to pose significant risk because it combines identifiable household records, location, offline device storage, and potentially sensitive demographic and health/disability/fertility information at population scale. This is a precautionary prototype assessment, not a formal statutory threshold conclusion. The current residual risk is **not accepted** for real-data collection because critical operational, legal, transfer, retention, and security evidence is missing.

If the controller cannot reduce a high residual risk to an acceptable level, the controller/DPO must determine whether processing must be redesigned, delayed, or escalated for the applicable prior consultation or other regulatory step before it begins. Do not treat this draft as that determination.

## 5. Required actions before any real-data pilot

Each action needs an owner, due date, evidence link, and closed/open status.

1. **Controller and mandate:** name the controller; document authority, specific purpose, population, collection period, sharing, and decision-use limitations.
2. **Legal/privacy review:** have the controller's DPO/privacy lead and qualified Nigerian privacy counsel verify the applicable NDPA 2023 and current NDPC requirements, lawful basis, sensitive-data conditions, notices, rights, children, and any prior consultation obligations.
3. **Participant notice and field protocol:** approve a readable multilingual notice, consent/other lawful-basis flow, refusal/withdrawal handling, correction and complaint routes, accessibility, safeguarding, and enumerator scripts.
4. **Field minimisation:** approve the field-by-field necessity table; remove unjustified fields; confirm whether date of birth, exact location, religion, ethnicity, disability, fertility, mortality, income, and asset information are necessary and optional.
5. **Geography:** import and independently verify official geography and EA provenance; prohibit synthetic identifiers in production.
6. **Security verification:** review the final schema, grants, RLS, RPCs/triggers, views, admin/state-admin roles, API authorization, audit events, and exports; run authenticated allow/deny tests and Supabase security advisors; fix findings and retain evidence.
7. **Identity and hosting:** confirm production URL, TLS/security headers, MFA/session settings, Auth redirects and recovery, SMTP, Supabase project region, backup/replica locations, support access, subprocessors, processor contracts, and transfer safeguards.
8. **Public intake:** prove CAPTCHA and rate limiting are active in the deployed environment; test abuse, enumeration, spam, and incident alerts.
9. **Offline devices:** specify supported devices/browser versions; enforce device encryption, screen lock, access control, local retention and secure purge; complete documented physical offline/lost-device tests.
10. **Retention and rights:** approve and test record retention/deletion, backup expiry, data access/correction/objection/request handling, restriction, complaint, and any legally justified exceptions.
11. **Incident response:** approve and exercise a personal-data breach plan with detection, containment, escalation, provider coordination, required notification assessment, and affected-person support.
12. **People and governance:** train staff, document confidentiality and acceptable-use commitments, establish access reviews and sanctions, and consult affected communities.
13. **Residual risk:** the controller and DPO must record evidence, unresolved risks, mitigation owners/dates, final go/no-go decision, and sign-off. Reassess after any material change, incident, new data field, vendor, purpose, or scale increase.

## 6. Approval record

Do not mark approved until the controller has reviewed the evidence and completed all relevant fields.

- Controller decision: **TBD — no-go / conditional pilot / go**
- Approved purpose and scope: **TBD**
- Conditions and expiry/review date: **TBD**
- DPO/privacy lead advice and date: **TBD**
- Residual risks explicitly accepted and rationale: **TBD**
- Controller authorised approver, title, signature, and date: **TBD**
- Evidence register / links: **TBD**

## 7. Reference material

- [Nigeria Data Protection Commission](https://ndpc.gov.ng/) — verify the current Act, regulations, guidance, and official contact information before approval.
- [Nigeria Data Protection Act 2023](https://ndpc.gov.ng/) — the controller should obtain and cite the authoritative Act text and applicable instruments in the approved copy.
- [ICO DPIA guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/guide-to-accountability-and-governance/data-protection-impact-assessments-dpias/) — process reference only; UK guidance is not Nigerian legal advice.
- [Project security review](./SECURITY_REVIEW.md) — prototype technical findings and release gates.
- [Offline device test plan](./OFFLINE_DEVICE_TEST.md) — device-level test scenarios.
