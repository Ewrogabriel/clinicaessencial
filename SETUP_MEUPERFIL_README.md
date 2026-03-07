# Setup: Meu Perfil com Edição e Aprovação

## Visão Geral
Sistema de edição de perfil do paciente onde alterações requerem aprovação do administrador. Campos sensíveis (nome e CPF) são protegidos.

## Instalação

### 1. Criar a Tabela de Solicitações
Execute o SQL em `SETUP_SOLICITACOES_ALTERACAO.sql`:

```sql
-- Copie e execute todo o conteúdo do arquivo SETUP_SOLICITACOES_ALTERACAO.sql
-- no painel SQL do Supabase
```

### 2. Criar o Hook de Autenticação
O arquivo `src/hooks/useAuth.ts` já foi criado e fornece:
- `patientId`: ID do paciente logado
- `profile`: Perfil completo do paciente
- `loading`: Estado de carregamento
- `logout`: Função para fazer logout
- `isAuthenticated`: Booleano indicando se autenticado

### 3. Página Meu Perfil
A página `src/pages/MeuPerfil.tsx` foi atualizada com:
- Exibição de dados pessoais
- Modo de edição com validação
- Campos protegidos: Nome e CPF (não editáveis)
- Campos editáveis: Telefone, Email, Data de Nascimento, Tipo de Atendimento, Endereço
- Integração com sistema de solicitações de alteração

## Fluxo de Uso

### Para Pacientes
1. Acessar "Meu Perfil" no menu
2. Clicar em "Editar"
3. Fazer alterações nos campos (exceto Nome e CPF)
4. Clicar em "Enviar para Aprovação"
5. Aguardar aprovação do administrador
6. Ver alerta se houver solicitações pendentes

### Para Administrador
1. Acessar lista de solicitações de alteração de dados
2. Revisar alterações propostas
3. Aprovar ou rejeitar
4. Sistema notifica paciente da decisão

## Campos Editáveis

| Campo | Editável | Notas |
|-------|----------|-------|
| Nome | ❌ | Imutável por segurança |
| CPF | ❌ | Imutável por segurança |
| Telefone | ✅ | Pode ser alterado |
| Email | ✅ | Pode ser alterado |
| Data de Nascimento | ✅ | Pode ser alterado |
| Tipo de Atendimento | ✅ | Individual, Dupla, Grupal |
| Rua | ✅ | Pode ser alterado |
| Número | ✅ | Pode ser alterado |
| Complemento | ✅ | Pode ser alterado |
| CEP | ✅ | Pode ser alterado |
| Bairro | ✅ | Pode ser alterado |
| Cidade | ✅ | Pode ser alterado |
| Estado | ✅ | Pode ser alterado |

## Estrutura da Solicitação

```javascript
{
  id: "uuid",
  paciente_id: "uuid do paciente",
  dados_atuais: { /* dados antes da alteração */ },
  dados_novos: { /* dados após a alteração */ },
  status: "pendente" | "aprovado" | "rejeitado",
  motivo: "string opcional",
  aprovador_id: "uuid do admin que aprovou (opcional)",
  motivo_rejeicao: "string opcional",
  created_at: "timestamp",
  approved_at: "timestamp (opcional)"
}
```

## Próximas Etapas

1. **Criar painel de aprovação no admin** - Página para listar e gerenciar solicitações
2. **Notificações** - Email/SMS ao paciente quando solicitação for aprovada/rejeitada
3. **Histórico** - Manter histórico de todas as alterações aprovadas
4. **Auditoria** - Log de quem aprovou/rejeitou e quando

## Troubleshooting

### "Perfil não encontrado"
- Verificar se `patientId` está sendo recuperado corretamente do localStorage
- Verificar se a sessão ainda é válida (não expirou)

### Edição não está funcionando
- Verificar se o hook `useAuth` está importado corretamente
- Verificar se há erros no console do navegador

### Solicitação não é enviada
- Verificar permissões RLS no Supabase
- Verificar se a tabela `solicitacoes_alteracao_dados` foi criada corretamente
- Revisar logs de erro no console

## Notas de Segurança

- Alterações são armazenadas como snapshots JSONB completos
- Apenas administradores aprovam alterações
- Nome e CPF são imutáveis por design
- RLS protege dados do paciente
