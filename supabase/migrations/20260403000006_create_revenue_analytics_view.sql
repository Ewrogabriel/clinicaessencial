-- Revenue analytics views
CREATE OR REPLACE VIEW revenue_analytics_monthly AS
SELECT 
  DATE_TRUNC('month', cs.created_at) as mes,
  COUNT(DISTINCT cs.clinic_id) as total_clinicas,
  COUNT(DISTINCT CASE WHEN cs.status = 'ativa' THEN cs.clinic_id END) as clinicas_ativas,
  COALESCE(SUM(pp.valor_mensal), 0) as mrr
FROM clinic_subscriptions cs
LEFT JOIN platform_plans pp ON pp.id = cs.plan_id
WHERE cs.status IN ('ativa', 'trial')
GROUP BY DATE_TRUNC('month', cs.created_at)
ORDER BY mes DESC;
