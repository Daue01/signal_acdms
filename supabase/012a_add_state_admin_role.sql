-- PostgreSQL enum values must be committed before policies can use them.
alter type public.user_role add value if not exists 'state_admin';
