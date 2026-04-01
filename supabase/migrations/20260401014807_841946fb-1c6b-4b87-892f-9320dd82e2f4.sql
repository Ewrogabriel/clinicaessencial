CREATE OR REPLACE VIEW public.v_saas_status AS
SELECT
  c.id AS clinic_id,
  c.nome AS clinic_name,
  COALESCE(pp.nome, 'Free/Legacy') AS plan_name,
  COALESCE(pp.max_pacientes, 10) AS max_patients,
  COALESCE(pp.max_profissionais, 1) AS max_professionals,
  COALESCE(pp.nome IN ('Premium', 'Enterprise'), false) AS has_bi,
  COALESCE(pp.nome IN ('Profissional', 'Premium', 'Enterprise'), false) AS has_premium_agenda,
  COALESCE(pp.nome IN ('Enterprise'), false) AS has_api,
  cs.status AS subscription_status,
  cs.data_vencimento AS current_period_end
FROM clinicas c
LEFT JOIN clinic_subscriptions cs ON cs.clinic_id = c.id
LEFT JOIN platform_plans pp ON pp.id = cs.plan_id;