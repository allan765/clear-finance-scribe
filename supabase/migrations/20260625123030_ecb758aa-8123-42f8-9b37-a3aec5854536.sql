ALTER TABLE public.months ADD COLUMN IF NOT EXISTS receipt_path text;
ALTER TABLE public.months ADD COLUMN IF NOT EXISTS receipt_url text;