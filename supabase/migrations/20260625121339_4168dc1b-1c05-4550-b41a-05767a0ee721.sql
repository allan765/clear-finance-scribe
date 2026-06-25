-- Replace overly-permissive FOR ALL policies with SELECT-only public read
DROP POLICY IF EXISTS open_all_entries ON public.entries;
DROP POLICY IF EXISTS open_all_months ON public.months;
DROP POLICY IF EXISTS open_all_settings ON public.settings;

CREATE POLICY "public_read_entries"  ON public.entries  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_read_months"   ON public.months   FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_read_settings" ON public.settings FOR SELECT TO anon, authenticated USING (true);

-- Drop any permissive storage policies tied to the receipts bucket
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (qual ILIKE '%receipts%' OR with_check ILIKE '%receipts%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
  END LOOP;
END $$;