# Appointments Module

Scheduling, confirmation, completion and availability management.

---

## Features

| Feature | Route | Roles |
|---------|-------|-------|
| Appointment calendar | `/agenda` | admin, gestor, secretario, profissional |
| Patient's own schedule | `/minha-agenda` | paciente |
| Daily confirmations | `/confirmacoes-dia` | admin, gestor, master, secretario |
| Professional availability | `/disponibilidade` | authenticated |

---

## Appointment Statuses

`agendamentos.status`:

| Value | Meaning |
|-------|---------|
| `agendada` | Scheduled |
| `confirmada` | Confirmed by patient |
| `realizada` | Completed |
| `cancelada` | Cancelled |
| `faltou` | Patient no-show |

Valid status transitions:

```
agendada  →  confirmada | cancelada | faltou
confirmada →  realizada | cancelada | faltou
realizada  →  (terminal)
cancelada  →  (terminal)
faltou     →  (terminal)
```

---

## Session Types

`agendamentos.tipo_atendimento`:

| Value | Description | Color |
|-------|-------------|-------|
| `individual` | 1-on-1 session | blue |
| `dupla` | Pair session | violet |
| `trio` | 3-person session | orange |
| `grupo` | Group class | cyan |

---

## Calendar Views

The `Agenda` page supports three views:

- **Day view** – hourly slots for all professionals
- **Week view** – columns per professional
- **Month view** – compact event dots

Each professional is assigned a `cor_agenda` color used for border/background tints in all views.

---

## Availability

Professional availability is configured in `disponibilidade_profissional`:

| Column | Type | Notes |
|--------|------|-------|
| `profissional_id` | uuid | |
| `dia_semana` | integer | 0 = Sunday, 6 = Saturday |
| `hora_inicio` | time | |
| `hora_fim` | time | |
| UNIQUE | `(profissional_id, dia_semana, hora_inicio)` | Prevents identical entries but not overlapping windows |

---

## Confirmation Flow

1. Staff schedules appointment → `status = "agendada"`.
2. System sends SMS/email with confirmation link `/confirmar-agendamento/:id`.
3. Patient clicks link (no login required, uses anon Supabase key).
4. Page updates `status = "confirmada"` and `confirmado = true`.

**Security note:** The anon SELECT policy on `agendamentos` currently uses `USING(true)`. See [SECURITY_AUDIT.md](../SECURITY_AUDIT.md).

---

## Calendar Color Scheme

```typescript
// Session type colors
individual = "blue"
dupla      = "violet"
trio       = "orange"
grupo      = "cyan"

// Attendance type colors
pilates       = "indigo"
fisioterapia  = "emerald"
yoga          = "purple"
```

Professional colors come from `profiles.cor_agenda` and are applied as `border-left` and background tint.
