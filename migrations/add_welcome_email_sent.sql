-- Add welcome_email_sent flag to profiles
-- Prevents duplicate welcome emails on repeat logins
alter table public.profiles
  add column if not exists welcome_email_sent boolean default false;
