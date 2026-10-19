-- Run after 007_citizen_submissions.sql and before 008_citizen_routing.sql.
-- PostgreSQL enum values must be committed before policies/functions use them.
alter type user_role add value if not exists 'analyst';
