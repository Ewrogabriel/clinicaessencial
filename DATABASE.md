# Fisio Flow Care — Database Documentation

> Supabase (PostgreSQL) — 82 tables, 104 migrations, 6 enum types

---

## 1. Database Summary

| Category | Count |
|---|---|
| Total tables | 82 |
| Enum types | 6 |
| Migration files | 104 |
| RLS policies | Applied to all public tables |

---

## 2. Enum Types

```sql
tipo_sessao          = 'individual' | 'grupo' | 'teleconsulta' | 'domiciliar'
status_agendamento   = 'agendado' | 'confirmado' | 'realizado' | 'cancelado' | 'falta' | 'remarcado'
status_paciente      = 'ativo' | 'inativo' | 'suspenso'
status_plano         = 'ativo' | 'concluido' | 'cancelado' | 'vencido'
status_pagamento     = 'pendente' | 'pago' | 'vencido' | 'cancelado'
forma_pagamento      = 'dinheiro' | 'cartao_credito' | 'cartao_debito' | 'pix' | 'transferencia' | 'convenio' | 'outro'
app_role             = 'admin' | 'profissional' | 'paciente' | 'gestor' | 'secretario' | 'master'
```

---

## 3. Core Tables

### 3.1 Users & Authentication

#### `profiles`
Extends Supabase Auth `auth.users`. One row per authenticated user.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | Matches `auth.users.id` |
| `user_id` | uuid | Same as id (denormalised for joins) |
| `nome` | text | Display name |
| `email` | text | User email |
| `telefone` | text | Phone number |
| `role` | app_role | Primary role |
| `especialidade` | text | Professional speciality |
| `commission_rate` | numeric | Commission percentage |
| `commission_fixed` | numeric | Fixed commission amount |
| `cor_agenda` | text | Hex colour for calendar |
| `tipo_contratacao` | text | Employment type |
| `permissions` | jsonb | Fine-grained permission overrides |
| `created_at` | timestamptz | |

#### `user_roles`
Many-to-many: one user can have multiple roles.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → auth.users | |
| `role` | app_role | Assigned role |
| `created_at` | timestamptz | |

#### `user_permissions`
Fine-grained resource-level permissions.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → profiles | |
| `resource` | text | Resource name (e.g. "financeiro") |
| `access_level` | text | `'view'` or `'edit'` |
| `created_at` | timestamptz | |

#### `clinic_users`
Associates users with clinics.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `clinic_id` | uuid FK → clinicas | |
| `user_id` | uuid FK → profiles | |
| `role` | app_role | Role within this clinic |
| `created_at` | timestamptz | |

---

### 3.2 Clinics

#### `clinicas`
Clinic / tenant record.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `nome` | text | Clinic name |
| `cnpj` | text | Brazilian tax ID |
| `endereco` | text | Address |
| `cidade` | text | City |
| `estado` | text | State (UF) |
| `cep` | text | ZIP code |
| `telefone` | text | |
| `whatsapp` | text | |
| `email` | text | |
| `instagram` | text | |
| `logo_url` | text | Storage URL |
| `ativo` | boolean | Active flag |
| `clinic_group_id` | uuid FK → clinic_groups | Multi-clinic group |
| `created_at` | timestamptz | |

#### `clinic_settings`
Extended configuration per clinic.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK → clinicas | Same PK as clinicas |
| `nome` | text | Display name |
| `cnpj` | text | |
| `logo_url` | text | |
| `horario_abertura` | time | Opening time |
| `horario_fechamento` | time | Closing time |
| `duracao_sessao_padrao` | integer | Default session duration (minutes) |
| `intervalo_entre_sessoes` | integer | Buffer between sessions (minutes) |
| `capacidade_por_slot` | integer | Max patients per slot |
| `dias_semana` | integer[] | Open days (0=Sun, 6=Sat) |
| `config_pix_id` | uuid FK → config_pix | Default PIX config |

