# Setup de Formas de Pagamento

Este documento descreve como configurar o sistema de formas de pagamento para sua clínica.

## 1. Criar Tabelas no Banco de Dados

Execute o SQL do arquivo `SETUP_FORMAS_PAGAMENTO.sql` no seu Supabase:

### Tabelas Criadas:
- **formas_pagamento** - Cadastro de formas de pagamento disponíveis
- **config_pix** - Configuração de dados PIX
- **pagamentos_mensalidade** - Registro de pagamentos de mensalidade
- **pagamentos_sessoes** - Registro de pagamentos de sessões

## 2. Acessar Menu de Formas de Pagamento

No painel do administrador, acesse:
**Menu → Configurações → Formas de Pagamento**

Ou acesse diretamente: `/formas-pagamento`

## 3. Configurar Formas de Pagamento

### Adicionar Nova Forma:
1. Clique em "Nova Forma"
2. Preencha:
   - **Nome**: Ex: "PIX", "Cartão de Crédito"
   - **Tipo**: Selecione entre PIX, Cartão, Dinheiro, Boleto, Cheque
   - **Descrição**: Informação adicional (opcional)

### Configurar PIX:
1. Selecione uma forma do tipo "PIX"
2. Clique no botão com ícone de QR Code
3. Preencha:
   - **Tipo de Chave**: CPF, Email, Telefone ou Chave Aleatória
   - **Chave PIX**: Digite a chave PIX
   - **Nome do Beneficiário**: Nome do titular

## 4. No Dashboard do Paciente

### Card de Formas de Pagamento Aparecerá Quando:
- Houver mensalidades ou sessões com pagamento aberto
- Houver pelo menos uma forma de pagamento ativa

### Funcionalidades:
- **Visualizar pendências**: Lista de mensalidades e sessões em aberto
- **Selecionar itens**: Escolher quais pagamentos realizar
- **Escolher forma de pagamento**: PIX, Cartão, Dinheiro, etc.
- **Ver dados PIX**: Se PIX estiver configurado, mostra chave e beneficiário
- **Copiar chave PIX**: Botão para copiar a chave automaticamente

## 5. Integração com Gateways de Pagamento

O componente `PaymentForm` está preparado para integração com gateways de pagamento:

### Passos para Integrar:
1. Instale a SDK do seu gateway (Stripe, MercadoPago, etc.)
2. Modifique o método `handlePaymentSubmit` em `PaymentForm.tsx`
3. Implemente a lógica de chamada para o gateway
4. Após sucesso, atualize o status do pagamento:

```typescript
// Exemplo para atualizar status após pagamento
const { error } = await supabase
  .from("pagamentos_mensalidade")
  .update({ status: "pago", data_pagamento: new Date() })
  .eq("id", payment_id);
```

## 6. Fluxo de Pagamento

### Fluxo Atual (Sem Gateway):
1. Paciente seleciona itens e forma de pagamento
2. Sistema envia instruções via email/WhatsApp
3. Admin marca manualmente como pago

### Fluxo com Gateway:
1. Paciente seleciona itens e forma de pagamento
2. Sistema redireciona para gateway (Stripe, MercadoPago, etc.)
3. Após confirmação, status é atualizado automaticamente

## 7. Estrutura de Componentes

### FormasPagamento.tsx (Admin)
- **Funcionalidade**: Gerenciar formas de pagamento
- **Rota**: `/formas-pagamento`
- **Acesso**: Admin/Gestor

### PatientDashboard.tsx (Paciente)
- **Card**: "Formas de Pagamento"
- **Exibe**: Mensalidades e sessões abertas
- **Ações**: Selecionar e pagar

### PaymentForm.tsx (Componente Reutilizável)
- **Uso**: Em modais ou páginas de pagamento
- **Props**: tipo, items, formasPagamento, configPix
- **Integrável**: Com qualquer gateway de pagamento

## 8. Customizações Recomendadas

- Adicionar logo da clínica no recibo
- Enviar comprovante de pagamento por email
- Gerar QR Code dinâmico para PIX (com valor incluído)
- Integrar com sistema de cobrança automática
- Notificar admin quando pagamento é realizado

## 9. Variáveis de Ambiente Necessárias

Se usar gateway de pagamento, adicione ao `.env.local`:

```
NEXT_PUBLIC_STRIPE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
# Ou para MercadoPago:
MERCADOPAGO_ACCESS_TOKEN=...
```

## 10. Troubleshooting

### Problema: Formas de pagamento não aparecem
- Verifique se `formas_pagamento` foram inseridas com `ativo = true`
- Confirme se há pagamentos abertos no banco

### Problema: Dados PIX não aparecem
- Verifique se `config_pix` foi salva para aquela forma
- Confirme se a `forma_pagamento_id` está correta

### Problema: Cards não aparecem no dashboard
- Verifique as queries de `pagamentos_mensalidade` e `pagamentos_sessoes`
- Confirme se o paciente tem registros com `status = 'aberto'`

## Suporte

Para questões ou sugestões, entre em contato com o time de desenvolvimento.
