# Instruções para Push das Alterações

Este arquivo contém as instruções para fazer push das alterações para o GitHub.

## Alterações Realizadas:

1. **Corrigidos imports de supabase** em:
   - `src/pages/Aniversariantes.tsx`
   - `src/pages/HistoricoSessoes.tsx`
   - `src/pages/Indicadores.tsx`
   - Alterado de: `@/lib/supabase`
   - Para: `@/integrations/supabase/client`

2. **Adicionadas configurações de build**:
   - `.npmrc` - Configuração do npm
   - `vercel.json` - Configuração do Vercel

## Como fazer push:

Execute estes comandos:

```bash
git add .
git commit -m "fix: Corrigir imports de supabase e configurar build"
git push origin sistema-de-agendamento-aprimorado
```

## Alternativa via v0:

Use o painel de Git no v0 Settings:
1. Abra Settings (menu esquerdo)
2. Clique em Git
3. Clique em "Create Pull Request" ou "Commit & Push"
