# Geography import contract

The importer is `scripts/import-official-geography.mjs`. It is a server-side
PostgreSQL utility; it must never run in the browser.

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
use this dataset temporarily, run reference-only plus synthetic-demo mode:

```powershell
node scripts/import-official-geography.mjs --reference-only --synthetic-demo --replace-demo --dry-run
node scripts/import-official-geography.mjs --reference-only --synthetic-demo --replace-demo
```

This maps the supplied ISO state code and ACDMS `internal_working_code` into
`reference_code`, leaves `official_code` null for LGAs, and preserves each
row's explicit `source_id`/`identifier_source`. Ward and EA rows retain their
explicit `record_type = synthetic` and non-official identifier sources. Do not
present any of these working or synthetic identifiers as official identifiers.

Run the migration first:

```powershell
# Run in Supabase SQL Editor, after 010_sync_attempt_logging.sql
supabase/011_geography_import_metadata.sql
```

Then use a server-only connection string:

```powershell
$env:ACDMS_DATABASE_URL = 'postgresql://...'
node scripts/import-official-geography.mjs --dry-run
node scripts/import-official-geography.mjs
```

The utility opens one transaction, upserts states, LGAs, wards, and EAs by
official code, validates parent relationships and imported-code counts, and
commits only after validation. `--dry-run` always rolls back. Existing EAs are
not removed or changed merely because they are absent from the source. Use
`--replace-demo` only to remove rows explicitly marked `record_type =
'synthetic'`; dependent census rows can intentionally cause that transaction
to fail rather than be silently deleted.
