# Fisio Flow Care — Database Model

> ER-style database model reconstructed from Supabase migrations, service queries, and TypeScript types.
> **82 tables, 104 migrations, 7 enum types, RLS on all public tables.**

---

## 1. Enum Types

```sql
-- Session types
tipo_sessao = 'individual' | 'grupo' | 'teleconsulta' | 'domiciliar'

-- Appointment statuses (lifecycle)
status_agendamento = 'agendado' | 'confirmado' | 'realizado' | 'cancelado' | 'falta' | 'remarcado'

-- Patient statuses
status_paciente = 'ativo' | 'inativo' | 'suspenso'

-- Treatment plan statuses
status_plano = 'ativo' | 'concluido' | 'cancelado' | 'vencido'

-- Payment statuses
status_pagamento = 'pendente' | 'pago' | 'vencido' | 'cancelado'

-- Payment methods
forma_pagamento = 'dinheiro' | 'cartao_credito' | 'cartao_debito' | 'pix'
                | 'transferencia' | 'convenio' | 'outro'

-- Application roles
app_role = 'admin' | 'profissional' | 'paciente' | 'gestor' | 'secretario' | 'master'
```

---

## 2. Domain A — Identity & Access

### `auth.users` *(Supabase-managed)*
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | JWT subject |
| `email` | text | |
| `created_at` | timestamptz | |

### `profiles`
Extends `auth.users`. One row per authenticated user.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | = auth.users.id |
| `user_id` | uuid | Denormalised copy of id |
| `nome` | text | Display name |
| `email` | text | |
| `telefone` | text | |
| `role` | app_role | Primary role |
| `especialidade` | text | |
| `commission_rate` | numeric | Percentage (0–100) |
| `commission_fixed` | numeric | Fixed R$ amount |
| `cor_agenda` | text | Hex colour for calendar |
| `tipo_contratacao` | text | Employment type |
| `permissions` | jsonb | Fine-grained overrides |
| `created_at` | timestamptz | |

### `user_roles`
Many-to-many: user → role assignments.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → auth.users | |
| `role` | app_role | |
| `created_at` | timestamptz | |

### `user_permissions`
Resource-level access control per user.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → profiles | |
| `resource` | text | e.g. `'financeiro'`, `'relatorios'` |
| `access_level` | text | `'view'` or `'edit'` |
| `created_at` | timestamptz | |

### `clinic_users`
User ↔ Clinic membership.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → auth.users | |
| `clinic_id` | uuid FK → clinicas | |
| `role` | app_role | Role within this clinic |
| `created_at` | timestamptz | |

---

## 3. Domain B — Tenant (Clinic)

### `clinic_groups`
Top-level grouping for multi-unit organisations.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `nome` | text | Group name |
| `descricao` | text | |
| `created_at` | timestamptz | |

### `clinic_group_members`
Bridges `clinic_groups` ↔ `clinicas`.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `clinic_group_id` | uuid FK → clinic_groups | |
| `clinic_id` | uuid FK → clinicas | |
| `created_at` | timestamptz | |

### `clinicas`
One row per clinic tenant.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `nome` | text | Clinic name |
| `cnpj` | text | |
| `endereco` | text | |
| `telefone` | text | |
| `email` | text | |
| `logo_url` | text | Supabase Storage path |
| `owner_id` | uuid FK → auth.users | |
| `clinic_group_id` | uuid FK → clinic_groups | Added in migration 20260313230000 |
| `created_at` | timestamptz | |

### `clinic_settings`
Extended settings per clinic.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `clinic_id` | uuid FK → clinicas UNIQUE | |
| `horario_abertura` | time | |
| `horario_fechamento` | time | |
| `dias_funcionamento` | int[] | 0=Sun … 6=Sat |
| `intervalo_agendamento` | int | Minutes between slots |
| `configuracoes` | jsonb | Misc settings blob |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### `clinic_subscriptions`
Plan/subscription per clinic.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `clinic_id` | uuid FK → clinicas | |
| `plano_id` | uuid FK → planos_clinica | |
| `status` | text | `'ativo'` / `'cancelado'` |
| `data_inicio` | date | |
| `data_fim` | date | |
| `created_at` | timestamptz | |

