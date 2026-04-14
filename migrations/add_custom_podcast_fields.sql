-- Migration: Custom Podcast from File/URL
-- Adds source_type, source_label columns to podcasts and custom_podcast_count to profiles

alter table public.podcasts
  add column if not exists source_type text default 'address'
    check (source_type in ('address', 'file', 'url', 'text')),
  add column if not exists source_label text;

alter table public.profiles
  add column if not exists custom_podcast_count integer default 0;
