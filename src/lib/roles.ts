// Single source of truth for account levels. Must match the user_role enum in Postgres.
export type Role='administrator'|'state_admin'|'supervisor'|'enumerator'|'citizen'|'analyst';
export const HOME:Record<Role,string>={administrator:'/admin',state_admin:'/admin',supervisor:'/admin',enumerator:'/enumerator',citizen:'/citizen',analyst:'/admin'};
