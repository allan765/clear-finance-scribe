GRANT SELECT, INSERT, UPDATE, DELETE ON public.settings TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.months TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entries TO anon, authenticated;
GRANT ALL ON public.settings TO service_role;
GRANT ALL ON public.months TO service_role;
GRANT ALL ON public.entries TO service_role;