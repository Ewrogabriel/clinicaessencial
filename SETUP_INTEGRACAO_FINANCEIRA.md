# 🚀 **Guia de Setup para Integrações Financeiras**

## **1. Instalar Dependências**

Certifique-se de que todas as dependências estão instaladas:

```bash
pnpm install
```

Se usar npm:
```bash
npm install
```

**Dependências já incluídas no projeto:**
- ✅ react (^18)
- ✅ @tanstack/react-query
- ✅ lucide-react (para ícones)
- ✅ date-fns (para manipulação de datas)
- ✅ xlsx (para importação de planilhas)
- ✅ shadcn/ui (componentes)

---

## **2. Aplicar Migração de Banco de Dados**

Execute a migração SQL para criar as tabelas de integração:

```bash
# Opção 1: Via CLI do Supabase
supabase migration up

# Opção 2: Copiar conteúdo de SETUP_INTEGRACAO.sql
# e executar manualmente no Supabase Studio > SQL Editor
```

**Arquivo de migração:**
```
supabase/migrations/20260320_add_address_fields_integration_tables.sql
```

**Tabelas criadas:**
```sql
config_integracoes          -- Armazena credenciais de integrações
integracao_sync_logs        -- Log de todas as sincronizações
```

---

## **3. Configurar Variáveis de Ambiente**

Se usar Edge Functions localmente, configure `.env.local`:

```env
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua_chave_anonima
SUPABASE_SERVICE_ROLE_KEY=sua_chave_service_role
```

---

## **4. Testar Edge Functions**

### **Opção A: Deploy no Supabase (Recomendado)**

```bash
# Deploy todos os Edge Functions
supabase functions deploy inter-sync
supabase functions deploy nibo-sync
supabase functions deploy transmitenota-emit
supabase functions deploy cep-validator
```

---

## **5. Validar Endpoints**

Depois de deploy, teste os endpoints:

```bash
# Teste: Validar CEP
curl -X POST https://seu-projeto.supabase.co/functions/v1/cep-validator \
  -H "Content-Type: application/json" \
  -d '{
    "cep": "01310100"
  }'

# Resposta esperada:
# {
#   "logradouro": "Avenida Paulista",
#   "bairro": "Bela Vista",
#   "localidade": "São Paulo",
#   "uf": "SP",
#   ...
# }
```

---

## **6. Configurar Primeira Integração**

### **Banco Inter**

1. **Obter Credenciais:**
   - Acesse: https://www.bancointer.com.br/
   - Console > Developer > Aplicações
   - Crie nova aplicação
   - Copie `Client ID` e `Client Secret`

2. **Configurar no App:**
   - Vá para: `ClinicSettings > Integrações > Banco Inter`
   - Cole as credenciais
   - Clique "Testar Conexão"
   - Ative a integração
   - Salve

3. **Testar Sincronização:**
   - Vá para: `Financeiro > Integrações`
   - Clique "Sincronizar Agora" no card Banco Inter
   - Aguarde resultado

---

### **Nibo**

1. **Obter Credenciais:**
   - Acesse: https://www.nibo.com.br/
   - Painel > Integrações > API
   - Gere nova chave API
   - Copie `Account ID` no perfil

2. **Configurar no App:**
   - Vá para: `ClinicSettings > Integrações > Nibo`
   - Cole `API Key` e `Account ID`
   - Selecione seu plano comercial
   - Clique "Testar Conexão"
   - Ative e salve

3. **Testar Sincronização:**
   - Vá para: `Financeiro > Integrações`
   - Clique "Sincronizar Agora" no card Nibo
   - Aguarde resultado

---

### **TransmiteNota**

1. **Obter Token:**
   - Acesse: https://www.transmitenota.com.br/
   - Minha Conta > Integrações > Gerar Token
   - Copie o token gerado

