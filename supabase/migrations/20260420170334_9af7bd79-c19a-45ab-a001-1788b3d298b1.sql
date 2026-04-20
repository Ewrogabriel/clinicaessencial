
CREATE OR REPLACE FUNCTION public.get_dashboard_monthly_chart(p_clinic_id uuid DEFAULT NULL)
RETURNS TABLE(mes text, total bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH meses AS (
    SELECT date_trunc('month', (now() - (n || ' months')::interval))::date AS mes_inicio
    FROM generate_series(0, 5) n
  )
  SELECT 
    to_char(m.mes_inicio, 'Mon/YY') AS mes,
    COALESCE(COUNT(a.id), 0)::bigint AS total
  FROM meses m
  LEFT JOIN agendamentos a 
    ON date_trunc('month', a.data_horario)::date = m.mes_inicio
   AND a.status IN ('realizado', 'confirmado', 'agendado')
   AND (p_clinic_id IS NULL OR a.clinic_id = p_clinic_id)
  GROUP BY m.mes_inicio
  ORDER BY m.mes_inicio ASC;
END;
$$;