### `planos_clinica`
Subscription plan definitions.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `nome` | text | Plan name |
| `limite_pacientes` | int | |
| `limite_profissionais` | int | |
| `limite_agendamentos_mes` | int | |
| `preco_mensal` | numeric | |
| `recursos` | jsonb | Feature flags |
| `created_at` | timestamptz | |

---

## 4. Domain C — Patients

### `pacientes`
Core patient record.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `nome` | text NOT NULL | |
| `cpf` | text | Unique per clinic |
| `data_nascimento` | date | |
| `telefone` | text | |
| `email` | text | |
| `endereco` | text | |
| `bairro` | text | |
| `cidade` | text | |
| `estado` | text | |
| `cep` | text | |
| `diagnostico` | text | |
| `queixa_principal` | text | |
| `observacoes` | text | |
| `status` | status_paciente | Default: `'ativo'` |
| `user_id` | uuid FK → auth.users | For portal access |
| `clinic_id` | uuid FK → clinicas | Tenant isolation |
| `profissional_responsavel` | uuid FK → profiles | |
| `data_cadastro` | timestamptz | |
| `created_at` | timestamptz | |

### `planos`
Treatment plans for a patient.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `paciente_id` | uuid FK → pacientes | |
| `clinic_id` | uuid FK → clinicas | |
| `tipo_plano` | text | e.g. `'fisioterapia'`, `'pilates'` |
| `numero_sessoes` | int | Total sessions in plan |
| `sessoes_realizadas` | int | |
| `valor_sessao` | numeric | |
| `valor_total` | numeric | |
| `data_inicio` | date | |
| `data_fim` | date | |
| `status` | status_plano | |
| `observacoes` | text | |
| `created_at` | timestamptz | |

### `patient_achievements`
Gamification: awarded achievements.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `paciente_id` | uuid FK → pacientes | |
| `achievement_type` | text | |
| `awarded_at` | timestamptz | |
| `metadata` | jsonb | |

### `patient_goals`
Patient-facing goals.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `paciente_id` | uuid FK → pacientes | |
| `titulo` | text | |
| `descricao` | text | |
| `meta_valor` | numeric | |
| `valor_atual` | numeric | |
| `concluida` | boolean | |
| `created_at` | timestamptz | |

### `patient_devices`
Push notification tokens.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → auth.users | |
| `device_token` | text | |
| `platform` | text | `'ios'` / `'android'` / `'web'` |
| `created_at` | timestamptz | |

---

## 5. Domain D — Scheduling

### `agendamentos`
Core appointment record.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `paciente_id` | uuid FK → pacientes | |
| `profissional_id` | uuid FK → profiles | |
| `clinic_id` | uuid FK → clinicas | |
| `clinic_group_id` | uuid FK → clinic_groups | Added 20260313230000 |
| `data_horario` | timestamptz | Date + time of appointment |
| `duracao_minutos` | int | Default: 50 |
| `status` | status_agendamento | |
| `tipo_atendimento` | text | Service type name |
| `tipo_sessao` | tipo_sessao | |
| `valor_sessao` | numeric | |
| `checkin_paciente` | boolean | |
| `checkin_profissional` | boolean | |
| `observacoes` | text | |
| `created_by` | uuid FK → auth.users | |
| `created_at` | timestamptz | |

### `disponibilidade_profissional`
Recurring availability slots.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `profissional_id` | uuid FK → profiles | |
| `clinic_id` | uuid FK → clinicas | |
| `dia_semana` | int | 0=Sun … 6=Sat |
| `hora_inicio` | time | |
| `hora_fim` | time | |
| `capacidade` | int | Max patients per slot |
| `created_at` | timestamptz | |

### `bloqueios_profissional`
Time-off / blocking periods.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `profissional_id` | uuid FK → profiles | |
| `clinic_id` | uuid FK → clinicas | |
| `data_inicio` | timestamptz | |
| `data_fim` | timestamptz | |
| `motivo` | text | |
| `created_at` | timestamptz | |

