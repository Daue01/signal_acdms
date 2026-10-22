import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const [roles,adminPage,stateAdminView,enumeratorPage,roleMigration,accessMigration,schema,login,readme]=await Promise.all([
  readFile(new URL('../src/lib/roles.ts',import.meta.url),'utf8'),
  readFile(new URL('../src/app/admin/page.tsx',import.meta.url),'utf8'),
  readFile(new URL('../src/app/admin/StateAdminView.tsx',import.meta.url),'utf8'),
  readFile(new URL('../src/app/enumerator/page.tsx',import.meta.url),'utf8'),
  readFile(new URL('../supabase/012a_add_state_admin_role.sql',import.meta.url),'utf8'),
  readFile(new URL('../supabase/012b_state_admin_access.sql',import.meta.url),'utf8'),
  readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8'),
  readFile(new URL('../src/app/login/LoginForm.tsx',import.meta.url),'utf8'),
  readFile(new URL('../README.md',import.meta.url),'utf8'),
]);

test('system administrators can designate one state administrator per state',()=>{
  assert.match(roles,/'state_admin'/);
  assert.match(adminPage,/option value="state_admin">State administrator/);
  assert.match(adminPage,/Select a state before designating a state administrator/);
  assert.match(adminPage,/missing profiles\.state_id/);
  assert.match(adminPage,/012a_add_state_admin_role\.sql.*012b_state_admin_access\.sql/);
  assert.match(accessMigration,/profiles_one_state_admin_per_state/);
  assert.match(accessMigration,/role <> 'state_admin' or state_id is not null/);
  assert.match(schema,/administrator','state_admin'/);
});

test('state administrator UI only offers state-scoped enumerator management',()=>{
  assert.match(adminPage,/scope\.role==='state_admin'/);
  assert.match(adminPage,/allow=\{\['administrator','state_admin'/);
  assert.match(stateAdminView,/\.eq\('state_id',stateId\)\.in\('role',\['enumerator','state_admin'\]\)/);
  assert.match(stateAdminView,/\.eq\('state_id',stateId\)/);
  assert.match(stateAdminView,/\.from\('enumeration_areas'\)/);
  assert.match(enumeratorPage,/RequireRole allow=\{\['enumerator','state_admin'\]\}/);
  assert.match(stateAdminView,/Open your enumerator capture form/);
  assert.match(login,/portal==='administrator'.*'state_admin'/);
});

test('database policies and triggers enforce state boundaries and restrict changes',()=>{
  assert.match(accessMigration,/create policy state_admin_profiles_select/);
  assert.match(accessMigration,/create policy state_admin_profiles_update/);
  assert.match(accessMigration,/create policy state_admin_ea_update/);
  assert.match(accessMigration,/state_id = \(select state_id_of\(\)\)/);
  assert.match(accessMigration,/State administrators may only change enumerator active status/);
  assert.match(accessMigration,/State administrators may only change enumerator assignments/);
  assert.match(accessMigration,/Assignments must target an active enumerator in your state/);
  assert.match(accessMigration,/role_of\(\)\) in \('enumerator', 'state_admin'\)/);
  assert.match(accessMigration,/state_admin.*registered_by/s);
  assert.match(roleMigration,/alter type public\.user_role add value if not exists 'state_admin'/);
  assert.match(readme,/012a_add_state_admin_role\.sql.*012b_state_admin_access\.sql/);
});
