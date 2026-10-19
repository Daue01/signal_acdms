// Single source of truth for account levels. Must match the user_role enum in Postgres.
export type Role='administrator'|'supervisor'|'enumerator'|'citizen'|'analyst';
export const HOME:Record<Role,string>={administrator:'/admin',supervisor:'/admin',enumerator:'/enumerator',citizen:'/citizen',analyst:'/admin'};
