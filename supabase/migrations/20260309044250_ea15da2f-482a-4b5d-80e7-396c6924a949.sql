ALTER TABLE public.documentos_clinicos DROP CONSTRAINT documentos_clinicos_tipo_check;

ALTER TABLE public.documentos_clinicos ADD CONSTRAINT documentos_clinicos_tipo_check CHECK (tipo = ANY (ARRAY['receituario'::text, 'relatorio'::text, 'atestado'::text, 'encaminhamento'::text, 'comparecimento'::text, 'outros'::text]));