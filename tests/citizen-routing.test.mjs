import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const migration = await readFile(new URL('../supabase/008_citizen_routing.sql', import.meta.url), 'utf8');
const roleMigration = await readFile(new URL('../supabase/007a_add_analyst_role.sql', import.meta.url), 'utf8');
const publicStatusRoute = await readFile(new URL('../src/app/api/citizen/status/route.ts', import.meta.url), 'utf8');
const geographyPdfRoute = await readFile(new URL('../src/app/api/geography/pdf/route.ts', import.meta.url), 'utf8');
const syncRoute = await readFile(new URL('../src/app/api/sync/route.ts', import.meta.url), 'utf8');
const syncMigration = await readFile(new URL('../supabase/010_sync_attempt_logging.sql', import.meta.url), 'utf8');
const geographyImporter = await readFile(new URL('../scripts/import-geography.mjs', import.meta.url), 'utf8');

test('public submission RPC is not executable by anonymous clients', () => {
  assert.match(migration, /revoke all on function public\.submit_public_citizen_submission[\s\S]*?from public, anon, authenticated;/);
  assert.match(migration, /grant execute on function public\.submit_public_citizen_submission[\s\S]*?to service_role;/);
});

test('public status output suppresses small counts', () => {
  assert.match(migration, /case when a\.approved_households <[\s\S]*?then '<10'/);
  assert.match(migration, /approved_individuals < c\.threshold[\s\S]*?then '<10'/);
});

test('submission workflow includes routing and review states', () => {
  for (const status of ['pending_enumerator', 'needs_admin', 'correction_requested', 'approved', 'rejected']) {
    assert.match(migration, new RegExp(`'${status}'`));
  }
  assert.match(migration, /resolved_ea_id/);
  assert.match(migration, /assigned_enumerator_id/);
});

test('analyst enum migration is isolated before policy use', () => {
  assert.match(roleMigration, /alter type user_role add value if not exists 'analyst'/);
  assert.match(migration, /007a_add_analyst_role\.sql before this migration/);
});

test('public status and geography endpoints do not query personal census tables', () => {
  assert.doesNotMatch(publicStatusRoute, /from\(['"](households|individuals|household_indicators)['"]\)/);
  assert.doesNotMatch(geographyPdfRoute, /from\(['"](households|individuals|citizen_submissions|household_indicators)['"]\)/);
  assert.match(geographyPdfRoute, /Content-Type':'application\/pdf/);
});

test('sensitive lookups and admin search require reasons and are audited', () => {
  assert.match(migration, /get_household_indicators\(p_household_id uuid, p_reason text\)/);
  assert.match(migration, /SENSITIVE_LOOKUP/);
  assert.match(migration, /log_admin_lookup\(p_query text, p_reason text\)/);
  assert.match(migration, /action, changed_by, new_values/);
});

test('approved records drive indicator aggregates and realtime publication', () => {
  assert.match(migration, /create trigger aggregate_household_insert/);
  assert.match(migration, /create trigger aggregate_individual_insert/);
  assert.match(migration, /create trigger aggregate_indicator_insert/);
  assert.match(migration, /alter publication supabase_realtime add table public\.population_aggregates/);
});

test('sync failures are centrally logged without claiming offline central logging', () => {
  assert.match(syncMigration, /create or replace function public\.log_sync_attempt/);
  assert.match(syncMigration, /status in \('success', 'failed'\)/);
  assert.match(syncMigration, /revoke all on function public\.log_sync_attempt/);
  assert.match(syncRoute, /log_sync_attempt/);
});

test('geography importer is deterministic and refuses synthetic data assumptions', () => {
  assert.match(geographyImporter, /authoritative State\/LGA\/Ward extract/);
  assert.match(geographyImporter, /sort\(/);
  assert.match(geographyImporter, /public\.states/);
  assert.match(geographyImporter, /public\.wards/);
});
