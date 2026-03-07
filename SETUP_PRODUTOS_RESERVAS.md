# Setup do Sistema de Reserva de Produtos

## Mudanças Implementadas

### 1. Dashboard do Paciente (PatientDashboard.tsx)
- ✅ **Filtro de Feriados**: Agora mostra apenas feriados cadastrados para os próximos 30 dias
- ✅ **Seção de Produtos**: Novo card exibindo produtos em estoque
- ✅ **Botão Reservar**: Permite ao paciente reservar produtos disponíveis
- ✅ **Dialog de Reserva**: Formulário com campo de observação obrigatório
- ✅ **Geração de Alertas**: Automaticamente cria um aviso para o ADM quando paciente faz reserva

### 2. Fluxo de Compra
1. Paciente vê produtos disponíveis no dashboard
2. Clica em "Reservar Agora"
3. Preenche observações (opcional)
4. Confirma a reserva
5. Sistema gera um alerta para o ADM
6. ADM entra em contato com o paciente para finalizar a compra na clínica
7. **Importante**: A compra não é finalizada automaticamente - a clínica controla o processo

## Como Configurar

### Passo 1: Executar SQL de Setup

1. Acesse o painel do Supabase
2. Vá para **SQL Editor**
3. Crie uma nova query
4. Copie e execute o conteúdo do arquivo `SETUP_PRODUTOS_RESERVAS.sql`
5. Aguarde a confirmação de sucesso

Este script criará:
- Tabela `reservas_produtos` (armazena as reservas dos pacientes)
- Tabela `avisos` (armazena alertas para o ADM)
- Índices para otimização de performance
- Políticas de RLS para segurança

### Passo 2: Verificar Produtos Cadastrados

Certifique-se de que os produtos estão cadastrados corretamente:

1. Acesse **Produtos** na aplicação
2. Verifique se há pelo menos 1 produto cadastrado com:
   - Nome
   - Preço
   - Estoque > 0
   - Status: Ativo

### Passo 3: Testar

1. Acesse o dashboard do paciente
2. Role até a seção **"Produtos em Estoque"**
3. Clique em "Reservar Agora" em um produto
4. Preencha a observação e confirme
5. Verifique se um aviso foi criado para o ADM

## Estrutura das Tabelas

### reservas_produtos
```
- id (UUID, chave primária)
- paciente_id (UUID, referência a pacientes)
- produto_id (UUID, referência a produtos)
- quantidade (int, padrão 1)
- observacao (text, opcional)
- status (varchar: 'pendente', 'confirmado', 'cancelado')
- data_reserva (timestamp)
- data_finalizada (timestamp, NULL até finalizar)
- created_at (timestamp)
- updated_at (timestamp)
```

### avisos
```
- id (UUID, chave primária)
- tipo (varchar: 'reserva_produto', etc)
- titulo (varchar)
- mensagem (text)
- reserva_id (UUID, referência a reservas_produtos)
- lido (boolean, padrão false)
- profissional_id (UUID, referência a auth.users)
- created_at (timestamp)
```

## Próximas Funcionalidades (Sugestões)

1. Painel ADM para visualizar reservas pendentes
2. Sistema para confirmar/cancelar reservas
3. Histórico de reservas do paciente
4. Notificação por email/WhatsApp quando reserva é confirmada
5. Integração com sistema de pagamento

## Troubleshooting

### Seção de Produtos não aparece
- Verifique se há produtos cadastrados com estoque > 0
- Verifique se a tabela `produtos` existe e tem dados

### Aviso não foi criado para o ADM
- Verifique se a tabela `avisos` foi criada corretamente
- Certifique-se de que a reserva foi salva (verifique em `reservas_produtos`)

### Erro "unknown column"
- Execute novamente o script SQL
- Verifique se todas as colunas foram criadas corretamente

## Suporte

Se encontrar problemas, verifique:
1. Se o SQL foi executado com sucesso
2. Se as tabelas existem no Supabase
3. Se há dados na tabela `produtos`
4. Os logs da aplicação (console do navegador)
