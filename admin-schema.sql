-- ─────────────────────────────────────────────────────────────────
-- HomeVoice — Admin Schema
-- Run this in Supabase SQL Editor AFTER supabase-schema.sql
-- ─────────────────────────────────────────────────────────────────

-- 1. Add admin fields to profiles
alter table public.profiles
  add column if not exists is_admin boolean default false,
  add column if not exists status text default 'active' check (status in ('active', 'suspended', 'deleted')),
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_reason text,
  add column if not exists deleted_at timestamptz,
  add column if not exists admin_notes text;

-- 2. Audit events table (append-only)
create table if not exists public.audit_events (
  id uuid default gen_random_uuid() primary key,
  admin_id uuid references auth.users(id) not null,
  target_user_id uuid references auth.users(id),
  action text not null,  -- 'suspend', 'unsuspend', 'delete', 'note', 'plan_change', 'impersonate'
  details jsonb default '{}',
  created_at timestamptz default now()
);

-- 3. RLS on audit_events — only admins can read/write
alter table public.audit_events enable row level security;

create policy "Admins can view audit events"
  on public.audit_events for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );

create policy "Admins can insert audit events"
  on public.audit_events for insert
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );

-- 4. Admins can view ALL profiles (not just their own)
create policy "Admins can view all profiles"
  on public.profiles for select
  using (
    auth.uid() = id
    or exists (
      select 1 from public.profiles p2
      where p2.id = auth.uid() and p2.is_admin = true
    )
  );

-- Drop the old single-user select policy if it conflicts
-- (Run this only if you get a duplicate policy error — the above replaces it)
-- drop policy if exists "Users can view own profile" on public.profiles;

-- 5. Admins can update any profile
create policy "Admins can update any profile"
  on public.profiles for update
  using (
    auth.uid() = id
    or exists (
      select 1 from public.profiles p2
      where p2.id = auth.uid() and p2.is_admin = true
    )
  );

-- 6. Admins can view all podcasts
create policy "Admins can view all podcasts"
  on public.podcasts for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

-- 7. Make yourself an admin (replace with your actual user id from auth.users)
-- update public.profiles set is_admin = true where email = 'marout@gmail.com';

-- 8. Helper view for admin user list (joins profiles + auth.users)
create or replace view public.admin_user_view as
select
  p.id,
  p.email,
  p.brand_name,
  p.plan,
  p.status,
  p.is_admin,
  p.podcasts_this_month,
  p.suspended_at,
  p.suspended_reason,
  p.deleted_at,
  p.admin_notes,
  p.created_at,
  p.updated_at,
  (select count(*) from public.podcasts where user_id = p.id) as total_podcasts
from public.profiles p;

-- Grant access to the view for authenticated users (RLS on base tables still applies)
grant select on public.admin_user_view to authenticated;
