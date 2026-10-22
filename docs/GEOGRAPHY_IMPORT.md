# Geography import contract

The importer is `scripts/import-official-geography.mjs`. It is a server-side
PostgreSQL utility; it must never run in the browser. `npm run geography:sync`
imports the supplied States/LGAs/reference wards from `.env.local` in one
transaction. It preserves existing matching pilot rows and leaves all
enumeration areas untouched.

Before importing, create `data/geography/` with these files:

- `SOURCE.md`
- `states.csv`
- `lgas.csv`
- `wards.csv`
- `enumeration_areas.csv`

`SOURCE.md` must contain non-placeholder fields using these labels:

```text
Source name: ...
URL: https://...
Download date: YYYY-MM-DD
Version: ...
Licence/reuse terms: ...
```

Required CSV columns are deliberately explicit:

```text
states.csv: state_code,state_name,record_type,identifier_source
lgas.csv: lga_code,lga_name,state_code,record_type,identifier_source
wards.csv: ward_code,ward_name,lga_code,record_type,identifier_source
enumeration_areas.csv: ea_code,ea_name,ward_code,record_type,identifier_source
```

Do not substitute names, sequential working codes, or generated values for
official codes. The importer fails if a file, column, code, provenance value,
or parent reference is missing. It also rejects duplicate codes.

## Current supplied prototype dataset

The supplied files contain 37 states, 774 LGAs, 7,740 synthetic demo wards, and
38,700 synthetic demo EAs. The LGA `official_code` values are blank. The ward
and EA files explicitly identify themselves as synthetic and non-official. To
use this dataset temporarily, run reference-only plus synthetic-demo mode.
The convenient geography-only command deliberately skips the EA CSV:

```powershell
npm run geography:sync:dry-run
npm run geography:sync
```

This maps the supplied ISO state code and ACDMS `internal_working_code` into
`reference_code`, leaves `official_code` null for LGAs, and preserves each
row's explicit `source_id`/`identifier_source`. Ward rows retain their
explicit `record_type = synthetic` and non-official identifier sources. Do not
present any of these working or synthetic identifiers as official identifiers.

Run the migration first:

```powershell
# Run in Supabase SQL Editor, after 010_sync_attempt_logging.sql
supabase/011_geography_import_metadata.sql
```

Set these two server-only values in the ignored `.env.local` file. Do not paste
them into chat or commit them:

```powershell
ACDMS_DATABASE_URL=postgresql://...
ACDMS_DATABASE_SSL_CA_FILE=C:\path\to\supabase-ca.crt
```

Download the CA certificate from Supabase Dashboard → Database Settings →
SSL Configuration. The importer requires this file so the TLS connection
verifies the Supabase server certificate; it never logs either the connection
string or certificate path. After setting these values, run the two commands
above from the repository root. The dry run validates connectivity and rolls
back; the sync command commits the reference hierarchy.

The geography-only import merges existing state and LGA rows by their names
and parent hierarchy, inserts/updates wards in batches, and never deletes or
changes enumeration areas. `--geography-only` cannot be combined with
`--replace-demo`. The full importer also supports official coded EA files. It
validates parent relationships and imported-code counts, and commits only
after validation. Use `--replace-demo` only when intentionally removing
enumeration areas explicitly marked `record_type = 'synthetic'`; dependent
census rows can cause that transaction to fail rather than be silently deleted.

## Application behavior when the database is incomplete

The application checks that Supabase has a complete State/LGA/Ward hierarchy
before using its IDs in cascading selectors. If the database is empty or
partially loaded, the app uses the bundled list and reports database counts. If
the database has the complete demo hierarchy, the app identifies that it is
synced but its wards are synthetic. In either case, synthetic ward preview
data cannot be used to create EAs or submit census records; import verified
official wards before enabling those workflows.
