-- Ensure profiles has onboarding completion flag (idempotent for older DBs)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS has_completed_onboarding BOOLEAN DEFAULT false;