#### `clinic_groups`
Multi-clinic group entity (chain/franchise).

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `nome` | text | Group name |
| `descricao` | text | |
| `ativo` | boolean | |
| `created_by` | uuid FK → profiles | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

#### `clinic_group_members`
Links clinics to clinic groups.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `group_id` | uuid FK → clinic_groups | |
| `clinic_id` | uuid FK → clinicas | |
| `cross_booking_enabled` | boolean | Allow booking across clinics in group |
| `created_at` | timestamptz | |

#### `clinic_subscriptions`
SaaS subscription / plan for a clinic.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `clinic_id` | uuid FK → clinicas | |
| `plan_id` | uuid FK → platform_plans | |
| `status` | text | `active`, `cancelled`, `past_due` |
| `current_period_end` | timestamptz | Subscription expiry |
| `created_at` | timestamptz | |

#### `platform_plans`
SaaS plan catalogue (managed by master admin).

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `nome` | text | Plan name |
| `max_profissionais` | integer | Max professionals allowed |
| `max_pacientes` | integer | Max patients allowed |
| `max_agendamentos_mes` | integer | Max monthly appointments |
| `preco` | numeric | Monthly price |
| `features` | jsonb | Feature flags |

---

### 3.3 Patients

#### `pacientes`
Core patient record.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `nome` | text | Full name |
| `email` | text | |
| `telefone` | text | |
| `cpf` | text | Brazilian individual tax ID |
| `data_nascimento` | date | Date of birth |
| `sexo` | text | Gender |
| `status` | status_paciente | `ativo` \| `inativo` \| `suspenso` |
| `tipo_atendimento` | text | Treatment type / modality |
| `profissional_id` | uuid FK → profiles | Assigned professional |
| `user_id` | uuid FK → auth.users | Linked user account (for self-service) |
| `foto_url` | text | Profile photo |
| `observacoes` | text | Notes |
| `endereco` / `cidade` / `estado` / `cep` | text | Address fields |
| `responsavel_*` | text | Responsible party fields (for minors) |
| `created_by` | uuid FK → profiles | |
| `created_at` | timestamptz | |

#### `clinic_pacientes`
Associates patients with clinics (multi-clinic).

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `clinic_id` | uuid FK → clinicas | |
| `paciente_id` | uuid FK → pacientes | |
| `created_at` | timestamptz | |

---

### 3.4 Appointments & Scheduling

#### `agendamentos`
Core appointment / session record.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `paciente_id` | uuid FK → pacientes | |
| `profissional_id` | uuid FK → profiles | |
| `data_horario` | timestamptz | Start date and time |
| `duracao_minutos` | integer | Session duration |
| `tipo_atendimento` | text | Treatment type |
| `tipo_sessao` | tipo_sessao | Session type enum |
| `status` | status_agendamento | Appointment status enum |
| `observacoes` | text | Notes |
| `recorrente` | boolean | Is recurring |
| `recorrencia_grupo_id` | uuid | Groups recurring series |
| `dias_semana` | integer[] | Days for recurrence |
| `frequencia_semanal` | integer | Weekly frequency |
| `recorrencia_fim` | date | End date for recurrence |
| `enrollment_id` | uuid FK → matriculas | Linked enrollment |
| `valor_sessao` | numeric | Session price |
| `valor_mensal` | numeric | Monthly value |
| `checkin_paciente` | boolean | Patient checked in |
| `checkin_profissional` | boolean | Professional checked in |
| `checkin_paciente_at` | timestamptz | |
| `checkin_profissional_at` | timestamptz | |
| `clinic_id` | uuid FK → clinicas | |
| `clinic_group_id` | uuid FK → clinic_groups | For cross-clinic bookings |
| `created_by` | uuid FK → profiles | |
| `created_at` | timestamptz | |

#### `disponibilidade_profissional`
Professional's available time slots.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `profissional_id` | uuid FK → profiles | |
| `clinic_id` | uuid FK → clinicas | |
| `data` | date | Availability date |
| `hora_inicio` | time | Start time |
| `hora_fim` | time | End time |
| `capacidade` | integer | Max concurrent patients |
| `tipo_sessao` | tipo_sessao | Allowed session type |
| `created_at` | timestamptz | |

