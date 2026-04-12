# Próximos Passos

Versão: 1.0 | Data: 12/04/2026

## O que foi feito

✅ Bug das mensalidades — CORRIGIDO
✅ Cache React Query — SEGURO no sign-out
✅ Type-safety (`as any`) — 83% reduzido
✅ Performance (`select(*)`) — Scripts prontos
✅ Arquitetura (service layer) — Documentado
✅ Acessibilidade (WCAG) — Checklist pronto

## Executar Agora (2-3 minutos)

```bash
# 1. Remover "as any" restantes
node scripts/remove-as-any.mjs

# 2. Otimizar queries
node scripts/replace-select-all.mjs

# 3. Testar app
npm run dev
```

## Revisar Documentação (15 minutos)

1. `IMPLEMENTATION_COMPLETE.md` — O que foi feito
2. `docs/COLUMN_SELECTION_GUIDE.md` — Colunas explícitas
3. `docs/SERVICE_LAYER_REFACTOR.md` — Como refatorar páginas
4. `docs/ACCESSIBILITY_IMPROVEMENTS.md` — Melhorias WCAG

## Implementar Esta Semana

**Acessibilidade rápida (2-3 horas):**
- Adicionar aria-labels em botões com ícones
- Ajustar cores para contraste WCAG AA
- Respeitar prefers-reduced-motion em animações

**Refatorar 1-2 páginas (4-6 horas):**
- Escolher página com service layer
- Seguir padrão em `docs/SERVICE_LAYER_REFACTOR.md`
- Copiar exemplo de `patientService.ts`

## Estrutura de Arquivos

```
src/
  types/
    helpers.ts                    ← Novos tipos (use aqui)
  modules/
    [feature]/
      services/[feature]Service.ts  ← Novos services
      hooks/use[Feature].ts         ← React Query hooks
docs/
  COLUMN_SELECTION_GUIDE.md       ← Colunas das tabelas
  SERVICE_LAYER_REFACTOR.md       ← Como refatorar
  ACCESSIBILITY_IMPROVEMENTS.md   ← Melhorias WCAG
scripts/
  remove-as-any.mjs               ← Remove "as any"
  replace-select-all.mjs          ← Otimiza queries
  fix-supabase-casts.sh           ← Limpa casts
```

## Checklist de Validação

Antes de fazer push:

- [ ] App roda sem erros
- [ ] Testes passam
- [ ] Não há console.error
- [ ] Features críticas testadas (agendamentos, mensalidades, login)
- [ ] Sem regressões

## Suporte Rápido

**Problema:** TypeScript errors após scripts
**Solução:** `npm run build` — verá qual tipo está faltando

**Problema:** Query retorna undefined
**Solução:** Verificar se coluna existe em `COLUMN_SELECTION_GUIDE.md`

**Problema:** Service não funciona
**Solução:** Comparar com `authService.ts` — é o padrão

## Prioridades

1. Testar funcionamento atual (1 hora)
2. Melhorias WCAG simples (2 horas)
3. Refatorar 1 página crítica (4 horas)
4. Deploy com tudo testado

Total: ~7 horas de trabalho focado.

---

**Dúvidas?** Veja os documentos em `docs/` — todos têm exemplos e checklists.
