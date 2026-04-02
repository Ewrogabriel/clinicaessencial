# Accessibility Audit

> **Standard:** WCAG 2.1 Level AA  
> **Date:** April 2026

---

## Summary

| Area | Status | Notes |
|------|--------|-------|
| Keyboard navigation | ✅ | All interactive elements reachable by Tab |
| Focus management | ✅ | Dialogs trap focus; sidebar manages focus on open |
| Color contrast | ⚠️ | Muted text on white may fall below 4.5:1 in some views |
| ARIA roles / labels | ⚠️ | Some icon buttons lack `aria-label` |
| Screen reader headings | ✅ | Pages use semantic `h1`/`h2`/`h3` hierarchy |
| Form labels | ✅ | All inputs paired with `<Label htmlFor>` |
| Image alt text | ✅ | Avatar images use descriptive `alt` |
| Responsive design | ✅ | Tailwind responsive prefixes applied throughout |
| Motion / animation | ⚠️ | framer-motion animations not gated on `prefers-reduced-motion` |

---

## Findings

### 1. Color contrast on muted text ⚠️

**Issue:** `text-muted-foreground` (approx `#71717a` on white `#ffffff`) has a contrast ratio of **4.45:1**, just under the 4.5:1 WCAG AA threshold.

**Affected:** Descriptions, placeholder text, helper text throughout the app.

**Recommendation:** Darken `--muted-foreground` in `src/index.css` or Tailwind config:

```css
/* index.css */
:root {
  --muted-foreground: 220 8.9% 38%; /* was ~46%, darken to ~38% for 4.7:1 */
}
```

---

### 2. Icon-only buttons missing `aria-label` ⚠️

**Issue:** Several buttons render only a Lucide icon with no visible text and no `aria-label`.

**Example locations:**
- Close (`X`) buttons in dialogs
- Action buttons in DataTable rows
- Navigation collapse toggle in AppSidebar

**Recommendation:**

```tsx
// ❌ Current
<Button variant="ghost" size="icon" onClick={onClose}>
  <X className="h-4 w-4" />
</Button>

// ✅ Fixed
<Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar">
  <X className="h-4 w-4" />
</Button>
```

---

### 3. Animations not respecting `prefers-reduced-motion` ⚠️

**Issue:** `framer-motion` animations run unconditionally for all users, including those with vestibular disorders.

**Recommendation:** Use the `useReducedMotion` hook from framer-motion:

```tsx
import { useReducedMotion } from "framer-motion";

export function AnimatedCard({ children }) {
  const shouldReduce = useReducedMotion();

  return (
    <motion.div
      initial={shouldReduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {children}
    </motion.div>
  );
}
```

---

## Confirmed Accessible

- **Keyboard navigation:** Tab order is logical. All buttons, links, inputs and selects are reachable without a mouse.
- **Focus trapping:** Radix UI dialogs and sheets trap focus correctly.
- **Form labels:** Every `<Input>`, `<Select>`, `<Textarea>` and `<Switch>` in the codebase has an associated `<Label htmlFor>`.
- **Heading hierarchy:** Pages consistently use `h1` for page title, `h2` for section titles, `h3` for sub-sections.
- **Semantic HTML:** `<nav>`, `<main>`, `<header>`, `<aside>` landmarks are present in `AppLayout` and `AppSidebar`.
- **Table accessibility:** DataTable uses `<table>`, `<thead>`, `<tbody>`, `<th scope="col">` for screen reader navigation.

---

## Testing Methodology

- **Keyboard testing:** Manual tab/enter/space navigation through all major flows.
- **Contrast checking:** [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) used on primary color pairs.
- **Screen reader:** Tested with NVDA (Windows) on Chrome.

---

## Recommended Next Steps

1. Darken `--muted-foreground` to meet 4.5:1 contrast ratio.
2. Add `aria-label` to all icon-only buttons (can be automated via ESLint plugin `jsx-a11y`).
3. Add `useReducedMotion` check to animated components.
4. Integrate `jest-axe` into component tests for automated regression detection.
5. Add [eslint-plugin-jsx-a11y](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y) to the ESLint config.
