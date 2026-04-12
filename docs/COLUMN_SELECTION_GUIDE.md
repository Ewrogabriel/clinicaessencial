# Guia de Seleção de Colunas - Supabase

Este documento fornece as colunas explícitas para cada tabela do projeto, substitui as queries com `select("*")`.

## Tabelas Principais

### `clinicas`
```typescript
.select("id,nome,cnpj,email,telefone,whatsapp,endereco,numero,bairro,cidade,estado,cep,instagram,ativo,created_at,updated_at")
```

### `pacientes`
```typescript
.select("id,nome,cpf,email,data_nascimento,genero,telefone,celular,endereco,numero,complemento,bairro,cidade,estado,cep,profissao,estado_civil,mae_nome,referencia_como_chegou,ativo,clinic_id,created_at,updated_at")
```

### `profissionais`
```typescript
.select("id,nome,cpf,email,telefone,especialidade,numero_conselho,conselho_profissional,registro_conselho,ativo,clinic_id,created_at,updated_at")
```

### `agendamentos`
```typescript
.select("id,paciente_id,profissional_id,clinic_id,data_horario,duracao_minutos,tipo_sessao,tipo_atendimento,status,confirmacao_presenca,checkin_paciente,checkin_profissional,observacoes,enrollment_id,valor_sessao,valor_mensal,forma_pagamento,data_vencimento,recorrente,recorrencia_fim,recorrencia_grupo_id,dias_semana,frequencia_semanal,confirmacao_enviada_at,confirmacao_respondida_at,checkin_paciente_at,checkin_profissional_at,created_at,updated_at,created_by")
```

### `matriculas`
```typescript
.select("id,paciente_id,clinic_id,data_inicio,data_fim,tipo_sessao,tipo_atendimento,valor_mensal,status,ativo,observacoes,data_termino,created_at,updated_at")
```

### `pagamentos_mensalidade`
```typescript
.select("id,matricula_id,paciente_id,clinic_id,valor,mes_referencia,status,data_pagamento,forma_pagamento_id,observacoes,created_at,updated_at")
```

### `weekly_schedules`
```typescript
.select("id,enrollment_id,weekday,time,professional_id,session_duration,created_at,updated_at")
```

### `sessoes`
```typescript
.select("id,enrollment_id,paciente_id,profissional_id,clinic_id,data_horario,duracao_minutos,status,comparecimento,created_at,updated_at")
```

### `clinic_subscriptions`
```typescript
.select("id,clinic_id,plan_id,status,data_vencimento,responsavel_nome,responsavel_email,responsavel_telefone,observacoes,created_at,updated_at")
```

### `platform_plans`
```typescript
.select("id,nome,descricao,valor_mensal,recursos_disponiveis,ativo,cor,created_at,updated_at")
```

### `bloqueios_profissional`
```typescript
.select("id,profissional_id,data,hora_inicio,hora_fim,dia_inteiro,motivo,clinic_id,created_at,updated_at")
```

### `agenda_extra`
```typescript
.select("id,profissional_id,data,hora_inicio,hora_fim,max_pacientes,motivo,clinic_id,created_at,updated_at")
```

### `disponibilidade_profissional`
```typescript
.select("id,profissional_id,dia_semana,hora_inicio,hora_fim,intervalo_minutos,max_pacientes,clinic_id,created_at,updated_at")
```

### `feriados`
```typescript
.select("id,data,descricao,clinic_id,created_at,updated_at")
```

### `clinic_groups`
```typescript
.select("id,nome,descricao,clinic_id,created_at,updated_at")
```

### `clinic_group_members`
```typescript
.select("id,group_id,clinic_id,cross_booking_enabled,created_at,updated_at")
```

## Como Usar

Ao fazer uma query com Supabase, em vez de:

```typescript
// ❌ Evitar
const { data } = await supabase.from("clinicas").select("*");

// ✅ Preferir
const { data } = await supabase
  .from("clinicas")
  .select("id,nome,cnpj,email,telefone,whatsapp,endereco,numero,bairro,cidade,estado,cep,instagram,ativo,created_at,updated_at");
```

## Benefícios

1. **Performance**: Reduz payload de dados transferidos
2. **Type-safety**: TypeScript pode inferir corretamente as colunas retornadas
3. **Segurança**: Evita exposição acidental de colunas sensíveis
4. **Documentação**: Fica claro quais dados estão sendo solicitados

## Script de Automação

Execute o script abaixo para substituir automaticamente `select("*")`:

```bash
node scripts/replace-select-all.mjs
```
