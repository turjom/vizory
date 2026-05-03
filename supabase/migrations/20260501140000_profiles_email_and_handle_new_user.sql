-- Store signup email on profiles and populate profile fields from auth.users + user metadata.

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS email TEXT;

CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles (email);

-- Recreate trigger function: copy email from auth.users; names from raw_user_meta_data (set by client signUp options.data).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, first_name, last_name, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        NULLIF(TRIM(NEW.raw_user_meta_data->>'first_name'), ''),
        NULLIF(TRIM(NEW.raw_user_meta_data->>'last_name'), ''),
        NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
        NULLIF(TRIM(NEW.raw_user_meta_data->>'avatar_url'), '')
    );

    INSERT INTO public.user_preferences (id)
    VALUES (NEW.id);

    RETURN NEW;
END;
$$;
