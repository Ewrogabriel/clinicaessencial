-- Create regras_comissao table for commission rules
CREATE TABLE IF NOT EXISTS regras_comissao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('modalidade', 'profissional')),
  entidade_id UUID NOT NULL,
  percentual DECIMAL(5, 2),
  valor_fixo DECIMAL(10, 2),
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES auth.users(id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_regras_comissao_tipo ON regras_comissao(tipo);
CREATE INDEX IF NOT EXISTS idx_regras_comissao_entidade_id ON regras_comissao(entidade_id);

-- Enable RLS
ALTER TABLE regras_comissao ENABLE ROW LEVEL SECURITY;

-- RLS: Admin and gestor can view and manage all rules
CREATE POLICY "admin_gestor_regras_comissao" ON regras_comissao
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'gestor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'gestor')
    )
  );

-- Professionals can view rules for their modalidades
CREATE POLICY "prof_view_regras" ON regras_comissao
  FOR SELECT
  USING (true);

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_regras_comissao_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_regras_comissao_timestamp ON regras_comissao;
CREATE TRIGGER trigger_update_regras_comissao_timestamp
  BEFORE UPDATE ON regras_comissao
  FOR EACH ROW
  EXECUTE FUNCTION update_regras_comissao_timestamp();
