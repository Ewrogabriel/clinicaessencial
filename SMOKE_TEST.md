# 🧪 **Smoke Test - Validação Rápida Local**

## **Objetivo**
Validar que todos os componentes da Fase 3 estão funcionando corretamente antes do deploy em produção.

---

## **⚡ Quick Start (5 minutos)**

### **1. Iniciar Servidor Local**
```bash
cd "c:\Users\ewro_\app esse cial vs\app-essencial"
npm run dev
```

**Resultado Esperado:**
```
  VITE v... ready in ... ms

  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

---

## **✅ Teste 1: Validação ViaCEP (CEP Validator)**

### **Propósito**
Verificar que a integração com ViaCEP está funcionando.

### **Passos:**

1. **Abra em novo terminal:**
```powershell
# Teste direto via curl (Windows PowerShell)
$uri = "https://viacep.com.br/ws/01310100/json/"
$response = Invoke-WebRequest -Uri $uri -Method Get
$response.Content | ConvertFrom-Json | Format-Table -AutoSize
```

**Resultado Esperado:**
```
logradouro             : Avenida Paulista
bairro                 : Bela Vista
localidade             : São Paulo
uf                     : SP
cep                    : 01310-100
```

2. **Teste Adicional (CEP Inválido):**
```powershell
$uri = "https://viacep.com.br/ws/99999999/json/"
$response = Invoke-WebRequest -Uri $uri -Method Get
$response.Content
```

**Resultado Esperado:** `{"erro":true}`

---

## **✅ Teste 2: Importação com CEP**

### **Passos:**

1. **Abra no navegador:**
```
http://localhost:5173/importacao
```

2. **Selecione aba "Pacientes"**

3. **Clique "Baixar Modelo Excel"**
   - Arquivo: `modelo_pacientes.xlsx`

4. **Abra no Excel e preencha:**
```
| nome                | telefone      | email           | cep      | rua | bairro | cidade |
|---------------------|---------------|-----------------|----------|-----|--------|--------|
| João Silva          | (11) 99999-999| joao@example.com| 01310100 | ""  | ""     | ""     |
| Maria Santos        | (11) 88888-888| maria@ex.com    | 20040020 | ""  | ""     | ""     |
```

5. **Salve como CSV ou XLSX**

6. **Carregue no aplicativo:**
   - Arraste arquivo ou use "Browse"
   - Clique "Continuar"

7. **Mapeamento:**
   - Verifique se colunas estão mapeadas
   - Clique "Análise com IA" (opcional)
   - Clique "Resumo"

8. **Preview:**
   - Veja se campos foram preenchidos
   - Procure por: `rua`, `bairro`, `cidade` sendo preenchidos automaticamente

9. **Importar:**
   - Clique "Importar Agora"
   - Aguarde conclusão

**Resultado Esperado:**
✅ Pacientes importados com endereços completos
✅ Toast: "X registros importados com sucesso!"

---

## **✅ Teste 3: Configuração de Integrações**

### **Passos:**

1. **Abra em seu navegador:**
```
http://localhost:5173/clinic-settings
```

2. **Role até a aba "⚡ Integrações"**
   - Você deve ver: Banco Inter | Nibo | TransmiteNota

3. **Teste Banco Inter:**
   - Clique aba "Banco Inter"
   - Insira dados de teste:
     ```
     Client ID: test_client_id_12345
     Client Secret: test_secret_xyz789
     ```
   - Clique "Salvar Configuração"
   - **Resultado:** Toast "Configuração salva com sucesso!"

4. **Teste Nibo:**
   - Clique aba "Nibo"
   - Insira dados de teste:
     ```
     Chave API: test_api_key_abc123
     Account ID: 999888777
     Plano: Premium
     ```
   - Clique "Salvar Configuração"
   - **Resultado:** Toast "Configuração salva com sucesso!"

5. **Teste TransmiteNota:**
   - Clique aba "TransmiteNota"
   - Insira dados de teste:
     ```
     Token: test_token_abc123xyz
     CNPJ: 12345678000190
     Ambiente: Homolog
     ```
   - Clique "Salvar Configuração"
   - **Resultado:** Toast "Configuração salva com sucesso!"

6. **Verificar Ativação:**
   - Marque checkbox "Ativa esta integração" para cada uma
   - Salve novamente
   - Veja se badge muda de "Inativo" para "Ativo"

---

## **✅ Teste 4: Dashboard de Integrações**

### **Passos:**

1. **Abra em seu navegador:**
```
http://localhost:5173/financeiro
```

2. **Clique aba "⚡ Integrações"**
   - Você deve ver 3 cards:
     - 🏦 Banco Inter
     - 💰 Nibo
     - 📄 TransmiteNota

3. **Verificar Cards:**
   - Cada card mostra:
     - ✅ Status (Ativo/Inativo)
     - 📅 Última sincronização: "Nunca" (primeira vez)
     - 🔘 Badge de status
     - 🔄 Botão "Sincronizar Agora"

4. **Teste (Sincronização):**
   - Se integração está ativa, clique "Sincronizar Agora"
   - Observe:
     - Badge muda para "Pendente"
     - Spinner de carregamento ativo
     - Toast aparece com resultado
   - **Nota:** Se credenciais forem fake, receberá erro (esperado)

5. **Monitorar Logs:**
   - Abra DevTools (F12) > Console
   - Procure por logs de fetch para:
     - `/functions/v1/inter-sync`
     - `/functions/v1/nibo-sync`
     - `/functions/v1/transmitenota-emit`

---

## **✅ Teste 5: Validação de Componentes**

### **Verificar no Navegador:**

```javascript
// Abra DevTools (F12) > Console e execute:

// Teste 1: Verificar se React Query está carregado
window['@tanstack/react-query'] ? console.log('✅ React Query OK') : console.log('❌ React Query Missing')

// Teste 2: Verificar se Supabase está inicializado
window.supabase ? console.log('✅ Supabase OK') : console.log('❌ Supabase Missing')

// Teste 3: Verificar se Lucide icons estão carregados
document.querySelectorAll('[class*="lucide"]').length > 0 ? console.log('✅ Lucide OK') : console.log('❌ Lucide Missing')
```

---

## **❌ Testes de Erro (Expected Failures)**

### **Teste 1: CEP Inválido**
```
Input:  "99999999"
Resultado Esperado: Mensagem "CEP não encontrado"
Status: ✅ PASS (se receber erro, está correto)
```

### **Teste 2: Sincronizar sem Credenciais**
```
Configuração: Vazia
Ação: Clicar "Sincronizar Agora"
Resultado Esperado: Toast de erro ou falha na API
Status: ✅ PASS (erro é esperado)
```

### **Teste 3: Arquivo Vazio**
```
Importação: Arquivo sem dados
Resultado Esperado: Toast "Arquivo vazio ou sem dados"
Status: ✅ PASS (validação funciona)
```

---

## **🔍 Verificação de Console**

Abra DevTools (F12) e verifique:

### **Sem Errors:**
```
Espera-se: Nenhuma linha vermelha de erro
Avisos OK: Alguns warnings do webpack são normais
```

### **Procure por:**
```javascript
// ✅ OK - Normais
[HMR] connected
[vite] hmr update...
React development

// ❌ PROBLEMA - Investigue se vir:
Cannot find module 'react'
TypeError: IntegrationTabs is not a function
Cannot read properties of undefined
```

---

## **📋 Checklist Final**

- [ ] npm run dev executa sem erros
- [ ] http://localhost:5173 carrega página
- [ ] ViaCEP responde corretamente (teste via curl)
- [ ] Importação mostra opção "Integrações"
- [ ] ClinicSettings tem aba "⚡ Integrações"
- [ ] IntegrationTabs carrega com 3 abas
- [ ] Formulários aceitam input
- [ ] Botões "Salvar Configuração" funcionam
- [ ] Financeiro tem aba "⚡ Integrações"
- [ ] IntegrationStatus carrega 3 cards
- [ ] Botões "Sincronizar Agora" podem ser clicados
- [ ] Console sem erros críticos
- [ ] Build local sem erros: npm run build

---

## **⏱️ Tempo Estimado**

| Teste | Tempo |
|-------|-------|
| Teste 1 (ViaCEP) | 2 min |
| Teste 2 (Importação) | 5 min |
| Teste 3 (Config) | 5 min |
| Teste 4 (Dashboard) | 3 min |
| Teste 5 (Componentes) | 2 min |
| **Total** | **~17 min** |

---

## **🎯 Resultado Esperado**

```
✅ TODOS OS TESTES PASSANDO
├─ ViaCEP: Respondendo corretamente
├─ Importação: CEPs sendo enriquecidos
├─ Integrações: Configuráveis
├─ Dashboard: Mostrando status
├─ Console: Sem erros
└─ Build: Validado
```

---

## **❓ Se Algo Falhar**

1. **Limpe Cache:**
```bash
# Limpar npm cache
npm cache clean --force

# Reconstruir
npm install
npm run build
npm run dev
```

2. **Verifique Versões:**
```bash
npm list react
npm list @tanstack/react-query
npm list typescript
```

3. **Resetar Supabase Local (se usar):**
```bash
supabase stop
supabase start
```

4. **Consulte Logs:**
```bash
# Build completo com verbose
npm run build -- --trace-warnings
```

---

**Smoke Test by:** Copilot  
**Data:** 20/03/2026  
**Status:** ✅ Pronto para Validação