### `weekly_schedules`
Template-based weekly schedule.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `profissional_id` | uuid FK → profiles | |
| `clinic_id` | uuid FK → clinicas | |
| `dia_semana` | int | |
| `hora_inicio` | time | |
| `hora_fim` | time | |
| `tipo_sessao` | tipo_sessao | |
| `created_at` | timestamptz | |

### `availability_slots`
Generated concrete slots from weekly templates.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `profissional_id` | uuid FK → profiles | |
| `clinic_id` | uuid FK → clinicas | |
| `data_horario` | timestamptz | |
| `capacidade` | int | |
| `ocupado` | int | Current bookings count |
| `created_at` | timestamptz | |

### `modalidades`
Session modalities / service types.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `nome` | text | |
| `descricao` | text | |
| `duracao_padrao` | int | Minutes |
| `cor` | text | Hex colour |
| `clinic_id` | uuid FK → clinicas | |
| `created_at` | timestamptz | |

### `grupo_sessoes`
Group session definitions.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `profissional_id` | uuid FK → profiles | |
| `clinic_id` | uuid FK → clinicas | |
| `modalidade_id` | uuid FK → modalidades | |
| `data_horario` | timestamptz | |
| `capacidade_maxima` | int | |
| `created_at` | timestamptz | |

### `grupo_participantes`
Patient enrolments in group sessions.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `grupo_sessao_id` | uuid FK → grupo_sessoes | |
| `paciente_id` | uuid FK → pacientes | |
| `status` | status_agendamento | |
| `created_at` | timestamptz | |

### `teleconsultas`
Teleconsultation session records.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `agendamento_id` | uuid FK → agendamentos | |
| `link_sala` | text | Video call room URL |
| `status` | text | `'aguardando'` / `'em_andamento'` / `'encerrada'` |
| `iniciada_em` | timestamptz | |
| `encerrada_em` | timestamptz | |
| `created_at` | timestamptz | |

---

## 6. Domain E — Clinical Records

### `evolutions`
SOAP evolution notes per appointment.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `paciente_id` | uuid FK → pacientes | |
| `profissional_id` | uuid FK → profiles | |
| `agendamento_id` | uuid FK → agendamentos | |
| `data_atendimento` | date | |
| `tipo_atendimento` | text | |
| `subjetivo` | text | S — Subjective |
| `objetivo` | text | O — Objective |
| `avaliacao` | text | A — Assessment |
| `plano` | text | P — Plan |
| `observacoes` | text | |
| `created_at` | timestamptz | |

### `evaluations`
Formal clinical evaluations.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `paciente_id` | uuid FK → pacientes | |
| `profissional_id` | uuid FK → profiles | |
| `data_avaliacao` | date | |
| `tipo_avaliacao` | text | |
| `resultado` | jsonb | Structured evaluation data |
| `observacoes` | text | |
| `created_at` | timestamptz | |

### `documentos_clinicos`
Clinical document metadata.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `paciente_id` | uuid FK → pacientes | |
| `tipo` | text | `'laudo'`, `'receita'`, `'exame'`, etc. |
| `titulo` | text | |
| `conteudo` | text | Plain text or HTML |
| `arquivo_url` | text | Supabase Storage path |
| `created_by` | uuid FK → auth.users | |
| `created_at` | timestamptz | |

### `patient_attachments`
File attachments for patients.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `paciente_id` | uuid FK → pacientes | |
| `nome_arquivo` | text | |
| `tipo_arquivo` | text | MIME type |
| `url` | text | Supabase Storage path |
| `uploaded_by` | uuid FK → auth.users | |
| `created_at` | timestamptz | |

### `planos_exercicios`
Exercise programmes.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `paciente_id` | uuid FK → pacientes | |
| `profissional_id` | uuid FK → profiles | |
| `titulo` | text | |
| `descricao` | text | |
| `created_at` | timestamptz | |

### `exercicios_plano`
Individual exercises within a plan.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `plano_id` | uuid FK → planos_exercicios | |
| `nome` | text | |
| `series` | int | |
| `repeticoes` | int | |
| `carga` | text | Weight / resistance |
| `instrucoes` | text | |
| `ordem` | int | Display order |

