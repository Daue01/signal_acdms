import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const [citizenForm,enumeratorForm,questionnaire,translations,submissionRoute,offlineSync,migration]=await Promise.all([
  readFile(new URL('../src/app/citizen/form/page.tsx',import.meta.url),'utf8'),
  readFile(new URL('../src/app/enumerator/page.tsx',import.meta.url),'utf8'),
  readFile(new URL('../src/components/Npc01Questionnaire.tsx',import.meta.url),'utf8'),
  readFile(new URL('../src/lib/npc01Translations.ts',import.meta.url),'utf8'),
  readFile(new URL('../src/app/api/citizen/submit/route.ts',import.meta.url),'utf8'),
  readFile(new URL('../src/app/api/sync/route.ts',import.meta.url),'utf8'),
  readFile(new URL('../supabase/migrations/20261021021600_npc01_questionnaire_responses.sql',import.meta.url),'utf8'),
]);

test('citizen and enumerator capture share the NPC 01 questionnaire sections',()=>{
  assert.match(citizenForm,/<Npc01Questionnaire/);
  assert.match(enumeratorForm,/<Npc01Questionnaire/);
  for(const section of [
    'Demographic and social characteristics',
    'Marital status',
    'Literacy',
    'Education',
    'Economic characteristics',
    'International and internal migration',
    'Information and communication technology',
    'Difficulty performing activities',
    'Fertility and child survival',
    'Survival status of the last child',
    'Mortality (household deaths)',
    'Housing characteristics and amenities',
    'Housing sanitation',
  ]){
    assert.ok(questionnaire.includes(section),`Missing questionnaire section: ${section}`);
  }
});

test('questionnaire includes optional religion and ethnicity with four language choices',()=>{
  assert.match(questionnaire,/\{t\('Religion'\)\}/);
  assert.match(questionnaire,/\{t\('Ethnic group'\)\}/);
  assert.match(questionnaire,/questionnaireLanguages\.map/);
  for(const language of ["code:'en'","code:'ha'","code:'ig'","code:'yo'"]){
    assert.ok(translations.includes(language),`Missing questionnaire language: ${language}`);
  }
  for(const key of [
    'Religion',
    'Ethnic group',
    'Economic characteristics',
    'Difficulty performing activities',
    'Fertility and child survival',
    'Mortality (household deaths)',
    'NPC 01 · Housing characteristics and amenities',
    'NPC 01 · Housing sanitation',
    'Main source of drinking water',
  ]){
    assert.ok(questionnaire.includes(`t('${key}')`),`Questionnaire text is not localized: ${key}`);
  }
  for(const translation of ['Addini','Okpukpe','Ẹ̀sìn','Ƙabila','Agbụrụ','Ẹ̀yà']){
    assert.ok(translations.includes(translation),`Missing translated label: ${translation}`);
  }
});

test('questionnaire responses travel through public and offline submission paths',()=>{
  assert.match(submissionRoute,/census_responses:input\.census_responses/);
  assert.match(submissionRoute,/p_payload:payload/);
  assert.match(offlineSync,/p_household:s\.household,p_individuals:s\.individuals/);
  assert.match(migration,/census_responses/);
  assert.match(migration,/security invoker/i);
  assert.match(migration,/from jsonb_to_recordset\(p_individuals\)/i);
  assert.match(migration,/from jsonb_to_recordset\(s\.individuals\)/i);
});

test('citizen submissions are enabled for reference geography and technical status notices stay hidden',()=>{
  assert.doesNotMatch(citizenForm,/geographySource\s*!==\s*'database'/);
  assert.match(citizenForm,/disabled=\{saving\|\|loading\}/);
  assert.doesNotMatch(citizenForm,/geographyNotice|Submissions unavailable|full reference hierarchy/);
});
