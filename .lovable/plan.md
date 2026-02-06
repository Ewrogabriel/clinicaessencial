

# Sistema de Gestão para Clínica de Fisioterapia e Pilates

Aplicativo web (PWA) completo para gerenciamento de clínicas de Fisioterapia, Pilates e RPG — em Português (Brasil), com design limpo e profissional.

---

## Fase 1 — Base e Cadastro de Pacientes

### Estrutura e Layout
- Layout principal com **sidebar de navegação** (menu lateral colapsável)
- Design com cores suaves e acolhedoras (tons de verde/azul, remetendo a saúde e bem-estar)
- Interface responsiva e otimizada para uso no celular (PWA)
- Idioma 100% em Português (Brasil)

### Tela de Login e Autenticação
- Login por e-mail e senha
- Dois perfis iniciais: **Administrador** e **Profissional**
- Controle de acesso por perfil (admin vê tudo, profissional vê apenas seus pacientes e agenda)

### Cadastro de Pacientes
- Formulário completo: nome, CPF, telefone/WhatsApp, e-mail, data de nascimento, endereço
- Campo de observações clínicas
- Tipo de atendimento: Fisioterapia, Pilates ou RPG
- Status: Ativo / Inativo
- Lista de pacientes com busca e filtros
- Visualização detalhada do perfil do paciente

---

## Fase 2 — Agenda Inteligente

### Calendário e Agendamento
- Visualização da agenda em modo **diário, semanal e mensal**
- Criação de agendamentos associando **paciente + profissional + tipo de atendimento**
- Tipos: Sessão individual ou Aula em grupo
- Duração configurável (30, 45, 60 minutos)
- Bloqueio de horários indisponíveis
- Reagendamento rápido e intuitivo

### Dashboard Principal
- Visão geral do dia: próximos atendimentos, pacientes do dia
- Indicadores rápidos: total de pacientes ativos, sessões do dia, avisos importantes

---

## Fase 3 — Controle de Planos e Sessões

### Gestão de Planos
- Criação de planos por pacote (ex: 10, 20 sessões)
- Controle automático de sessões utilizadas vs. restantes
- Alerta visual quando o plano estiver perto de vencer
- Histórico completo de atendimentos por paciente

### Notificações Internas
- Avisos dentro do sistema para:
  - Plano perto de vencer
  - Falta/no-show em atendimento
  - Sessão próxima (lembrete para o profissional)

---

## Fase 4 — Financeiro e Relatórios

### Financeiro Básico
- Registro de valor do plano e forma de pagamento
- Controle de situação: Pago / Pendente
- Resumo de faturamento mensal

### Relatórios
- Pacientes ativos e inativos
- Atendimentos por período
- Sessões realizadas por profissional
- Horários mais utilizados
- Exportação básica dos dados

---

## Tecnologia e Backend
- **Lovable Cloud (Supabase)** para banco de dados, autenticação e armazenamento seguro
- Estrutura modular preparada para escalar
- Dados sensíveis protegidos com políticas de segurança (RLS)