2. **Configurar no App:**
   - Vá para: `ClinicSettings > Integrações > TransmiteNota`
   - Cole `Token` e `CNPJ da Clínica`
   - Selecione ambiente (Homolog para testes)
   - Clique "Validar Configuração"
   - Ative e salve

3. **Nota:** Emissão de NFS-e via UI será implementada após validação

---

## **7. Testar Importação com CEP**

1. **Baixar Template:**
   - Vá para: `ImportacaoMassa > Pacientes`
   - Clique "Baixar Modelo Excel"

2. **Preencher Dados:**
   - Insira pacientes com coluna `cep` (ex: `01310100`)
   - Deixe campos `rua`, `bairro`, `cidade`, `estado` vazios

3. **Carregar Arquivo:**
   - Selecione o arquivo no import
   - Sistema automaticamente completa endereços via ViaCEP

4. **Verificar Resultado:**
   - Vá para: `Matriculas > Pacientes`
   - Busque o paciente importado
   - Confirme que endereço foi preenchido corretamente

---

## **8. Dashboard de Monitoramento**

Acesse regularmente para monitorar saúde das integrações:

**Financeiro > Integrações**

Você verá:
- ✅ Status de cada integração (Ativo/Inativo)
- 📅 Última sincronização (data/hora)
- ✅/❌ Resultado da última tentativa
- 💬 Mensagem de erro (se houver)
- 🔄 Botão para sincronizar manualmente

**Lê-los logs detalhados:**
```sql
-- Consulte a tabela de logs no Supabase
SELECT * FROM integracao_sync_logs 
WHERE clinic_id = 'seu-clinic-id'
ORDER BY created_at DESC 
LIMIT 20;
```

---

## **9. Troubleshooting**

### **Erro: "CEP não encontrado"**
- Verifique se o CEP tem 8 dígitos
- ViaCEP retorna erro com CEP inválido
- Use: https://www.4devs.com.br/gerador_cep para gerar CEPs válidos

### **Erro: "Autenticação falhou no Banco Inter"**
- Confirme que Client ID/Secret estão corretos
- Verifique se credenciais têm permissões de leitura de extratos
- Teste no console do Banco Inter antes

### **Erro: "Configuração não encontrada"**
- Certifique-se de que salvou a integração
- Recarregue a página
- Verifique que clinic_id está correto no banco

### **Erro: "Edge Function não found"**
- Confirme que functions foram deployadas:
  ```bash
  supabase functions list
  ```
- Se não aparecer, faça deploy:
  ```bash
  supabase functions deploy inter-sync
  ```

---

## **10. Segurança e Considerações**

✅ **Boas Práticas Implementadas:**
- Credenciais armazenadas na tabela `config_integracoes` com RLS
- Campos sensíveis mascarados na UI
- Supabase fornece criptografia em repouso
- Todos os eventos de sincronização são auditados

⚠️ **Recomendações Adicionais:**
1. **Rotação de Credenciais:**
   - Banco Inter: rode Client Secret a cada 90 dias
   - Nibo: revogue antiga chave antes de gerar nova
   - TransmiteNota: mantenha token privado

2. **Monitoramento:**
   - Configure alertas via Slack/Email para erros de sincronização
   - Revise `integracao_sync_logs` semanalmente

3. **Backup:**
   - Mantenha backup das credenciais em local seguro (Vault 1Password, etc)
   - Não compartilhe credenciais via Slack/Email

---

## **11. Próximas Fases**

- [ ] Automação agendada (scheduler) para sincronizações periódicas
- [ ] Webhooks para eventos de pagamento em tempo real
- [ ] UI para emissão de NFS-e em lote
- [ ] Integração com sistema de contas a receber

---

**✅ Setup Completo!**  
Sua clínica agora está pronta para:
- 📊 Importar pacientes com endereços automáticos
- 🏦 Sincronizar pagamentos com Banco Inter
- 💰 Integrar gestão financeira com Nibo
- 📄 Emitir NFS-e com TransmiteNota
