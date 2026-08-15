-- Body Sculpt: Supabase database setup
-- Run this in Supabase Dashboard -> SQL Editor.

create table if not exists public.body_sculpt_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.body_sculpt_profiles enable row level security;

-- Re-running this file is safe.
drop policy if exists "body sculpt select own profile" on public.body_sculpt_profiles;
drop policy if exists "body sculpt insert own profile" on public.body_sculpt_profiles;
drop policy if exists "body sculpt update own profile" on public.body_sculpt_profiles;
drop policy if exists "body sculpt delete own profile" on public.body_sculpt_profiles;

create policy "body sculpt select own profile"
on public.body_sculpt_profiles
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "body sculpt insert own profile"
on public.body_sculpt_profiles
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "body sculpt update own profile"
on public.body_sculpt_profiles
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "body sculpt delete own profile"
on public.body_sculpt_profiles
for delete
to authenticated
using ((select auth.uid()) = user_id);
