-- Run once in Supabase Dashboard > SQL Editor.
-- RLS is enabled and no public policies are created. The Node server uses a
-- server-only secret/service_role API key; never put it into frontend code.
create table if not exists public.site_content (
  id integer primary key check (id = 1),
  content jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.site_content enable row level security;
grant usage on schema public to service_role;
grant all on table public.site_content to service_role;
