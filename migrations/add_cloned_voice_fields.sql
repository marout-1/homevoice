-- Add cloned voice fields to profiles
alter table public.profiles
  add column if not exists cloned_voice_id text,
  add column if not exists cloned_voice_name text;
