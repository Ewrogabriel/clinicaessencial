# Melhorias de Acessibilidade WCAG

Este documento fornece um checklist de acessibilidade e como implementar as correções.

## Problemas Identificados

### 1. Botões sem aria-label
Botões com apenas ícones não têm rótulo acessível.

**Problema:**
```tsx
// ❌ Ruim - sem descrição para leitores de tela
<Button variant="ghost" size="icon">
  <Edit2 className="w-4 h-4" />
</Button>
```

**Solução:**
```tsx
// ✅ Bom - com aria-label
<Button variant="ghost" size="icon" aria-label="Editar">
  <Edit2 className="w-4 h-4" />
</Button>
```

### 2. Contraste de cores (--muted-foreground)
A cor `--muted-foreground` não tem contraste suficiente para WCAG AA.

**Checklist de Contraste:**
- AA: 4.5:1 para texto normal, 3:1 para grande
- AAA: 7:1 para texto normal, 4.5:1 para grande

**Como verificar:**
1. Abra DevTools > Elements > :root ou arquivo de variáveis CSS
2. Veja valor de `--muted-foreground`
3. Use [Contrast Checker](https://webaim.org/resources/contrastchecker/)

**Correção (em `src/app/globals.css` ou equivalente):**
```css
:root {
  /* Aumentar escuridade se o background é claro */
  --muted-foreground: #666666; /* De #999999 para melhor contraste */
}
```

### 3. Animações e prefers-reduced-motion
Animações devem respeitar preferência de movimento reduzido.

**Problema:**
```css
/* ❌ Não respeita preferência do usuário */
.spinner {
  animation: spin 1s linear infinite;
}
```

**Solução:**
```css
/* ✅ Respeita prefers-reduced-motion */
.spinner {
  animation: spin 1s linear infinite;
}

@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation: none;
  }
}
```

## Checklist de Implementação

### Botões com Ícones

- [ ] Revisar todos os `<Button>` com apenas ícones
- [ ] Adicionar `aria-label` descritivo
- [ ] Considerar adicionar `title` para tooltip

Exemplo com busca:
```bash
grep -r "variant=\"ghost\".*size=\"icon\"" src --include="*.tsx"
```

### Cores e Contraste

- [ ] Validar todas as cores com [Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [ ] Testar em modo de alto contraste (Windows > Ease of Access)
- [ ] Verificar variáveis CSS em `globals.css`

### Animações

- [ ] Adicionar `@media (prefers-reduced-motion: reduce)` em CSS
- [ ] Testar em macOS > System Preferences > Accessibility > Display > Reduce motion

### Formulários

- [ ] Todos os inputs têm labels associados com `<label htmlFor>`
- [ ] Mensagens de erro estão associadas com `aria-describedby`
- [ ] Campos obrigatórios têm `required` e `aria-required="true"`

### Estrutura Semântica

- [ ] Usar `<main>`, `<header>`, `<footer>`, `<nav>` apropriadamente
- [ ] Títulos seguem ordem hierárquica (h1 > h2 > h3)
- [ ] Listas usam `<ul>` ou `<ol>` em vez de divs
- [ ] Imagens têm `alt` text significativo

### Teclado

- [ ] Todos elementos interativos são alcançáveis com Tab
- [ ] Ordem de foco é lógica (usar `tabIndex` com moderação)
- [ ] Nenhum `tabIndex` > 0
- [ ] Links de skip estão presentes em páginas longas

## Script de Validação

Execute este comando para encontrar problemas comuns:

```bash
# Botões sem aria-label
grep -r "variant=\"ghost\".*size=\"icon\"" src --include="*.tsx" | grep -v aria-label

# Campos sem label
grep -r "<Input" src --include="*.tsx" | grep -v "htmlFor"

# Imagens sem alt
grep -r "<img" src --include="*.tsx" | grep -v alt
```

## Recursos

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [A11y Checklist](https://www.a11yproject.com/checklist/)
- [Accessible Buttons](https://www.a11yproject.com/posts/button-keys/)
- [Semantic HTML](https://www.a11yproject.com/posts/semantic-html/)

## Próximos Passos

1. Executar validação (scripts acima)
2. Categorizar problemas por severidade
3. Priorizar correções (WCAG A > AA > AAA)
4. Implementar usando a solução apropriada
5. Testar com:
   - Leitor de tela (NVDA, JAWS, ou VoiceOver)
   - Apenas teclado
   - Zoom até 200%
   - Modo de alto contraste
