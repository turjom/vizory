-- Persist SKU price display currency (set from device locale on first SKU save in app)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_currency_code TEXT;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_preferred_currency_code_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_preferred_currency_code_check
  CHECK (
    preferred_currency_code IS NULL
    OR preferred_currency_code IN ('USD', 'GBP', 'EUR', 'SGD', 'JPY', 'INR')
  );
