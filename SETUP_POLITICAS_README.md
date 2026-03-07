# Sistema de Políticas de Cancelamento

## Visão Geral

Este sistema permite que você configure as políticas de cancelamento de sessões para sua clínica, incluindo prazos, limites e taxas.

## Configurações Disponíveis

### 1. Prazos de Cancelamento

- **Cancelamento COM Justificativa**: Tempo mínimo (em horas) antes da sessão para cancelar com justificativa. Padrão: 3 horas
- **Cancelamento SEM Justificativa**: Tempo mínimo (em horas) para cancelar sem justificativa. Padrão: 24 horas

### 2. Regras de Reagendamento

- **Reagendamento Mínimo**: Tempo mínimo (em horas) antes da sessão para reagendar. Padrão: 2 horas
- **Prazo para Remarcação**: Dias disponíveis (após cancelamento) para remarcar a sessão. Padrão: 30 dias
- **Prazo de Resposta**: Dias que o paciente tem para responder uma solicitação de remarcação. Padrão: 7 dias

### 3. Limites e Taxas

- **Limite de Cancelamentos/Mês**: Cancelamentos permitidos antes de incidência de taxa. Padrão: 2
- **Taxa Extra de Cancelamento**: Porcentagem da sessão cobrada para cancelamentos acima do limite. Padrão: 0%

### 4. Políticas Gerais

- **Cancelamento reduz mensalidade?**: Se ativado, a mensalidade é reduzida. **Por padrão está desativado** (cancelamento NÃO reduz mensalidade)
- **Gerar reposição automática?**: Se ativado, uma nova sessão é criada quando o paciente cancela

## Setup Initial

### 1. Executar SQL no Supabase

Execute o SQL do arquivo `SETUP_POLITICAS_CANCELAMENTO.sql` no painel SQL do Supabase:

```sql
-- Criar tabela de politicas de cancelamento
CREATE TABLE IF NOT EXISTS politicas_cancelamento (
  -- ... (ver arquivo SQL completo)
);
```

### 2. Acessar a Página de Configuração

Como admin, acesse a URL: `/politicas-cancelamento`

Ou adicione à navegação principal (editar o arquivo de rotas).

### 3. Configurar Políticas

1. Clique no botão "Editar"
2. Ajuste todos os parâmetros conforme necessário
3. Clique em "Salvar Alterações"
4. Para restaurar para padrão, clique em "Restaurar Padrão"

## Fluxo de Cancelamento para Pacientes

### Processo Atual

1. Paciente acessa "Minha Agenda"
2. Clica no ícone de lixo (Trash) para cancelar uma sessão
3. **Vê um alerta importante**: "O cancelamento desta sessão NÃO reduz o valor da sua mensalidade"
4. Preenche o motivo do cancelamento
5. Confirma o cancelamento

### Validações Automáticas

O sistema valida automaticamente:
- Se o cancelamento está dentro do prazo mínimo
- Se o paciente excedeu o limite de cancelamentos no mês
- Se deve aplicar taxa extra

## Pontos Importantes

### Aviso para Pacientes

Sempre que um paciente cancela uma sessão, ele vê um aviso em destaque informando que:
- **O cancelamento NÃO reduz a mensalidade**
- Ele continua pagando a mensalidade integral conforme contrato

### Reposição de Sessões

Se você ativar "Gerar reposição automática", quando um paciente cancela uma sessão:
1. A sessão é marcada como "cancelada"
2. Uma nova sessão é criada automaticamente para futuro
3. O paciente tem 30 dias (configurável) para remarcar

### Exemplo de Configuração Comum

Para uma clínica típica:

```
Cancelamento com justificativa: 3 horas
Cancelamento sem justificativa: 24 horas
Reagendamento mínimo: 2 horas
Prazo para remarcação: 30 dias
Limite de cancelamentos/mês: 2
Taxa extra: 10% (para cancelamentos acima do limite)
Cancelamento reduz mensalidade: NÃO
Gerar reposição automática: SIM
```

## Integração com Outras Páginas

### MinhaAgenda.tsx (Agenda do Paciente)

- Mostra alerta sobre cancelamento não reduzindo mensalidade
- Permite cancelar com motivo
- Valida prazos antes de permitir cancelamento

### PoliticasCancelamento.tsx (Admin)

- Página de configuração das políticas
- Dashboard visual das políticas atual
- Botões para editar, salvar e restaurar padrão

## Troubleshooting

### Página de Políticas não aparece

1. Verifique se executou o SQL de criação da tabela
2. Verifique se o usuário é admin
3. Confirme que a rota `/politicas-cancelamento` está adicionada ao roteador

### Alerta de cancelamento não aparece

1. Verifique se o arquivo `MinhaAgenda.tsx` foi atualizado
2. Limpe o cache do navegador (Ctrl+Shift+Delete)
3. Faça reload da página (Ctrl+F5)

### Campos não salvam

1. Verifique as permissões do usuário no banco (deve ser admin)
2. Confirme que a tabela `politicas_cancelamento` foi criada
3. Verifique se há erros no console do navegador (F12)

## Próximos Passos

Você pode estender este sistema com:

1. **Validação de Prazos**: Implementar validação real nos endpoints
2. **Histórico de Cancelamentos**: Registrar quem cancelou, quando e por quê
3. **Notificações**: Enviar email quando paciente cancela
4. **Relatórios**: Dashboard com estatísticas de cancelamentos
5. **Agendamentos Automáticos**: Criar reposição em data automática