#### `weekly_schedules`
Recurring weekly schedule template per professional.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `profissional_id` | uuid FK → profiles | |
| `clinic_id` | uuid FK → clinicas | |
| `dia_semana` | integer | Day of week (0–6) |
| `hora_inicio` | time | |
| `hora_fim` | time | |
| `capacidade` | integer | |
| `ativo` | boolean | |

#### `bloqueios_profissional`
Blocked time slots (vacations, unavailability).

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `profissional_id` | uuid FK → profiles | |
| `clinic_id` | uuid FK → clinicas | |
| `data_inicio` | timestamptz | |
| `data_fim` | timestamptz | |
| `motivo` | text | Reason |

#### `lista_espera`
Waiting list entries.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `paciente_id` | uuid FK → pacientes | |
| `profissional_id` | uuid FK → profiles | |
| `clinic_id` | uuid FK → clinicas | |
| `data_preferida` | date | Preferred date |
| `tipo_atendimento` | text | |
| `status` | text | `aguardando` \| `agendado` \| `cancelado` |
| `created_at` | timestamptz | |

#### `feriados`
Clinic-specific holidays.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `clinic_id` | uuid FK → clinicas | |
| `data` | date | Holiday date |
| `descricao` | text | |

---

### 3.5 Financial

#### `pagamentos`
Payment records.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `paciente_id` | uuid FK → pacientes | |
| `profissional_id` | uuid FK → profiles | |
| `plano_id` | uuid FK → planos | |
| `clinic_id` | uuid FK → clinicas | |
| `valor` | numeric | Amount |
| `data_pagamento` | date | Payment date |
| `data_vencimento` | date | Due date |
| `forma_pagamento` | forma_pagamento | Payment method enum |
| `status` | status_pagamento | Payment status |
| `descricao` | text | |
| `observacoes` | text | |
| `created_by` | uuid FK → profiles | |
| `created_at` | timestamptz | |

#### `planos`
Session packages / treatment plans.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `paciente_id` | uuid FK → pacientes | |
| `profissional_id` | uuid FK → profiles | |
| `clinic_id` | uuid FK → clinicas | |
| `tipo_atendimento` | text | |
| `total_sessoes` | integer | Total sessions in plan |
| `sessoes_utilizadas` | integer | Used sessions |
| `valor` | numeric | Plan price |
| `status` | status_plano | |
| `data_inicio` | date | |
| `data_vencimento` | date | |
| `observacoes` | text | |

#### `matriculas`
Recurring enrollments (monthly billing).

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `paciente_id` | uuid FK → pacientes | |
| `profissional_id` | uuid FK → profiles | |
| `clinic_id` | uuid FK → clinicas | |
| `tipo` | text | Enrollment type |
| `tipo_atendimento` | text | |
| `valor_mensal` | numeric | Monthly amount |
| `data_inicio` | date | |
| `data_vencimento` | date | |
| `due_day` | integer | Day of month for billing |
| `auto_renew` | boolean | |
| `status` | text | |
| `desconto` | numeric | Discount amount |
| `cancellation_date` | date | |

#### `pagamentos_mensalidade`
Monthly enrollment payments.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `matricula_id` | uuid FK → matriculas | |
| `paciente_id` | uuid FK → pacientes | |
| `clinic_id` | uuid FK → clinicas | |
| `valor` | numeric | |
| `data_vencimento` | date | |
| `data_pagamento` | date | |
| `status` | status_pagamento | |
| `forma_pagamento` | forma_pagamento | |

#### `expenses`
Clinic operating expenses.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `clinic_id` | uuid FK → clinicas | |
| `descricao` | text | |
| `valor` | numeric | |
| `categoria` | text | |
| `status` | text | |
| `data_vencimento` | date | |
| `data_pagamento` | date | |

