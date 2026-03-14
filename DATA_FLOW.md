# Fisio Flow Care — Data Flow

> How data moves through the system: state management, API call patterns,
> React Query lifecycle, error handling, and concrete flow examples.

---

## 1. State Management Architecture

The application uses **three distinct state layers**, each with a different scope and lifetime:

```
┌──────────────────────────────────────────────────────────────────────┐
│  LAYER A — React Context  (synchronous, global, small state)          │
│                                                                        │
│  AuthContext            ClinicContext          I18nContext             │
│  ├─ user (Supabase)     ├─ activeClinicId       └─ t() function        │
│  ├─ session             ├─ clinics[]                                   │
│  ├─ profile             └─ switchClinic()                             │
│  ├─ roles[]                                                            │
│  ├─ permissions[]                                                      │
│  └─ helpers: isAdmin, hasPermission(), canEdit()                       │
├──────────────────────────────────────────────────────────────────────┤
│  LAYER B — React Query Cache  (async, cached, server-sync)            │
│                                                                        │
│  Holds all remote data. Keys in queryKeys.ts.                          │
│  staleTime: varies per query (default: 0)                              │
│  refetchOnWindowFocus: true by default                                 │
│  Automatic background refetch on cache invalidation                    │
│                                                                        │
│  queryKeys.patients.list(clinicId)     → patient list                  │
│  queryKeys.appointments.today(clinicId) → today's appointments         │
│  queryKeys.finance.dashboard(start, clinicId) → finance summary        │
│  ... (40+ registered keys)                                             │
├──────────────────────────────────────────────────────────────────────┤
│  LAYER C — Component State  (local, ephemeral, immediate)             │
│                                                                        │
│  React Hook Form state  → form fields, validation, submission          │
│  Modal open/close       → useState(false)                              │
│  Active tab / filter    → useState / usePersistedFilter()              │
│  Complex form state     → custom hooks (e.g. usePatientForm)           │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 2. React Query Lifecycle

### Read (useQuery)

```
Component mounts
      │
      ▼
useQuery({
  queryKey: queryKeys.patients.list(clinicId),
  queryFn: () => patientService.getPatients({ activeClinicId: clinicId }),
  enabled: !!clinicId,
})
      │
      ├─── cache HIT  ──────────► return cached data immediately
      │                            + re-fetch in background if stale
      │
      └─── cache MISS ──────────► status = "loading"
                                    │
                                    ▼
                              patientService.getPatients()
                                    │
                                    ▼
                          supabase.from("pacientes")
                            .select(PATIENT_COLUMNS)
                            .eq("clinic_id", clinicId)
                            .order("nome")
                                    │
                              Supabase Auth header injected
                              RLS policies evaluated server-side
                                    │
                                    ▼
                               data returned
                                    │
                                    ▼
                          React Query stores in cache
                          status = "success" | "error"
                                    │
                                    ▼
                          Component re-renders with data
```

### Write (useMutation)

```
User submits form
      │
      ▼
mutate(formData)
      │
      ▼
mutationFn: patientService.createPatient(formData)
      │
      ▼
supabase.from("pacientes").insert(formData).select().single()
      │
      ├─── error ──────────► handleError(error, "Mensagem")
      │                        └─► sonner toast.error(message)
      │                        └─► throw AppError
      │
      └─── success ────────► onSuccess callback
                               │
                               ▼
                     queryClient.invalidateQueries({
                       queryKey: queryKeys.patients.all
                     })
                               │
                               ▼
                     All patient queries re-fetch silently
                               │
                               ▼
                     UI updates automatically
                     Optional: toast.success("Paciente criado!")
```

---

## 3. Error Handling Flow

```
Service method catches error
       │
       ▼
handleError(error, "Mensagem customizada")
       │
       ├─── error instanceof AppError  ──► use error.message
       ├─── error instanceof Error     ──► use error.message
       └─── unknown error              ──► use customMessage fallback
                                            + extract code via isErrorWithCode()
       │
       ▼
