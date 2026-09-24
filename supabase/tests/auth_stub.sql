-- Local-only stand-in for Supabase's auth schema so the RLS tests run on plain Postgres.
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create role authenticated;
grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
