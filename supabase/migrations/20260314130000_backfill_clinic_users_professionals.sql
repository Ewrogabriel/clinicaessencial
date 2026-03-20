-- Backfill clinic_users for existing professionals who were created before the
-- create-professional edge function was updated to insert into clinic_users.
-- Without a clinic_users row, the clinic_pacientes_select and pacientes_clinic_group_select
-- RLS policies block professionals from seeing any patients.
--
-- Strategy 1: infer clinic membership from agendamentos (most reliable signal)
INSERT INTO public.clinic_users (clinic_id, user_id, role)
SELECT DISTINCT
  a.clinic_id,
  a.profissional_id AS user_id,
  'profissional' AS role
FROM public.agendamentos a
INNER JOIN public.user_roles ur
  ON ur.user_id = a.profissional_id AND ur.role = 'profissional'
WHERE a.profissional_id IS NOT NULL
  AND a.clinic_id IS NOT NULL
ON CONFLICT (clinic_id, user_id) DO NOTHING;

-- Strategy 2: infer clinic membership from pacientes.profissional_id via clinic_pacientes
INSERT INTO public.clinic_users (clinic_id, user_id, role)
SELECT DISTINCT
  cp.clinic_id,
  p.profissional_id AS user_id,
  'profissional' AS role
FROM public.clinic_pacientes cp
INNER JOIN public.pacientes p ON p.id = cp.paciente_id
INNER JOIN public.user_roles ur
  ON ur.user_id = p.profissional_id AND ur.role = 'profissional'
WHERE p.profissional_id IS NOT NULL
ON CONFLICT (clinic_id, user_id) DO NOTHING;
