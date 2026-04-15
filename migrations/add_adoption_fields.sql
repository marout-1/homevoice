-- Migration: Voice Cloning Adoption — Initiative support fields
-- Run in Supabase SQL editor

alter table public.profiles
  add column if not exists onboarding_clone_dismissed boolean default false,
  add column if not exists clone_email_sent           boolean default false,
  add column if not exists podcasts_count             integer default 0;

-- Back-fill podcasts_count from the podcasts table for existing users
update public.profiles p
set    podcasts_count = (
         select count(*)::integer
         from   public.podcasts pod
         where  pod.user_id = p.id
       )
where  podcasts_count = 0;
