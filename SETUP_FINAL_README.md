# Implementações Finais - Setup

## 1. Upload de Foto de Perfil do Paciente ✅

**Arquivo Modificado**: `src/pages/MeuPerfil.tsx`

O paciente agora pode:
- Visualizar sua foto de perfil atual
- Fazer upload de uma nova foto (JPG, PNG, GIF, etc.)
- A foto é armazenada no Supabase Storage
- A alteração é imediata, sem necessidade de aprovação do admin

**Como usar**:
1. Paciente acessa "Meu Perfil"
2. Clica na seção "Foto de Perfil"
3. Clica em "Escolher Arquivo"
4. Seleciona uma imagem
5. Foto é atualizada automaticamente

**Localização do armazenamento**: `pacientes/{pacienteId}/foto.{ext}`

---

## 2. Correção do Upload de Logo da Clínica ✅

**Arquivo Modificado**: `src/pages/ClinicSettings.tsx`

**Problemas Corrigidos**:
- Melhorado tratamento de erros com mensagens descritivas
- Adicionado timestamp ao nome do arquivo para evitar conflitos
- Adicionado try/catch com logging para melhor debugging
- Feedback visual durante o upload

**Como usar**:
1. Admin acessa "Configurações da Clínica"
2. Na seção de informações básicas, encontra o campo de Logo
3. Clica em "Escolher arquivo"
4. Seleciona uma imagem de logo
5. Logo é atualizada automaticamente

---

## 3. Regras de Comissão por Modalidade e Profissional ✅

**Arquivo Modificado**: `src/pages/Comissoes.tsx`

**SQL a Executar**: Execute o arquivo `SETUP_REGRAS_COMISSAO.sql` no Supabase

### Recursos Implementados:

#### Novo Card: "Configurar Regras de Comissão"
- Visível apenas para Admin e Gestor
- Mostra todas as regras cadastradas em um grid
- Botão "Nova Regra" para criar novas configurações

#### Dialog de Nova Regra
O admin pode criar regras especificando:
- **Tipo**: Modalidade ou Profissional
- **Entidade**: Qual modalidade/profissional (seletor dinâmico)
- **Percentual**: Taxa percentual (ex: 10.5%)
- **Valor Fixo**: Valor fixo por atendimento (ex: R$ 25.00)
- **Observações**: Notas adicionais (opcional)

### Como Usar:

1. **Criar Regra por Modalidade**:
   - Admin acessa "Comissões"
   - Clica em "Nova Regra"
   - Seleciona "Por Modalidade"
   - Escolhe a modalidade (ex: Pilates)
   - Define percentual (ex: 15%) OU valor fixo (ex: R$ 30.00) OU ambos
   - Clica em "Salvar Regra"

2. **Criar Regra por Profissional**:
   - Mesmo processo, mas seleciona "Por Profissional"
   - Escolhe o profissional
   - Define a comissão específica para esse profissional

3. **Visualizar Regras**:
   - As regras aparecem em um grid na seção "Configurar Regras"
   - Mostra tipo, percentual, valor fixo e observações

### Tabela Criada

```sql
CREATE TABLE regras_comissao (
  id UUID PRIMARY KEY,
  tipo VARCHAR(20) -- 'modalidade' ou 'profissional'
  entidade_id UUID,
  percentual DECIMAL(5, 2),
  valor_fixo DECIMAL(10, 2),
  observacoes TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### Notas Importantes:

- As regras são independentes das configurações antigas em profiles
- Você pode usar ambas as abordagens (percentual e valor fixo)
- A comissão é calculada como: `(valor_atendimento * percentual / 100) + (valor_fixo * total_atendimentos)`
- As regras aparecem no resumo de comissões mensais

---

## Setup Necessário

1. **Criar tabela de regras de comissão**:
   - Copie o conteúdo de `SETUP_REGRAS_COMISSAO.sql`
   - Cole no SQL Editor do Supabase
   - Clique em "Execute"

2. **Testar as funcionalidades**:
   - Paciente: Acesse "Meu Perfil" e faça upload de foto
   - Admin: Acesse "Configurações da Clínica" e atualize a logo
   - Admin: Acesse "Comissões" e crie regras de comissão

---

## Troubleshooting

### Foto de perfil não aparece
- Verifique se o arquivo foi enviado (veja os logs do console)
- Confirme que o Storage bucket está criado no Supabase
- Tente usar um arquivo menor (< 5MB)

### Erro ao fazer upload de logo
- Verifique se há espaço no Storage
- Confirme que o bucket "essencialfisiopilatesbq" existe
- Tente um nome de arquivo diferente

### Regras não aparecem
- Confirme que executou o SQL de setup
- Verifique se a tabela `regras_comissao` existe
- Confirme que você está logado como Admin/Gestor

---

## Melhorias Futuras

- Permitir edição de regras existentes
- Permitir exclusão de regras com confirmação
- Visualização de histórico de regras
- Aplicação automática de regras ao gerar comissões
