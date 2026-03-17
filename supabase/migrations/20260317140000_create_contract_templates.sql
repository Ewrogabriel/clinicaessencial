-- Create contract_templates table
CREATE TABLE IF NOT EXISTS public.contrato_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID REFERENCES public.clinicas(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    conteudo TEXT NOT NULL,
    tipo TEXT NOT NULL, -- 'paciente', 'profissional', 'outros'
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contrato_templates ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Gestores podem ver e editar templates da sua clínica"
ON public.contrato_templates
FOR ALL
TO authenticated
USING (clinic_id IN (
    SELECT clinic_id FROM public.clinic_users WHERE user_id = auth.uid()
));

-- Seed initial templates if needed (optional)
INSERT INTO public.contrato_templates (nome, conteudo, tipo, clinic_id)
SELECT 'Contrato Padrão Paciente', 'Template inicial...', 'paciente', id
FROM public.clinicas
ON CONFLICT DO NOTHING;