---

## 7. Domain F — Finance

### `pagamentos`
Payment records linked to appointments.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `paciente_id` | uuid FK → pacientes | |
| `profissional_id` | uuid FK → profiles | |
| `agendamento_id` | uuid FK → agendamentos | Nullable |
| `clinic_id` | uuid FK → clinicas | |
| `valor` | numeric NOT NULL | |
| `forma_pagamento` | forma_pagamento | |
| `status` | status_pagamento | Default: `'pendente'` |
| `data_vencimento` | date | |
| `data_pagamento` | date | |
| `observacoes` | text | |
| `created_at` | timestamptz | |

### `expenses`
Clinic operational expenses.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `clinic_id` | uuid FK → clinicas | |
| `descricao` | text | |
| `valor` | numeric | |
| `categoria` | text | |
| `data_vencimento` | date | |
| `data_pagamento` | date | |
| `status` | status_pagamento | |
| `created_at` | timestamptz | |

### `commissions`
Computed commission records per professional per appointment.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `profissional_id` | uuid FK → profiles | |
| `agendamento_id` | uuid FK → agendamentos | |
| `clinic_id` | uuid FK → clinicas | |
| `valor_sessao` | numeric | |
| `percentual` | numeric | Applied % |
| `valor_comissao` | numeric | Computed amount |
| `status` | status_pagamento | |
| `created_at` | timestamptz | |

### `regras_comissao`
Commission rules per professional.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `profissional_id` | uuid FK → profiles | |
| `clinic_id` | uuid FK → clinicas | |
| `tipo` | text | `'percentual'` / `'fixo'` |
| `valor` | numeric | Rate or fixed R$ amount |
| `created_at` | timestamptz | |

### `config_pix`
PIX payment configuration per clinic.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `clinic_id` | uuid FK → clinicas UNIQUE | |
| `chave_pix` | text | |
| `tipo_chave` | text | `'cpf'` / `'cnpj'` / `'email'` / `'telefone'` / `'aleatoria'` |
| `nome_beneficiario` | text | |
| `cidade` | text | |
| `ativo` | boolean | |
| `created_at` | timestamptz | |

### `formas_pagamento`
Enabled payment methods per clinic.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `clinic_id` | uuid FK → clinicas | |
| `tipo` | forma_pagamento | |
| `ativo` | boolean | |
| `created_at` | timestamptz | |

### `convenios`
Health insurance agreements.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `clinic_id` | uuid FK → clinicas | |
| `nome` | text | |
| `codigo` | text | |
| `valor_sessao` | numeric | |
| `ativo` | boolean | |
| `created_at` | timestamptz | |

---

## 8. Domain G — Professionals

### `profissional_formacoes`
Academic qualifications.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `profissional_id` | uuid FK → profiles | |
| `titulo` | text | Degree title |
| `instituicao` | text | |
| `ano_conclusao` | int | |
| `created_at` | timestamptz | |

### `profissional_certificados`
Professional certificates.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `profissional_id` | uuid FK → profiles | |
| `titulo` | text | |
| `emissor` | text | |
| `data_emissao` | date | |
| `url_certificado` | text | |
| `created_at` | timestamptz | |

### `professional_goals`
Personal performance goals.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `profissional_id` | uuid FK → profiles | |
| `titulo` | text | |
| `meta_valor` | numeric | |
| `valor_atual` | numeric | |
| `periodo` | text | `'mensal'` / `'anual'` |
| `concluida` | boolean | |
| `created_at` | timestamptz | |

---

## 9. Domain H — Inventory

### `produtos`
Product catalogue.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `clinic_id` | uuid FK → clinicas | |
| `nome` | text | |
| `descricao` | text | |
| `preco_custo` | numeric | |
| `preco_venda` | numeric | |
| `estoque` | int | Current stock level |
| `estoque_minimo` | int | Alert threshold |
| `created_at` | timestamptz | |

### `equipamentos`
Clinic equipment register.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `clinic_id` | uuid FK → clinicas | |
| `nome` | text | |
| `numero_serie` | text | |
| `data_aquisicao` | date | |
| `ultima_manutencao` | date | |
| `proxima_manutencao` | date | |
| `status` | text | |
| `created_at` | timestamptz | |

