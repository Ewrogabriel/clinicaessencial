# Plano de Melhorias - Essencial FisioPilates

## Estado Atual
- Build funcional com Vite + React 18 + TypeScript + Supabase
- RLS implementado em todas as tabelas
- Sistema de notificações, recibos PDF, mensagens internas já funcionando
- Tabelas recém-criadas: `formas_pagamento`, `config_pix`, `pagamentos_mensalidade`, `pagamentos_sessoes`, `solicitacoes_alteracao_dados`

---

## Fase 1 - Correções e Estabilidade (Prioridade Alta)

### 1.1 Corrigir warning do Dashboard
- [ ] `Dashboard.tsx` tem hooks condicionais (useState/useEffect após return condicional) — corrigir ordem dos hooks
- [ ] Resolver warning de ref em componente funcional (Dialog)

### 1.2 Painel de Aprovação Admin
- [ ] Criar página para admin visualizar solicitações de alteração de dados dos pacientes
- [ ] Botões de aprovar/rejeitar com motivo
- [ ] Ao aprovar, aplicar alterações na tabela `pacientes` automaticamente
- [ ] Adicionar rota e link no sidebar

### 1.3 Página de Formas de Pagamento
- [ ] Verificar se `FormasPagamento.tsx` está conectado às novas tabelas do banco
- [ ] CRUD de formas de pagamento para admin
- [ ] Configuração de chave PIX

---

## Fase 2 - UX e Performance (Prioridade Média)

### 2.1 Lazy Loading no PatientDashboard
- [ ] PatientDashboard.tsx tem 989 linhas — refatorar em componentes menores
- [ ] Implementar tabs (Agenda | Pagamentos | Produtos) em vez de tudo junto
- [ ] Carregar dados sob demanda por tab ativa

### 2.2 KPIs do Dashboard Profissional
- [ ] Cards: total pacientes ativos, sessões do mês, faturamento, taxa de falta
- [ ] Gráfico de sessões realizadas vs agendadas (recharts já instalado)
- [ ] Filtro por período (semana/mês/trimestre)

### 2.3 Relatórios de Comissão Detalhados
- [ ] Breakdown por modalidade e profissional
- [ ] Histórico de 12 meses com gráfico
- [ ] Exportação PDF/Excel (jspdf e xlsx já instalados)

---

## Fase 3 - Funcionalidades Novas (Prioridade Baixa)

### 3.1 Notificações Multi-canal
- [ ] Push notifications do navegador (Service Worker)
- [ ] Lembretes automáticos 24h antes da sessão (edge function com cron)

### 3.2 Chat Paciente-Profissional
- [ ] Estender `mensagens_internas` para suportar pacientes
- [ ] Realtime com Supabase channels

### 3.3 Integração de Pagamento
- [ ] Stripe para checkout online (Lovable tem integração nativa)
- [ ] Webhook para atualizar status automaticamente

---

## Arquivos Grandes que Precisam de Refatoração

| Arquivo | Linhas | Ação |
|---------|--------|------|
| `PatientDashboard.tsx` | 989 | Quebrar em componentes por seção |
| `Dashboard.tsx` | 747 | Extrair cards e queries em hooks |
| `PaymentForm.tsx` | 229 | Já no limite, monitorar |

---

## Notas Técnicas
- Next.js **não é possível** (Lovable usa Vite)
- App mobile nativa **não é possível** (apenas PWA via React)
- RLS já está implementado em todas as tabelas
- `react-hook-form` + `zod` já são usados para validação
