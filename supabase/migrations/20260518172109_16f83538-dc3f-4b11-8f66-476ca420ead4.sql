
-- Enum de classificações
CREATE TYPE public.classification AS ENUM (
  'salario','supermercado','agua_esgoto','energia','internet',
  'telefone','combustivel','farmacia','condominio','aplicacao_poupanca',
  'transferencias','saude','educacao','lazer','vestuario',
  'alimentacao','transporte','impostos','outros','nao_classificado'
);

-- Tabela de meses
CREATE TABLE public.months (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL UNIQUE, -- 'YYYY-MM'
  year INT NOT NULL,
  month INT NOT NULL,
  closed BOOLEAN NOT NULL DEFAULT false,
  closed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lançamentos
CREATE TABLE public.entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month_id UUID NOT NULL REFERENCES public.months(id) ON DELETE CASCADE,
  doc_number INT NOT NULL,
  entry_date DATE NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  classification public.classification NOT NULL DEFAULT 'nao_classificado',
  credit NUMERIC(14,2) NOT NULL DEFAULT 0,
  debit NUMERIC(14,2) NOT NULL DEFAULT 0,
  notes TEXT,
  receipt_url TEXT,
  receipt_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX entries_month_idx ON public.entries(month_id, entry_date, doc_number);

-- Configurações globais (uma linha)
CREATE TABLE public.settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  responsible TEXT NOT NULL DEFAULT 'Contador - Allan da Silva Coghi - CRC - DF-028822/O',
  identification TEXT NOT NULL DEFAULT 'Curatela - Joao Resende Filho',
  initial_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  period_start TEXT NOT NULL DEFAULT '2025-06',
  period_end TEXT NOT NULL DEFAULT '2026-06',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.settings (id) VALUES (gen_random_uuid());

-- Sem login: políticas abertas
ALTER TABLE public.months ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "open_all_months" ON public.months FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_all_entries" ON public.entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_all_settings" ON public.settings FOR ALL USING (true) WITH CHECK (true);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_months_upd BEFORE UPDATE ON public.months
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_entries_upd BEFORE UPDATE ON public.entries
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_settings_upd BEFORE UPDATE ON public.settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Pré-popula meses Jun/2025 → Jun/2026
INSERT INTO public.months (reference, year, month)
SELECT to_char(d, 'YYYY-MM'),
       EXTRACT(YEAR FROM d)::INT,
       EXTRACT(MONTH FROM d)::INT
FROM generate_series('2025-06-01'::date, '2026-06-01'::date, '1 month') d;

-- Bucket de comprovantes
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true);

CREATE POLICY "receipts_read" ON storage.objects FOR SELECT USING (bucket_id = 'receipts');
CREATE POLICY "receipts_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'receipts');
CREATE POLICY "receipts_update" ON storage.objects FOR UPDATE USING (bucket_id = 'receipts');
CREATE POLICY "receipts_delete" ON storage.objects FOR DELETE USING (bucket_id = 'receipts');
