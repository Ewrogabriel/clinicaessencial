-- Leaderboard view
CREATE OR REPLACE VIEW gamification_leaderboard AS
SELECT 
  p.id as paciente_id,
  p.nome,
  COALESCE(gp.total_pontos, 0) as total_pontos,
  gp.clinic_id,
  CASE 
    WHEN COALESCE(gp.total_pontos, 0) >= 1000 THEN 'Ouro'
    WHEN COALESCE(gp.total_pontos, 0) >= 500 THEN 'Prata'
    WHEN COALESCE(gp.total_pontos, 0) >= 100 THEN 'Bronze'
    ELSE 'Iniciante'
  END as nivel,
  ROW_NUMBER() OVER (PARTITION BY gp.clinic_id ORDER BY COALESCE(gp.total_pontos, 0) DESC) as ranking
FROM pacientes p
LEFT JOIN gamification_pontos gp ON gp.paciente_id = p.id;
