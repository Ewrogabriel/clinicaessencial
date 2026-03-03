# Solução para o Erro "This project is configured to use bun"

## Problema

O Vercel está detectando que o repositório está configurado para usar `bun`, mas o projeto usa `npm`. Isso causa erro durante o build:

```
ERROR  This project is configured to use bun
For help, run: pnpm help
```

## Causa Raiz

Há um arquivo ou configuração no repositório Git que força o uso de `bun`. Isso pode ser:
- Um arquivo `bun.lockb` no repositório
- Uma configuração em `package.json` (campo `packageManager`)
- Configuração no histórico do Git

## Solução Aplicada

1. **Criado `.npmrc`** - Força uso de npm com `engine-strict=false`
2. **Criado `.corepackrc`** - Previne conflito de versões
3. **Script `cleanup.sh`** - Remove arquivos que forçam bun

## Como Fazer Push

Para resolver este problema permanentemente:

### Via GitHub (Opção Recomendada)

1. Abra o **Settings** do v0 (menu esquerdo)
2. Clique em **Git**
3. Faça commit das alterações:
   - Vai incluir `.npmrc` e `.corepackrc`
   - Vai remover arquivos de lock antigos
4. Clique em **"Commit & Push"**

### Via Linha de Comando

```bash
# Na raiz do projeto, execute:
rm -f bun.lockb pnpm-lock.yaml

# Adicione a configuração de npm
git add .npmrc .corepackrc
git commit -m "fix: Configurar projeto para usar npm ao invés de bun"
git push origin sistema-de-agendamento-aprimorado
```

## Verificação

Após fazer push, o Vercel fará redeploy automático. Você deve ver:
- ✅ `npm install` sendo executado (não bun ou pnpm)
- ✅ Build completando com sucesso
- ✅ Projeto online

## Troubleshooting

Se ainda aparecer erro após push:

1. **Limpe o cache do Vercel:**
   - Dashboard do Vercel → Projeto → Settings → Git → Redeploy

2. **Verifique se há `bun.lockb` no repositório:**
   - Se sim, delete com: `git rm bun.lockb && git push`

3. **Verifique package.json:**
   - Certifique-se que NÃO há campo `packageManager: "bun@..."`
