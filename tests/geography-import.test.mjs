import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { importRows, loadDataset, validateDatabase, validateDataset } from '../scripts/import-official-geography.mjs';

const source = `Source name: Test authority\nURL: https://example.test/geography.csv\nDownload date: 2026-10-20\nVersion: 1.0\nLicence/reuse terms: Test licence\n`;

async function fixture(files) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'acdms-geography-'));
  await fs.writeFile(path.join(dir, 'SOURCE.md'), source);
  const rows = {
    states: [['state_code', 'state_name', 'record_type', 'identifier_source'], ['S1', 'State One', 'official', 'authority-1']],
    lgas: [['lga_code', 'lga_name', 'state_code', 'record_type', 'identifier_source'], ['L1', 'LGA One', 'S1', 'official', 'authority-1']],
    wards: [['ward_code', 'ward_name', 'lga_code', 'record_type', 'identifier_source'], ['W1', 'Ward One', 'L1', 'official', 'authority-1']],
    enumeration_areas: [['ea_code', 'ea_name', 'ward_code', 'record_type', 'identifier_source'], ['E1', 'EA One', 'W1', 'official', 'authority-1']],
  };
  for (const [name, values] of Object.entries({ ...rows, ...files })) await fs.writeFile(path.join(dir, `${name}.csv`), values.map(row => row.join(',')).join('\n'));
  return dir;
}

test('validates coded hierarchy and explicit provenance', async () => {
  const dir = await fixture({});
  const dataset = await loadDataset(dir);
  assert.deepEqual(validateDataset(dataset), []);
});

test('rejects duplicate codes and orphan references', async () => {
  const dir = await fixture({
    lgas: [
      ['lga_code', 'lga_name', 'state_code', 'record_type', 'identifier_source'],
      ['L1', 'LGA One', 'S1', 'official', 'authority-1'],
      ['L1', 'Duplicate', 'S1', 'official', 'authority-1'],
      ['L2', 'Orphan', 'MISSING', 'official', 'authority-1'],
    ],
  });
  const errors = validateDataset(await loadDataset(dir));
  assert.ok(errors.some(error => error.includes('duplicate code')));
  assert.ok(errors.some(error => error.includes('missing state_code')));
});

test('rejects incomplete source metadata and missing required columns', async () => {
  const dir = await fixture({ wards: [['ward_code', 'ward_name', 'lga_code', 'record_type']] });
  await fs.writeFile(path.join(dir, 'SOURCE.md'), 'Status: DRAFT\nDownload URL: ______\n');
  const errors = validateDataset(await loadDataset(dir));
  assert.ok(errors.some(error => error.includes('SOURCE.md')));
  assert.ok(errors.some(error => error.includes('identifier_source')));
});

test('geography-only mode does not require or modify enumeration areas', async () => {
  const dir = await fixture({});
  await fs.rm(path.join(dir, 'enumeration_areas.csv'));
  const dataset = await loadDataset(dir, { geographyOnly: true });
  assert.deepEqual(validateDataset(dataset, { geographyOnly: true }), []);
  assert.deepEqual(dataset.eas.records, []);

  const statements = [];
  await importRows({ query: async (text) => {
    statements.push(text);
    if (text.startsWith('select state_id')) return { rows: [{ state_id: 1 }], rowCount: 1 };
    return { rows: [], rowCount: 1 };
  } }, {
    states: { records: [{ state_code: 'S1', state_name: 'State One', record_type: 'reference', identifier_source: 'authority-1' }] },
    lgas: { records: [{ lga_code: 'L1', lga_name: 'LGA One', state_code: 'S1', record_type: 'reference', identifier_source: 'authority-1' }] },
    wards: { records: [{ ward_code: 'W1', ward_name: 'Ward One', lga_code: 'L1', record_type: 'synthetic', identifier_source: 'demo-only' }] },
    eas: { records: [] },
  }, false, true, true);

  assert.ok(statements.some(statement => statement.includes("regexp_replace(btrim(name)")));
  assert.ok(statements.some(statement => statement.startsWith('update public.states')));
  assert.ok(statements.some(statement => statement.includes('on conflict (state_id,name)')));
  assert.ok(statements.some(statement => statement.includes('on conflict (lga_id,name)')));
  assert.ok(statements.every(statement => !statement.includes('enumeration_areas') && !statement.startsWith('delete ')));

  const validationStatements = [];
  const databaseErrors = await validateDatabase({ query: async (text) => {
    validationStatements.push(text);
    if (text.startsWith('select (select count(')) return { rows: [{ count: 0 }] };
    if (text.includes('count(*)::int as count')) return { rows: [{ count: 1 }] };
    return { rows: [{ count: 1 }] };
  } }, {
    states: { records: [{ state_code: 'S1' }] },
    lgas: { records: [{ lga_code: 'L1' }] },
    wards: { records: [{ ward_code: 'W1' }] },
    eas: { records: [] },
    geographyOnly: true,
  }, true);
  assert.deepEqual(databaseErrors, []);
  assert.ok(validationStatements.every(statement => !statement.includes('enumeration_areas')));
});