#### `commissions`
Professional commission records.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `professional_id` | uuid FK → profiles | |
| `clinic_id` | uuid FK → clinicas | |
| `agendamento_id` | uuid FK → agendamentos | |
| `valor` | numeric | Commission amount |
| `status` | text | `pendente` \| `pago` |
| `created_at` | timestamptz | |

#### `regras_comissao`
Commission rule definitions per professional.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `professional_id` | uuid FK → profiles | |
| `clinic_id` | uuid FK → clinicas | |
| `tipo` | text | `percentual` \| `fixo` |
| `valor` | numeric | Rate or fixed amount |
| `modalidade` | text | Applies to this modality (optional) |

#### `config_pix`
PIX payment configuration per clinic.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `clinic_id` | uuid FK → clinicas | |
| `chave_pix` | text | PIX key |
| `tipo_chave` | text | `cpf` \| `cnpj` \| `email` \| `telefone` \| `aleatoria` |
| `nome_beneficiario` | text | |
| `cidade_beneficiario` | text | |

#### `formas_pagamento`
Payment methods configured per clinic.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `clinic_id` | uuid FK → clinicas | |
| `nome` | text | Display name |
| `tipo` | forma_pagamento | |
| `ativo` | boolean | |
| `taxa_percentual` | numeric | Processing fee % |

#### `convenios`
Health insurance / benefit plans accepted.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `clinic_id` | uuid FK → clinicas | |
| `nome` | text | Plan name |
| `codigo` | text | Plan code |
| `ativo` | boolean | |

---

### 3.6 Clinical Records

#### `evolutions`
Patient evolution notes (SOAP notes).

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `paciente_id` | uuid FK → pacientes | |
| `profissional_id` | uuid FK → profiles | |
| `clinic_id` | uuid FK → clinicas | |
| `agendamento_id` | uuid FK → agendamentos | |
| `data_atendimento` | timestamptz | |
| `subjetivo` | text | Subjective |
| `objetivo` | text | Objective |
| `avaliacao` | text | Assessment |
| `plano` | text | Plan |
| `assinatura_url` | text | Digital signature storage URL |
| `created_at` | timestamptz | |

#### `evaluations`
Initial patient evaluations.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `paciente_id` | uuid FK → pacientes | |
| `profissional_id` | uuid FK → profiles | |
| `clinic_id` | uuid FK → clinicas | |
| `data_avaliacao` | timestamptz | |
| `queixa_principal` | text | Chief complaint |
| `historico` | text | Medical history |
| `exame_fisico` | text | Physical examination |
| `hipotese_diagnostica` | text | Diagnostic hypothesis |
| `plano_tratamento` | text | Treatment plan |
| `created_at` | timestamptz | |

#### `patient_attachments`
Files attached to patient records.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `paciente_id` | uuid FK → pacientes | |
| `clinic_id` | uuid FK → clinicas | |
| `file_name` | text | |
| `file_url` | text | Storage URL |
| `file_type` | text | MIME type |
| `descricao` | text | |
| `uploaded_by` | uuid FK → profiles | |
| `created_at` | timestamptz | |

#### `documentos_clinicos`
Clinical documents (e.g. reports, certificates).

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `paciente_id` | uuid FK → pacientes | |
| `profissional_id` | uuid FK → profiles | |
| `clinic_id` | uuid FK → clinicas | |
| `tipo` | text | Document type |
| `conteudo` | text | HTML/text content |
| `assinado` | boolean | Digitally signed |
| `assinatura_url` | text | |
| `created_at` | timestamptz | |

#### `contratos_digitais`
Digital contracts signed by patients.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `paciente_id` | uuid FK → pacientes | |
| `clinic_id` | uuid FK → clinicas | |
| `tipo_contrato` | text | |
| `conteudo` | text | |
| `assinado_em` | timestamptz | Signature timestamp |
| `assinatura_hash` | text | Integrity hash |

---

### 3.7 Professionals