### `entradas_estoque`
Stock entry movements.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `produto_id` | uuid FK → produtos | |
| `quantidade` | int | |
| `tipo` | text | `'entrada'` / `'saida'` |
| `motivo` | text | |
| `created_by` | uuid FK → auth.users | |
| `created_at` | timestamptz | |

### `reservas_produtos`
Product reservations per appointment.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `produto_id` | uuid FK → produtos | |
| `agendamento_id` | uuid FK → agendamentos | |
| `quantidade` | int | |
| `created_at` | timestamptz | |

---

## 10. Domain I — Communication

### `mensagens`
Internal clinic messages.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `clinic_id` | uuid FK → clinicas | |
| `remetente_id` | uuid FK → auth.users | |
| `destinatario_id` | uuid FK → auth.users | |
| `conteudo` | text | |
| `lida` | boolean | |
| `created_at` | timestamptz | |

### `avisos`
Admin broadcast notifications.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `clinic_id` | uuid FK → clinicas | |
| `titulo` | text | |
| `conteudo` | text | |
| `tipo` | text | |
| `ativo` | boolean | |
| `created_at` | timestamptz | |

### `automacoes`
Notification automation rules.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `clinic_id` | uuid FK → clinicas | |
| `tipo` | text | Trigger type |
| `configuracao` | jsonb | |
| `ativo` | boolean | |
| `created_at` | timestamptz | |

---

## 11. Domain J — Marketing & Audit

### `landing_content`
Clinic public site content blocks.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `clinic_id` | uuid FK → clinicas | |
| `secao` | text | Block section identifier |
| `conteudo` | jsonb | Block data |
| `created_at` | timestamptz | |

### `audit_logs`
Immutable audit trail for sensitive operations.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → auth.users | |
| `clinic_id` | uuid FK → clinicas | |
| `action` | text | e.g. `'patient.create'` |
| `resource_type` | text | |
| `resource_id` | uuid | |
| `metadata` | jsonb | |
| `created_at` | timestamptz | |

---

## 12. Key Relationships (ER Summary)

```
auth.users
  ├──< profiles           (1:1)
  ├──< user_roles         (1:N)
  ├──< user_permissions   (1:N)
  └──< clinic_users       (1:N)

clinicas
  ├── clinic_groups       (N:1, via clinic_group_id)
  ├──< clinic_users       (1:N)
  ├──< clinic_settings    (1:1)
  └──< clinic_subscriptions (1:N)

pacientes
  ├── clinicas            (N:1, clinic_id)
  ├── profiles            (N:1, profissional_responsavel)
  ├──< planos             (1:N)
  ├──< agendamentos       (1:N)
  ├──< pagamentos         (1:N)
  ├──< evolutions         (1:N)
  ├──< evaluations        (1:N)
  └──< patient_achievements (1:N)

agendamentos
  ├── pacientes           (N:1)
  ├── profiles            (N:1, profissional_id)
  ├── clinicas            (N:1)
  ├── clinic_groups       (N:1, via clinic_group_id)
  ├──< evolutions         (1:N)
  ├──< pagamentos         (1:N)
  ├──< commissions        (1:N)
  ├──< reservas_produtos  (1:N)
  └──< teleconsultas      (1:1)

profiles (professional)
  ├──< disponibilidade_profissional (1:N)
  ├──< bloqueios_profissional (1:N)
  ├──< weekly_schedules   (1:N)
  ├──< regras_comissao    (1:N)
  └──< professional_goals (1:N)
```

---

## 13. Database Functions (Security Definer)

These functions are used in RLS policies to evaluate access rules server-side:

| Function | Purpose |
|---|---|
| `has_role(user_id, role)` | Returns true if user has the given `app_role` |
| `check_plan_limit(clinic_id, resource)` | Returns true if clinic has not exceeded plan quota |
| `get_clinic_group_id(clinic_id)` | Returns the `clinic_group_id` for a clinic |
| `user_in_clinic_group(clinic_group_id)` | Returns true if current user belongs to any clinic in the group |
