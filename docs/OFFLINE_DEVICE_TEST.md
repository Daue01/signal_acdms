# Offline device test protocol

Status: not run in this workspace; requires a physical phone/tablet and a deployed HTTPS build.

## Test matrix

Record the browser, operating system, device model, build URL, date, enumerator account and assigned EA for each run.

## Procedure

1. Open the deployed app online and sign in as an active enumerator.
2. Load the assigned enumeration area and confirm it remains visible after a full reload.
3. Enable airplane mode or disable both Wi-Fi and mobile data.
4. Reload the enumerator page and confirm the cached area and form remain usable.
5. Save one valid household interview. Confirm the UI reports it as saved locally and shows a pending count.
6. Close and reopen the browser while still offline. Confirm the pending item remains in IndexedDB and no duplicate is created.
7. Restore connectivity. Confirm the online event runs, then press **Sync** explicitly.
8. In the database, verify exactly one household, its individuals, and a successful `sync_log` row for the client UUID.
9. Repeat the sync action and verify the idempotency key does not create a duplicate household.
10. Record failures, screenshots, console/network errors and cleanup steps.

## Acceptance criteria

- Application shell and assigned geography are usable offline after an online warm-up.
- A valid queued submission survives reload and is uploaded after reconnecting.
- Duplicate retries do not duplicate server records.
- A server-received failure appears in `sync_log` with status, HTTP status and a bounded error message.
- A network outage before the server receives a request is documented as a local pending failure, not claimed as a centrally logged failure.