sonner toast.error(message, { description: "Código: " + code })
       │
       ▼
return new AppError(message, code, originalError)
```

**Supabase error codes surfaced to users:**
- `23505` — unique constraint violation (duplicate record)
- `PGRST301` — row not found
- `42501` — RLS policy violation (permission denied)
- Connection errors trigger the custom message

---

## 4. Authentication Data Flow

### Initial Load

```
App.tsx renders AuthProvider
      │
      ▼
supabase.auth.getSession()   ← retrieves JWT from localStorage
      │
      ├─── no session ──────► setLoading(false), user remains null
      │
      └─── session found ───► setUser(session.user)
                               setSession(session)
                                    │
                                    ▼
                         loadUserData(userId) [5s timeout]
                                    │
                               Promise.all([
                                 getProfile(userId),
                                 getPatientId(userId),
                                 getRoles(userId),
                                 getPermissions(userId),
                               ])
                                    │
                                    ▼
                         AuthContext updated
                         setLoading(false)
```

### Token Refresh

```
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN')  → loadUserData(session.user.id)
  if (event === 'SIGNED_OUT') → clear all context state
  if (event === 'TOKEN_REFRESHED') → update session state
})
```
Supabase automatically refreshes the JWT before expiry.

---

## 5. Concrete Data Flows

### Flow A: Create a Patient

```
1. Admin navigates to /pacientes/novo
2. PacienteForm.tsx renders, usePatientForm() hook initialises 5 state objects:
   - personalData: { nome, cpf, dataNascimento, telefone, email, ... }
   - addressData:  { cep, logradouro, bairro, cidade, estado }
   - clinicalData: { diagnostico, queixaPrincipal, ... }
   - financialData: { tipoPlano, valorSessao, ... }
   - config:       { status, activeTab }

3. User fills form fields → React Hook Form tracks field values
4. On submit: Zod schema validates all fields
5. If valid: patientService.createPatient(formData, clinicId) called
   └─► supabase.from("pacientes").insert({ ...formData, clinic_id: clinicId })
6. On success:
   a. queryClient.invalidateQueries(queryKeys.patients.all)
   b. toast.success("Paciente cadastrado!")
   c. navigate("/pacientes/" + newId)
7. Patient list silently re-fetches in background
```

### Flow B: Schedule an Appointment

```
1. Admin opens Agenda page (/agenda)
2. useAppointments(clinicId) fetches today's appointments
3. Admin clicks "Novo Agendamento" → modal opens
4. Form fields: patient selector, professional selector, date/time, type, duration
5. On submit:
   a. appointmentService.checkDoubleBooking(profissionalId, dataHorario)
      └─► supabase.from("agendamentos")
            .select("id")
            .eq("profissional_id", profissionalId)
            .eq("data_horario", dataHorario)
            .neq("status", "cancelado")
      └─► if conflict found → throw Error("Profissional já possui agendamento neste horário")
   
   b. If no conflict: appointmentService.bookAppointment(params)
      └─► supabase.from("agendamentos").insert({ ...params, clinic_id: clinicId })
   
6. On success:
   a. queryClient.invalidateQueries(queryKeys.appointments.all)
   b. toast.success("Agendamento criado!")
   c. Modal closes, calendar re-renders
```

### Flow C: Register a Payment

```
1. Admin opens Financeiro page (/financeiro)
2. useFinance(clinicId) fetches pending payments
3. Admin clicks on appointment → "Registrar Pagamento" action
4. Payment modal: valor, forma_pagamento, data_pagamento
5. On submit: financeService.createPayment({
     paciente_id, profissional_id, agendamento_id,
     valor, forma_pagamento, data_pagamento, clinic_id
   })
   └─► supabase.from("pagamentos").insert(paymentData)
6. Commission calculation triggered:
   └─► financeService.calculateCommission(profissionalId, valor)
       └─► Read regras_comissao for professional
       └─► Calculate: rate × valor OR fixed amount
       └─► supabase.from("commissions").insert(commissionData)
