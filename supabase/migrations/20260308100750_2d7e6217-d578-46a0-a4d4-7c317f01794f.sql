
-- Limpar agendamentos
DELETE FROM agendamentos;

-- Limpar matriculas (weekly_schedules depende delas)
DELETE FROM weekly_schedules;
DELETE FROM matriculas;

-- Limpar dados clínicos
DELETE FROM evaluations;
DELETE FROM evolutions;
DELETE FROM patient_attachments;

-- Limpar financeiro
DELETE FROM pagamentos;
DELETE FROM planos;
DELETE FROM commissions;
DELETE FROM descontos_pacientes;

-- Limpar pacientes
DELETE FROM paciente_sessions;
DELETE FROM solicitacoes_remarcacao;
DELETE FROM pacientes;

-- Limpar disponibilidade/bloqueios/agenda extra
DELETE FROM disponibilidade_profissional;
DELETE FROM bloqueios_profissional;
DELETE FROM agenda_extra;

-- Limpar notificacoes
DELETE FROM notificacoes;

-- Limpar mensagens
DELETE FROM mensagens_internas;

-- Limpar permissões e roles de não-admins
DELETE FROM user_permissions WHERE user_id != '9ed16505-a579-4482-82b0-3ef49d697212';
DELETE FROM user_roles WHERE user_id != '9ed16505-a579-4482-82b0-3ef49d697212';

-- Limpar profiles de não-admins
DELETE FROM profiles WHERE user_id != '9ed16505-a579-4482-82b0-3ef49d697212';

-- Limpar documentos profissionais
DELETE FROM professional_documents;

-- Limpar regras comissão
DELETE FROM regras_comissao;