#### `profissional_formacoes`
Professional education/credentials.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `profissional_id` | uuid FK → profiles | |
| `titulo` | text | Degree/title |
| `instituicao` | text | Institution |
| `ano_conclusao` | integer | |
| `certificado_url` | text | |

#### `professional_goals`
Performance goals per professional.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `professional_id` | uuid FK → profiles | |
| `clinic_id` | uuid FK → clinicas | |
| `metric_type` | text | e.g. `agendamentos`, `receita` |
| `target_value` | numeric | |
| `period` | text | `monthly` \| `weekly` |
| `created_at` | timestamptz | |

#### `professional_documents`
Professional's document storage.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `profissional_id` | uuid FK → profiles | |
| `tipo` | text | |
| `arquivo_url` | text | |
| `data_vencimento` | date | |

---

### 3.8 Inventory

#### `produtos`
Products for sale or use in sessions.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `clinic_id` | uuid FK → clinicas | |
| `nome` | text | |
| `descricao` | text | |
| `preco` | numeric | Unit price |
| `estoque` | integer | Current stock quantity |
| `categoria` | text | |
| `ativo` | boolean | |

#### `equipamentos`
Clinic equipment inventory.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `clinic_id` | uuid FK → clinicas | |
| `nome` | text | |
| `marca` | text | |
| `modelo` | text | |
| `numero_serie` | text | |
| `data_aquisicao` | date | |
| `status` | text | `ativo` \| `manutencao` \| `inativo` |

#### `entradas_estoque`
Stock movement log.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `produto_id` | uuid FK → produtos | |
| `clinic_id` | uuid FK → clinicas | |
| `quantidade` | integer | |
| `tipo` | text | `entrada` \| `saida` |
| `motivo` | text | |
| `created_by` | uuid FK → profiles | |
| `created_at` | timestamptz | |

#### `reservas_produtos`
Products reserved for a session/appointment.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `produto_id` | uuid FK → produtos | |
| `agendamento_id` | uuid FK → agendamentos | |
| `paciente_id` | uuid FK → pacientes | |
| `quantidade` | integer | |
| `status` | text | `reservado` \| `entregue` \| `cancelado` |

---

### 3.9 Gamification

#### `achievements`
Achievement definitions (badges, trophies).

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `clinic_id` | uuid FK → clinicas | |
| `nome` | text | |
| `descricao` | text | |
| `pontos` | integer | Points value |
| `icone` | text | Emoji or icon name |
| `criterio` | jsonb | Unlock criteria |

#### `patient_achievements`
Achievements earned by a patient.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `paciente_id` | uuid FK → pacientes | |
| `achievement_id` | uuid FK → achievements | |
| `clinic_id` | uuid FK → clinicas | |
| `earned_at` | timestamptz | |

#### `challenges`
Challenges definition.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `clinic_id` | uuid FK → clinicas | |
| `nome` | text | |
| `descricao` | text | |
| `pontos` | integer | |
| `duracao_dias` | integer | Challenge duration |
| `ativo` | boolean | |

#### `patient_challenges` / `patient_points`
Patient participation and accumulated points.

#### `rewards_catalog`
Redeemable rewards catalogue.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `clinic_id` | uuid FK → clinicas | |
| `nome` | text | |
| `descricao` | text | |
| `pontos_necessarios` | integer | Points to redeem |
| `estoque` | integer | Available quantity |

#### `rewards_redemptions`
Redemption records.

---

### 3.10 Other Tables

