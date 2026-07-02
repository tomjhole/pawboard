-- pgcrypto (gen_salt/crypt) lives in the `extensions` schema on Supabase, not
-- `public` — the function's search_path needs to include it or the demo
-- staff-user inserts fail with "function gen_salt(unknown) does not exist".
alter function regenerate_demo_data(text) set search_path = public, extensions;