7. On success:
   a. queryClient.invalidateQueries(queryKeys.finance.all)
   b. queryClient.invalidateQueries(queryKeys.patients.detail(patientId))
   c. toast.success("Pagamento registrado!")
```

### Flow D: Record a Clinical Evolution

```
1. Professional opens Prontuários (/prontuarios) or patient detail
2. useClinical(patientId) fetches existing evolutions
3. Professional clicks "Nova Evolução"
4. Evolution form: data (SOAP fields), tipo_atendimento, agendamento_id
5. On submit: clinicalService.createEvolution({
     paciente_id, profissional_id, agendamento_id,
     data_atendimento, ...soapFields
   } as Database["public"]["Tables"]["evolutions"]["Insert"])
   └─► supabase.from("evolutions").insert(evolutionData)
6. On success:
   a. queryClient.invalidateQueries(queryKeys.clinical.evolutions(patientId))
   b. toast.success("Evolução registrada!")
```

### Flow E: Check In to Appointment

```
1. Professional or receptionist opens appointment details
2. Clicks "Check-In Profissional" button
3. appointmentService.checkIn(appointmentId, 'profissional')
   └─► supabase.from("agendamentos")
         .update({ checkin_profissional: true })
         .eq("id", appointmentId)
4. Clicks "Check-In Paciente" (or patient self-checks via QR)
3. appointmentService.checkIn(appointmentId, 'paciente')
   └─► supabase.from("agendamentos")
         .update({ checkin_paciente: true })
         .eq("id", appointmentId)
5. When appointment ends: updateStatus(id, 'realizado')
   └─► Triggers commission calculation if not already done
```

---

## 6. Real-Time Data (Supabase Realtime)

The `teleconsultas` table and `mensagens` table use Supabase Realtime channels:

```
supabase.channel("teleconsulta:" + appointmentId)
  .on("postgres_changes", {
    event: "*",
    schema: "public",
    table: "teleconsultas",
    filter: `agendamento_id=eq.${appointmentId}`
  }, (payload) => {
    // Update local state with new teleconsultation status
  })
  .subscribe()
```

The internal messaging system subscribes to new messages per clinic:
```
supabase.channel("mensagens:" + clinicId)
  .on("postgres_changes", { event: "INSERT", table: "mensagens" }, ...)
  .subscribe()
```

---

## 7. Optimistic Updates

Some mutations use optimistic updates for perceived performance:
```typescript
useMutation({
  mutationFn: appointmentService.updateStatus,
  onMutate: async ({ id, status }) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: queryKeys.appointments.all });
    // Snapshot previous value
    const previous = queryClient.getQueryData(queryKeys.appointments.today(clinicId));
    // Optimistically update
    queryClient.setQueryData(queryKeys.appointments.today(clinicId), (old) =>
      old?.map(a => a.id === id ? { ...a, status } : a) ?? []
    );
    return { previous };
  },
  onError: (err, vars, context) => {
    // Roll back on error
    queryClient.setQueryData(queryKeys.appointments.today(clinicId), context?.previous);
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.appointments.all });
  },
})
```

---

## 8. Data Loading Performance

| Strategy | Where Used |
|---|---|
| **Lazy-loaded routes** | All 55+ pages except Index, Login, NotFound |
| **Suspense + fallback** | `<Suspense fallback={<LazyLoadFallback />}>` wraps all lazy routes |
| **Query enabled flag** | `enabled: !!clinicId` prevents queries before context is ready |
| **Stale-while-revalidate** | React Query serves cached data immediately; refetches in background |
| **Parallel loading** | `Promise.all()` in `loadUserData` — profile, roles, permissions load simultaneously |
| **Named column selects** | Services select only needed columns (not `*`), reducing payload size |
| **Performance indexes** | Migration `20260313220000_performance_clinic_indexes.sql` adds composite indexes on `clinic_id` columns |
