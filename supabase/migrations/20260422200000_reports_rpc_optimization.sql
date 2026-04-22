-- RPC to get unified payments statistics per Professional
CREATE OR REPLACE FUNCTION get_professional_reports_summary(
    p_start_date date,
    p_end_date date,
    p_clinic_id uuid DEFAULT NULL
)
RETURNS TABLE (
    profissional_id uuid,
    profissional_nome text,
    total_sessoes bigint,
    sessoes_realizadas bigint,
    sessoes_falta bigint,
    faturamento_recebido numeric,
    faturamento_pendente numeric,
    faturamento_total numeric
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH prof_sessions AS (
        SELECT 
            a.profissional_id,
            COUNT(a.id) as sessoes,
            COUNT(a.id) FILTER (WHERE a.status = 'realizado') as realizadas,
            COUNT(a.id) FILTER (WHERE a.status = 'falta') as faltas
        FROM agendamentos a
        WHERE a.data_horario >= p_start_date 
          AND a.data_horario < p_end_date
          AND (p_clinic_id IS NULL OR a.clinic_id = p_clinic_id)
          AND a.profissional_id IS NOT NULL
        GROUP BY a.profissional_id
    ),
    prof_payments AS (
        SELECT 
            vp.profissional_id,
            SUM(vp.valor) FILTER (WHERE vp.status = 'pago') as recebido,
            SUM(vp.valor) FILTER (WHERE vp.status IN ('pendente', 'aberto', 'nao_iniciado', 'parcialmente_pago')) as pendente
        FROM vw_unified_payments vp
        WHERE COALESCE(
                CASE WHEN vp.status = 'pago' THEN COALESCE(vp.data_pagamento, vp.data_vencimento)
                     ELSE COALESCE(vp.data_vencimento, vp.data_pagamento) END,
                '1970-01-01'::date
              ) >= p_start_date 
          AND COALESCE(
                CASE WHEN vp.status = 'pago' THEN COALESCE(vp.data_pagamento, vp.data_vencimento)
                     ELSE COALESCE(vp.data_vencimento, vp.data_pagamento) END,
                '1970-01-01'::date
              ) < p_end_date
          AND (p_clinic_id IS NULL OR vp.clinic_id = p_clinic_id)
          AND vp.profissional_id IS NOT NULL
        GROUP BY vp.profissional_id
    )
    SELECT 
        p.user_id as profissional_id,
        p.nome as profissional_nome,
        COALESCE(s.sessoes, 0) as total_sessoes,
        COALESCE(s.realizadas, 0) as sessoes_realizadas,
        COALESCE(s.faltas, 0) as sessoes_falta,
        COALESCE(pay.recebido, 0) as faturamento_recebido,
        COALESCE(pay.pendente, 0) as faturamento_pendente,
        (COALESCE(pay.recebido, 0) + COALESCE(pay.pendente, 0)) as faturamento_total
    FROM profiles p
    LEFT JOIN prof_sessions s ON s.profissional_id = p.user_id
    LEFT JOIN prof_payments pay ON pay.profissional_id = p.user_id
    WHERE (s.sessoes > 0 OR pay.recebido > 0 OR pay.pendente > 0)
      AND EXISTS (
          SELECT 1 FROM clinic_users cu 
          WHERE cu.user_id = p.user_id 
          AND (p_clinic_id IS NULL OR cu.clinic_id = p_clinic_id)
      )
    ORDER BY p.nome;
END;
$$;

-- RPC to get unified payments statistics per Patient
CREATE OR REPLACE FUNCTION get_patient_reports_summary(
    p_start_date date,
    p_end_date date,
    p_clinic_id uuid DEFAULT NULL
)
RETURNS TABLE (
    paciente_id uuid,
    paciente_nome text,
    total_sessoes bigint,
    sessoes_realizadas bigint,
    sessoes_falta bigint,
    taxa_faltas numeric,
    total_pago numeric,
    total_pendente numeric,
    ultima_sessao timestamp with time zone
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH pat_sessions AS (
        SELECT 
            a.paciente_id,
            COUNT(a.id) as sessoes,
            COUNT(a.id) FILTER (WHERE a.status = 'realizado') as realizadas,
            COUNT(a.id) FILTER (WHERE a.status = 'falta') as faltas,
            MAX(a.data_horario) as ultima
        FROM agendamentos a
        WHERE a.data_horario >= p_start_date 
          AND a.data_horario < p_end_date
          AND (p_clinic_id IS NULL OR a.clinic_id = p_clinic_id)
          AND a.paciente_id IS NOT NULL
        GROUP BY a.paciente_id
    ),
    pat_payments AS (
        SELECT 
            vp.paciente_id,
            SUM(vp.valor) FILTER (WHERE vp.status = 'pago') as pago,
            SUM(vp.valor) FILTER (WHERE vp.status IN ('pendente', 'aberto', 'nao_iniciado', 'parcialmente_pago')) as pendente
        FROM vw_unified_payments vp
        WHERE COALESCE(
                CASE WHEN vp.status = 'pago' THEN COALESCE(vp.data_pagamento, vp.data_vencimento)
                     ELSE COALESCE(vp.data_vencimento, vp.data_pagamento) END,
                '1970-01-01'::date
              ) >= p_start_date 
          AND COALESCE(
                CASE WHEN vp.status = 'pago' THEN COALESCE(vp.data_pagamento, vp.data_vencimento)
                     ELSE COALESCE(vp.data_vencimento, vp.data_pagamento) END,
                '1970-01-01'::date
              ) < p_end_date
          AND (p_clinic_id IS NULL OR vp.clinic_id = p_clinic_id)
          AND vp.paciente_id IS NOT NULL
        GROUP BY vp.paciente_id
    )
    SELECT 
        p.id as paciente_id,
        p.nome as paciente_nome,
        COALESCE(s.sessoes, 0) as total_sessoes,
        COALESCE(s.realizadas, 0) as sessoes_realizadas,
        COALESCE(s.faltas, 0) as sessoes_falta,
        CASE WHEN COALESCE(s.sessoes, 0) > 0 
             THEN ROUND((COALESCE(s.faltas, 0)::numeric / s.sessoes::numeric) * 100, 1) 
             ELSE 0 
        END as taxa_faltas,
        COALESCE(pay.pago, 0) as total_pago,
        COALESCE(pay.pendente, 0) as total_pendente,
        s.ultima as ultima_sessao
    FROM pacientes p
    LEFT JOIN pat_sessions s ON s.paciente_id = p.id
    LEFT JOIN pat_payments pay ON pay.paciente_id = p.id
    WHERE (s.sessoes > 0 OR pay.pago > 0 OR pay.pendente > 0)
      AND (p_clinic_id IS NULL OR EXISTS (
          SELECT 1 FROM clinic_pacientes cp 
          WHERE cp.paciente_id = p.id 
          AND cp.clinic_id = p_clinic_id
      ))
    ORDER BY p.nome;
END;
$$;
