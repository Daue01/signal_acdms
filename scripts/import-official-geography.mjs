#!/usr/bin/env node

/**
 * Import a documented, coded geography extract into Supabase/Postgres.
 * The importer deliberately requires explicit codes and provenance fields;
 * it never derives official identifiers from names or working codes.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Client } = pg;
const ROOT = process.cwd();
const DEFAULT_DATA_DIR = path.join(ROOT, 'data', 'geography');
const FILES = { states: 'states.csv', lgas: 'lgas.csv', wards: 'wards.csv', eas: 'enumeration_areas.csv' };
const REQUIRED = {
  states: ['state_code', 'state_name', 'record_type', 'identifier_source'],
  lgas: ['lga_code', 'lga_name', 'state_code', 'record_type', 'identifier_source'],
  wards: ['ward_code', 'ward_name', 'lga_code', 'record_type', 'identifier_source'],
  eas: ['ea_code', 'ea_name', 'ward_code', 'record_type', 'identifier_source'],
};

function usage() {
  console.log('Usage: node scripts/import-official-geography.mjs [--data-dir data/geography] [--dry-run] [--reference-only] [--synthetic-demo] [--replace-demo]');
  console.log('Connection: set ACDMS_DATABASE_URL (server-side only; it is never printed).');
}

function options(argv) {
  const result = { dataDir: DEFAULT_DATA_DIR, dryRun: false, replaceDemo: false, referenceOnly: false, syntheticDemo: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--help' || argv[i] === '-h') { usage(); process.exit(0); }
    if (argv[i] === '--dry-run') { result.dryRun = true; continue; }
    if (argv[i] === '--replace-demo') { result.replaceDemo = true; continue; }
    if (argv[i] === '--reference-only') { result.referenceOnly = true; continue; }
    if (argv[i] === '--synthetic-demo') { result.syntheticDemo = true; continue; }
    if (argv[i] === '--data-dir') { result.dataDir = path.resolve(argv[++i] ?? ''); continue; }
    throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return result;
}

function csv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted && c === '"' && text[i + 1] === '"') { cell += '"'; i += 1; continue; }
    if (c === '"') { quoted = !quoted; continue; }
    if (!quoted && c === ',') { row.push(cell); cell = ''; continue; }
    if (!quoted && (c === '\n' || c === '\r')) {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell); cell = '';
      if (row.some(value => value.trim() !== '')) rows.push(row);
      row = []; continue;
    }
    cell += c;
  }
  if (quoted) throw new Error('CSV has an unterminated quoted field');
  row.push(cell);
  if (row.some(value => value.trim() !== '')) rows.push(row);
  if (!rows.length) return { headers: [], records: [] };
  const headers = rows[0].map(value => value.trim());
  return { headers, records: rows.slice(1).map(values => Object.fromEntries(headers.map((header, i) => [header, (values[i] ?? '').trim()]))) };
}

function sourceField(text, labels) {
  for (const label of labels) {
    const match = text.match(new RegExp(`^\\s*(?:[-*]\\s*)?${label}\\s*:\\s*(.+?)\\s*$`, 'im'));
    if (match) return match[1].trim();
  }
  return '';
}

function validSourceValue(value) {
  return value && !/_{3,}|verify|draft|blank|not available|to be confirmed/i.test(value);
}

function validateSource(text) {
  const fields = {
    sourceName: sourceField(text, ['Source name', 'Dataset']),
    url: sourceField(text, ['URL', 'Download URL']),
    downloadDate: sourceField(text, ['Download date', 'Date downloaded']),
    version: sourceField(text, ['Version', 'Edition', 'Edition or version']),
    licence: sourceField(text, ['Licence/reuse terms', 'License/reuse terms', 'Licence', 'License', 'Reuse terms']),
  };
  const errors = [];
  if (!validSourceValue(fields.sourceName)) errors.push('SOURCE.md must contain a non-placeholder Source name/Dataset field.');
  if (!validSourceValue(fields.url) || !/^https?:\/\//i.test(fields.url)) errors.push('SOURCE.md must contain a real URL.');
  if (!validSourceValue(fields.downloadDate)) errors.push('SOURCE.md must contain a non-placeholder Download date.');
  if (!validSourceValue(fields.version)) errors.push('SOURCE.md must contain a non-placeholder Version/Edition field.');
  if (!validSourceValue(fields.licence)) errors.push('SOURCE.md must contain non-placeholder licence/reuse terms.');
  return { fields, errors };
}

function validateLevel(name, data) {
  const required = REQUIRED[name];
  const errors = [];
  const missing = required.filter(column => !data.headers.includes(column));
  if (missing.length) errors.push(`${FILES[name]} is missing required column(s): ${missing.join(', ')}`);
  if (missing.length) return errors;
  const seen = new Set();
  for (const [index, row] of data.records.entries()) {
    for (const column of required) if (!row[column]) errors.push(`${FILES[name]} row ${index + 2} has a blank ${column}.`);
    const code = row[required[0]];
    if (code && seen.has(code)) errors.push(`${FILES[name]} contains duplicate code: ${code}`);
    if (code) seen.add(code);
    if (row.record_type && !['official', 'reference', 'synthetic'].includes(row.record_type)) errors.push(`${FILES[name]} row ${index + 2} has unsupported record_type '${row.record_type}'.`);
  }
  return errors;
}

export function validateDataset(dataset) {
  const errors = [...dataset.sourceErrors];
  for (const level of Object.keys(FILES)) errors.push(...validateLevel(level, dataset[level]));
  const states = new Set(dataset.states.records.map(row => row.state_code));
  const lgas = new Set(dataset.lgas.records.map(row => row.lga_code));
  const wards = new Set(dataset.wards.records.map(row => row.ward_code));
  for (const [index, row] of dataset.lgas.records.entries()) if (row.state_code && !states.has(row.state_code)) errors.push(`lgas.csv row ${index + 2} references missing state_code '${row.state_code}'.`);
  for (const [index, row] of dataset.wards.records.entries()) if (row.lga_code && !lgas.has(row.lga_code)) errors.push(`wards.csv row ${index + 2} references missing lga_code '${row.lga_code}'.`);
  for (const [index, row] of dataset.eas.records.entries()) if (row.ward_code && !wards.has(row.ward_code)) errors.push(`enumeration_areas.csv row ${index + 2} references missing ward_code '${row.ward_code}'.`);
  return [...new Set(errors)];
}

function normalizeReference(level, data, syntheticDemo = false) {
  if (level === 'states' && data.records.length) return {
    headers: REQUIRED.states,
    records: data.records.map(row => ({ state_code: row.iso3166_2_code, state_name: row.state_name, record_type: 'reference', identifier_source: row.source_id })),
  };
  if (level === 'lgas' && data.records.length) return {
    headers: REQUIRED.lgas,
    records: data.records.map(row => ({ lga_code: row.internal_working_code, lga_name: row.lga_name, state_code: row.state_iso3166_2_code, record_type: 'reference', identifier_source: row.source_id })),
  };
  if (syntheticDemo && level === 'wards' && data.records.length) return {
    headers: REQUIRED.wards,
    records: data.records.map(row => ({ ward_code: row.ward_internal_code, ward_name: row.ward_name, lga_code: row.lga_internal_working_code, record_type: row.record_type, identifier_source: row.identifier_source })),
  };
  if (syntheticDemo && level === 'eas' && data.records.length) return {
    headers: REQUIRED.eas,
    records: data.records.map(row => ({ ea_code: row.ea_internal_code, ea_name: row.ea_name, ward_code: row.ward_internal_code, record_type: row.record_type, identifier_source: row.identifier_source })),
  };
  if ((level === 'wards' || level === 'eas') && !data.records.length) return { headers: REQUIRED[level], records: [] };
  return data;
}

export async function loadDataset(dataDir, { referenceOnly = false, syntheticDemo = false } = {}) {
  const errors = [];
  let source = '';
  try { source = await fs.readFile(path.join(dataDir, 'SOURCE.md'), 'utf8'); } catch { errors.push(`Missing required ${path.join(dataDir, 'SOURCE.md')}`); }
  const sourceCheck = source ? validateSource(source) : { fields: {}, errors: [] };
  errors.push(...sourceCheck.errors);
  const dataset = { dataDir, sourceFields: sourceCheck.fields, sourceErrors: errors };
  for (const [level, file] of Object.entries(FILES)) {
    try {
      const parsed = csv(await fs.readFile(path.join(dataDir, file), 'utf8'));
      dataset[level] = referenceOnly || syntheticDemo ? normalizeReference(level, parsed, syntheticDemo) : parsed;
    }
    catch { dataset[level] = { headers: [], records: [] }; errors.push(`Missing required ${path.join(dataDir, file)}`); }
  }
  dataset.sourceErrors = errors;
  return dataset;
}

async function query(client, text, values = []) { return client.query(text, values); }

async function importRows(client, dataset, replaceDemo, referenceOnly) {
  if (replaceDemo) await query(client, "delete from public.enumeration_areas where record_type = 'synthetic'");
  const key = referenceOnly ? 'reference_code' : 'official_code';
  for (const row of dataset.states.records) await query(client, `insert into public.states(${key},official_code,name,record_type,identifier_source) values($1,$2,$3,$4,$5) on conflict (${key}) do update set official_code=excluded.official_code,name=excluded.name,record_type=excluded.record_type,identifier_source=excluded.identifier_source`, [row.state_code, referenceOnly ? null : row.state_code, row.state_name, row.record_type, row.identifier_source]);
  for (const row of dataset.lgas.records) await query(client, `insert into public.lgas(${key},official_code,state_id,name,record_type,identifier_source) select $1,$2,state_id,$3,$4,$5 from public.states where ${key}=$6 on conflict (${key}) do update set official_code=excluded.official_code,state_id=excluded.state_id,name=excluded.name,record_type=excluded.record_type,identifier_source=excluded.identifier_source`, [row.lga_code, referenceOnly ? null : row.lga_code, row.lga_name, row.record_type, row.identifier_source, row.state_code]);
  for (const row of dataset.wards.records) await query(client, `insert into public.wards(${key},official_code,lga_id,name,record_type,identifier_source) select $1,$2,lga_id,$3,$4,$5 from public.lgas where ${key}=$6 on conflict (${key}) do update set official_code=excluded.official_code,lga_id=excluded.lga_id,name=excluded.name,record_type=excluded.record_type,identifier_source=excluded.identifier_source`, [row.ward_code, referenceOnly ? null : row.ward_code, row.ward_name, row.record_type, row.identifier_source, row.lga_code]);
  for (const row of dataset.eas.records) await query(client, `insert into public.enumeration_areas(ea_code,official_code,reference_code,ea_name,state,lga,ward,ward_id,record_type,identifier_source) select $1,$2,$3,$4,s.name,l.name,w.name,w.ward_id,$5,$6 from public.wards w join public.lgas l on l.lga_id=w.lga_id join public.states s on s.state_id=l.state_id where w.${key}=$7 on conflict (${key}) do update set ea_code=excluded.ea_code,official_code=excluded.official_code,reference_code=excluded.reference_code,ea_name=excluded.ea_name,state=excluded.state,lga=excluded.lga,ward=excluded.ward,ward_id=excluded.ward_id,record_type=excluded.record_type,identifier_source=excluded.identifier_source`, [row.ea_code, referenceOnly ? null : row.ea_code, referenceOnly ? row.ea_code : null, row.ea_name, row.record_type, row.identifier_source, row.ward_code]);
}

async function validateDatabase(client, dataset, referenceOnly) {
  const key = referenceOnly ? 'reference_code' : 'official_code';
  const checks = [
    ['states', key, dataset.states.records.map(row => row.state_code)],
    ['lgas', key, dataset.lgas.records.map(row => row.lga_code)],
    ['wards', key, dataset.wards.records.map(row => row.ward_code)],
    ['enumeration_areas', key, dataset.eas.records.map(row => row.ea_code)],
  ];
  const errors = [];
  for (const [table, column, codes] of checks) {
    const result = await query(client, `select count(*)::int as count from public.${table} where ${column} = any($1::text[])`, [codes]);
    if (result.rows[0].count !== codes.length) errors.push(`${table}: expected ${codes.length} imported codes, found ${result.rows[0].count}.`);
  }
  const orphan = await query(client, `select (select count(*) from public.lgas l left join public.states s on s.state_id=l.state_id where s.state_id is null) + (select count(*) from public.wards w left join public.lgas l on l.lga_id=w.lga_id where l.lga_id is null) + (select count(*) from public.enumeration_areas ea left join public.wards w on w.ward_id=ea.ward_id where w.ward_id is null) as count`);
  if (Number(orphan.rows[0].count) !== 0) errors.push(`Database contains ${orphan.rows[0].count} orphan geography row(s).`);
  return errors;
}

export async function run(argv = process.argv.slice(2)) {
  const opts = options(argv);
  const dataset = await loadDataset(opts.dataDir, opts);
  const errors = validateDataset(dataset);
  if (errors.length) throw new Error(`Geography import refused:\n- ${errors.join('\n- ')}`);
  if (opts.syntheticDemo) {
    const nonSynthetic = [...dataset.wards.records, ...dataset.eas.records].filter(row => row.record_type !== 'synthetic' || row.identifier_source === '');
    if (nonSynthetic.length) throw new Error('Synthetic demo mode requires every ward and EA row to be explicitly record_type=synthetic with a non-empty identifier_source.');
  }
  console.log(`${opts.referenceOnly ? 'Reference dataset validated' : 'Source validated'}. States: ${dataset.states.records.length}; LGAs: ${dataset.lgas.records.length}; Wards: ${dataset.wards.records.length}; EAs: ${dataset.eas.records.length}.`);
  const connectionString = process.env.ACDMS_DATABASE_URL;
  if (!connectionString) throw new Error('Missing server-side ACDMS_DATABASE_URL. It is never logged.');
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await query(client, 'begin');
    await importRows(client, dataset, opts.replaceDemo, opts.referenceOnly);
    const dbErrors = await validateDatabase(client, dataset, opts.referenceOnly);
    if (dbErrors.length) throw new Error(`Database validation failed:\n- ${dbErrors.join('\n- ')}`);
    if (opts.dryRun) { await query(client, 'rollback'); console.log('Dry run complete: transaction rolled back.'); }
    else { await query(client, 'commit'); console.log('Geography import committed.'); }
  } catch (error) {
    try { await query(client, 'rollback'); } catch {}
    throw error;
  } finally { await client.end(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) run().catch(error => { console.error(error.message); process.exitCode = 1; });