| Table | Purpose |
|---|---|
| `audit_logs` | Operation audit trail |
| `avisos` | Clinic announcements / notices |
| `marketing_campaigns` | Marketing campaign records |
| `landing_content` | Public landing page content |
| `mensagens_internas` | Internal messaging between clinic users |
| `notificacoes` | System notifications |
| `pesquisa_satisfacao` | NPS / satisfaction surveys |
| `pre_cadastros` | Patient pre-registration requests |
| `ficha_requests` | Requests to fill patient intake form |
| `solicitacoes_alteracao_dados` | Patient data change requests |
| `solicitacoes_mudanca_horario` | Appointment reschedule requests |
| `solicitacoes_remarcacao` | Rebooking requests |
| `politicas_cancelamento` | Cancellation policy definitions |
| `teleconsulta_sessions` | Teleconsultation session records |
| `teleconsulta_messages` | Messages within a teleconsultation |
| `contact_submissions` | Landing page contact form submissions |
| `agenda_extra` | Extra/irregular schedule slots |
| `config_nfe` | Electronic invoice (NF-e) configuration |
| `emissoes_nf` | Issued invoices |
| `modalidades` | Treatment modalities (pilates, physio, etc.) |
| `metas_clinica` | Clinic-level performance targets |
| `manual_sections` | In-app help manual sections |
| `planos_exercicios` | Exercise plans |
| `exercicios_plano` | Individual exercises within a plan |
| `pagamentos_sessoes` | Session payment tracking |
| `paciente_sessions` | Patient session log |
| `vendas_produtos` | Product sales records |
| `categorias_parceiros` | Partner/referral categories |
| `descontos_pacientes` | Patient-specific discounts |
| `precos_planos` | Plan pricing tiers |
| `fechamentos_comissao` | Commission settlement records |
| `subscription_payments` | SaaS subscription payment history |
| `professional_points` | Professional gamification points |

---

## 4. Key Relationships

```
auth.users ──────────────────────────── profiles (1:1)
profiles ────────────────────────────── user_roles (1:N)
profiles ────────────────────────────── user_permissions (1:N)
profiles ────────────────────────────── clinic_users (1:N)

clinicas ────────────────────────────── clinic_users (1:N)
clinicas ────────────────────────────── clinic_settings (1:1)
clinicas ────────────────────────────── clinic_subscriptions (1:1)
clinicas ←───────────────────────────── clinic_group_members (N:1 → clinic_groups)

pacientes ───────────────────────────── clinic_pacientes (N:M → clinicas)
pacientes ───────────────────────────── agendamentos (1:N)
pacientes ───────────────────────────── planos (1:N)
pacientes ───────────────────────────── pagamentos (1:N)
pacientes ───────────────────────────── matriculas (1:N)
pacientes ───────────────────────────── evolutions (1:N)
pacientes ───────────────────────────── evaluations (1:N)
pacientes ───────────────────────────── patient_achievements (1:N)
pacientes ───────────────────────────── patient_attachments (1:N)

agendamentos ────────────────────────── commissions (1:N)
agendamentos ────────────────────────── evolutions (1:N)
agendamentos ────────────────────────── pagamentos_sessoes (1:N)
agendamentos ←───────────────────────── matriculas (N:1)

profiles (profissional) ─────────────── agendamentos (1:N)
profiles (profissional) ─────────────── disponibilidade_profissional (1:N)
profiles (profissional) ─────────────── weekly_schedules (1:N)
profiles (profissional) ─────────────── professional_goals (1:N)
profiles (profissional) ─────────────── regras_comissao (1:N)
```

---

## 5. Security Model {#security}

### Row Level Security (RLS)

All public tables have RLS enabled. The core patterns are:

1. **Clinic isolation** — Most tables are filtered by `clinic_id`, ensuring users
   only see data from their clinic(s).

2. **Role-based access** — The `has_role()` database function is used in policies:
   ```sql
   CREATE POLICY "admins can read all" ON agendamentos
     FOR SELECT USING (has_role(auth.uid(), 'admin'));
   ```

3. **Patient self-service** — Patients can only read their own records
   (matched via `pacientes.user_id = auth.uid()`).

4. **Professional isolation** — Professionals see only appointments they are
   assigned to, plus clinic-level data they have access to.

### `has_role()` function

```sql
CREATE OR REPLACE FUNCTION has_role(user_id uuid, check_role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = $1
    AND user_roles.role = $2
  );
$$;
```

### `check_plan_limit()` function

Checks whether a clinic has reached its SaaS plan limits (professionals, patients,
appointments) before allowing inserts. Used in RLS `WITH CHECK` clauses.
