-- ─────────────────────────────────────────────────────────────────
-- HomeVoice — Supabase Schema
-- Run this in your Supabase project: SQL Editor → New Query → Run
-- ─────────────────────────────────────────────────────────────────

-- User profiles (extends Supabase auth.users)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text,
  brand_name text default 'HomeVoice',
  plan text default 'free' check (plan in ('free', 'pro')),
  podcasts_this_month integer default 0,
  usage_reset_at timestamptz default date_trunc('month', now()) + interval '1 month',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Podcast history
create table if not exists public.podcasts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  address text not null,
  city text,
  state text,
  zestimate bigint,
  last_sold_price bigint,
  script_text text,
  audio_provider text,
  data_source text,
  brand_name text,
  created_at timestamptz default now()
);

-- Enable Row Level Security
alter table public.profiles enable row level security;
alter table public.podcasts enable row level security;

-- Profiles: users can only read/write their own profile
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Podcasts: users can only see their own podcasts
create policy "Users can view own podcasts"
  on public.podcasts for select
  using (auth.uid() = user_id);

create policy "Users can insert own podcasts"
  on public.podcasts for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own podcasts"
  on public.podcasts for delete
  using (auth.uid() = user_id);

-- Auto-create profile when user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Auto-reset monthly usage counter
create or replace function public.reset_monthly_usage()
returns void
language plpgsql
as $$
begin
  update public.profiles
  set podcasts_this_month = 0,
      usage_reset_at = date_trunc('month', now()) + interval '1 month'
  where usage_reset_at <= now();
end;
$$;
