# Telehealth Integration

## Overview

The telehealth module enables real-time video consultations between patients and professionals directly within the platform. Sessions are created, managed, and summarised without leaving the application.

Primary routes:
- `/teleconsulta` — Launch or join a session
- `/teleconsulta-hub` — Hub page listing scheduled sessions (`TeleconsultaHub`)

---

## Session Flow

```
create session → waiting room → video call → end session → post-session summary
```

| Step | Description |
|------|-------------|
| **Create** | Professional or secretary calls `telehealthService.createSession()`. A `teleconsulta_sessions` row is created with status `agendada`. |
| **Waiting Room** | Patient lands on `WaitingRoom`, which polls session status via `useTeleconsultation`. |
| **Video Call** | On status change to `em_andamento`, `VideoCallFrame` renders the embedded video provider iframe using the JWT token. |
| **End Session** | Professional calls `telehealthService.endSession()`, setting status to `encerrada`. Recording stops if active. |
| **Summary** | `PostSessionSummary` displays AI-generated notes produced by the `summarize-teleconsulta` edge function. |

---

## Components

| Component | Path | Description |
|-----------|------|-------------|
| `WaitingRoom` | `components/telehealth/WaitingRoom` | Waiting room UI with real-time status updates |
| `VideoCallFrame` | `components/telehealth/VideoCallFrame` | Embedded video call iframe/SDK wrapper |
| `SessionRecorder` | `components/telehealth/SessionRecorder` | Controls for starting/stopping session recording |
| `PostSessionSummary` | `components/telehealth/PostSessionSummary` | Displays AI-generated session summary |

---

## Services

### `telehealthService`

Located at `modules/telehealth/services/telehealthService`.

| Method | Description |
|--------|-------------|
| `createSession(payload)` | Creates a new `teleconsulta_sessions` record |
| `updateSessionStatus(id, status)` | Updates session status (`agendada` → `em_andamento` → `encerrada`) |
| `generateSessionToken(sessionId)` | Calls an edge function to issue a signed JWT for the video provider |
| `endSession(id)` | Marks session as `encerrada` and stops any active recording |
| `sendSessionLink(sessionId, patientId)` | Sends the patient a unique join link via email/SMS |

---

## Hook: `useTeleconsultation`

Located at `modules/telehealth/hooks/useTeleconsultation`.

Subscribes to a real-time Supabase channel scoped to the session row:

```tsx
const {
  session,        // current session record
  status,         // session status string
  token,          // video provider JWT
  isLoading,
  endSession,     // callable to end the session
} = useTeleconsultation(sessionId);
```

Internally uses `supabase.channel("teleconsulta_sessions:{id}").on("postgres_changes", ...)` to push live status updates to both participants without polling.

---

## Database: `teleconsulta_sessions`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `clinica_id` | uuid | FK → clinics table |
| `profissional_id` | uuid | FK → `auth.users` |
| `paciente_id` | uuid | FK → `auth.users` |
| `agendamento_id` | uuid | Optional FK → appointments |
| `status` | text | `agendada`, `em_andamento`, `encerrada`, `cancelada` |
| `iniciada_em` | timestamptz | When the call started |
| `encerrada_em` | timestamptz | When the call ended |
| `duracao_minutos` | integer | Computed duration |
| `token_sessao` | text | Signed JWT for video provider |
| `link_gravacao` | text | URL to recording (if applicable) |
| `resumo_ia` | text | AI-generated summary text |
| `notas_profissional` | text | Manual notes added by professional |
| `criado_em` | timestamptz | Record creation timestamp |

---

## JWT Token Authentication

Session access is controlled by short-lived JWTs:

1. `telehealthService.generateSessionToken(sessionId)` invokes the `generate-teleconsulta-token` edge function.
2. The function verifies the caller's role, signs a payload `{ sessionId, userId, role, exp }` with a secret, and returns the token.
3. `VideoCallFrame` attaches the token as a query parameter or `Authorization` header when loading the video provider URL.
4. Tokens expire after the session ends or after a configurable TTL (default: 2 hours).

---

## Edge Function: `summarize-teleconsulta`

Located at `supabase/functions/summarize-teleconsulta/`.

- **Trigger:** Called by `telehealthService.endSession()` after status update.
- **Input:** `{ sessionId }` in the request body.
- **Process:** Fetches `notas_profissional` and optional transcript, sends to an LLM API, and writes the result to `teleconsulta_sessions.resumo_ia`.
- **Authentication:** Requires a valid service-role JWT (called server-side only).

---

## Security

- **RLS:** Patients can only read their own session rows. Professionals can read/update sessions where they are the `profissional_id`. Clinic admins can read all sessions for their clinic.
- **Token isolation:** The video JWT is scoped to a single session and user — it cannot be used to access other sessions.
- **Recording consent:** `SessionRecorder` displays a consent banner before recording starts; consent is stored in the session record.
