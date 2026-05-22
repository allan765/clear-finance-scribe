ALTER TYPE public.classification ADD VALUE IF NOT EXISTS 'rendimento';
ALTER TYPE public.classification ADD VALUE IF NOT EXISTS 'cartao_credito';
ALTER TYPE public.classification ADD VALUE IF NOT EXISTS 'aposentadoria';
ALTER TYPE public.classification ADD VALUE IF NOT EXISTS 'reembolso';
ALTER TYPE public.classification ADD VALUE IF NOT EXISTS 'saque';
ALTER TYPE public.classification ADD VALUE IF NOT EXISTS 'darf_unificado';
ALTER TYPE public.classification ADD VALUE IF NOT EXISTS 'guia_simples_nacional';
ALTER TYPE public.classification ADD VALUE IF NOT EXISTS 'iptu';
ALTER TYPE public.classification ADD VALUE IF NOT EXISTS 'cartorio';
ALTER TYPE public.classification ADD VALUE IF NOT EXISTS 'pix_recebido';

UPDATE public.settings SET initial_balance = 54.26;