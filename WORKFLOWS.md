# Fisio Flow Care — Workflows

> Step-by-step reconstruction of the main user journeys in the system.
> Each workflow maps UI actions → service calls → database operations → UI updates.

---

## Workflow 1: Patient Registration

**Actor:** Admin / Gestor / Secretário  
**Entry point:** `/pacientes/novo`

```
Step 1 — Navigate
  User clicks "Novo Paciente" in the Pacientes sidebar item
  → React Router renders PacienteForm (in "create" mode, no :id param)

Step 2 — Form initialisation
  usePatientForm() hook creates 5 state groups:
  • personalData:  nome, cpf, dataNascimento, telefone, email, ...
  • addressData:   cep, logradouro, bairro, cidade, estado
  • clinicalData:  diagnostico, queixaPrincipal, observacoes
  • financialData: tipoPlano, valorSessao, sessoesTotais, ...
  • config:        activeTab = "dados"

Step 3 — Fill form (multiple tabs)
  Tab 1 "Dados Pessoais" → personalData fields (Zod validation on blur)
  Tab 2 "Endereço"       → addressData fields (CEP auto-complete via ViaCEP)
  Tab 3 "Dados Clínicos" → clinicalData fields
  Tab 4 "Financeiro"     → plan type, session value, total sessions

Step 4 — Validate & submit
  React Hook Form validates all fields against Zod schema
  If any errors → highlight fields, prevent submission

Step 5 — Create patient
  patientService.createPatient({
    nome, cpf, dataNascimento, ...financialData,
    clinic_id: activeClinicId
  })
  → INSERT INTO pacientes (...)

Step 6 — Create treatment plan (if tipoPlano set)
  patientService.createPlano({
    paciente_id: newPatient.id,
    tipo_plano, numero_sessoes, valor_sessao, data_inicio,
    clinic_id: activeClinicId
  })
  → INSERT INTO planos (...)

Step 7 — Success
  queryClient.invalidateQueries(queryKeys.patients.all)
  toast.success("Paciente cadastrado com sucesso!")
  navigate("/pacientes/" + newId)   → opens PacienteForm in edit mode

Step 8 — Audit log
  auditService.log('patient.create', { resource_id: newPatient.id })
  → INSERT INTO audit_logs (...)
```

---

## Workflow 2: Schedule an Individual Appointment

**Actor:** Admin / Gestor / Secretário  
**Entry point:** `/agenda`

```
Step 1 — Open agenda
  Agenda.tsx renders, calls useAppointments({ activeClinicId })
  → SELECT from agendamentos WHERE clinic_id = activeClinicId ORDER BY data_horario
  Calendar displays appointments in day/week/month view

Step 2 — Select date/time slot
  User clicks an empty slot in the calendar
  → Modal opens pre-filled with the clicked date/time

Step 3 — Fill appointment form
  • Patient selector   → search/select from pacientes
  • Professional       → select from profiles (role = profissional)
  • Date/time          → datetime picker (pre-filled from click)
  • Duration           → default from modalidade or manual
  • Type (modalidade)  → select from modalidades table
  • Session type       → tipo_sessao dropdown
  • Notes              → optional text

Step 4 — Check double booking
  On professional + datetime selection:
  appointmentService.checkDoubleBooking(profissionalId, dataHorario)
  → SELECT id FROM agendamentos
      WHERE profissional_id = ? AND data_horario = ?
      AND status != 'cancelado'
  If conflict → show inline error "Horário ocupado"

Step 5 — Submit
  appointmentService.bookAppointment({
    paciente_id, profissional_id, data_horario, duracao_minutos,
    tipo_atendimento, tipo_sessao, observacoes, created_by, clinic_id
  })
  → checkDoubleBooking() called again (race condition guard)
  → INSERT INTO agendamentos (...)

Step 6 — Notification (if automation configured)
  Automation engine checks rules for "agendamento_criado" trigger
  → Sends SMS/WhatsApp to patient (via configured provider)

Step 7 — Success
  queryClient.invalidateQueries(queryKeys.appointments.all)
  toast.success("Agendamento criado!")
  Modal closes, calendar re-renders with new appointment
```

---

## Workflow 3: Group Session Scheduling

**Actor:** Admin / Profissional  
**Entry point:** `/agenda` (group session tab)

```
Step 1 — Create group session slot
  Admin navigates to group sessions view
  Fills: profissional, modalidade, data_horario, capacidade_maxima
  appointmentService.createGrupoSessao({...})
  → INSERT INTO grupo_sessoes (...)

Step 2 — Enrol patients
  For each patient to enrol:
  appointmentService.addGrupoParticipante({
    grupo_sessao_id, paciente_id, status: 'agendado'
  })
  → INSERT INTO grupo_participantes (...)
  System checks: ocupados < capacidade_maxima; throws if full

Step 3 — Session execution
  On session day, professional checks in each patient:
  appointmentService.updateParticipanteStatus(id, 'realizado')
  → UPDATE grupo_participantes SET status = 'realizado' WHERE id = ?

Step 4 — Evolution (per patient)
  For each patient in group:
  clinicalService.createEvolution({
    paciente_id, profissional_id, grupo_sessao_id, ...soapFields
  })
  → INSERT INTO evolutions (...)

Step 5 — Payment generation
  For each patient who attended:
  financeService.createPayment({
    paciente_id, profissional_id, valor, forma_pagamento,
    clinic_id, agendamento_id: null (group sessions)
  })
  → INSERT INTO pagamentos (...)
```

---

## Workflow 4: Professional Availability Setup

**Actor:** Admin / Profissional  
**Entry point:** `/disponibilidade`

```
Step 1 — Open availability page
  DisponibilidadeProfissional.tsx renders
  Fetches: useProfessionals(clinicId) → list of professionals
  Fetches: disponibilidade_profissional for selected professional

Step 2 — Define recurring slots
  For each day of the week professional works:
  User selects: dia_semana, hora_inicio, hora_fim, capacidade
  professionalService.createDisponibilidade({
    profissional_id, clinic_id, dia_semana, hora_inicio, hora_fim, capacidade
  })
  → INSERT INTO disponibilidade_profissional (...)

Step 3 — Generate concrete slots (optional)
  System can generate availability_slots from weekly template:
  → For each week in date range, for each disponibilidade row:
    INSERT INTO availability_slots (profissional_id, clinic_id, data_horario, capacidade)

Step 4 — Add block periods
  For vacation or absence:
  professionalService.createBloqueio({
    profissional_id, clinic_id, data_inicio, data_fim, motivo
  })
  → INSERT INTO bloqueios_profissional (...)

Step 5 — Calendar reflects availability
  Agenda.tsx colours available slots using disponibilidade data
  Blocked periods show as unavailable
  At booking time: checkDoubleBooking verifies no conflict
```

---

## Workflow 5: Payment Registration

**Actor:** Admin / Gestor / Secretário  
**Entry point:** `/financeiro`

```
Step 1 — Open financeiro
  Financeiro.tsx renders, calls useFinance({ clinicId })
  → SELECT from pagamentos WHERE clinic_id = ? AND status = 'pendente'
  Displays pending payments list

Step 2 — Select appointment to pay
  User clicks on a pending payment row
  → Side panel or modal opens with payment details

Step 3 — Fill payment form
  • valor      → pre-filled from plano.valor_sessao
  • forma_pagamento → dropdown (dinheiro, cartao, pix, ...)
  • data_pagamento → today (editable)
  • observacoes → optional

Step 4 — Register payment
  financeService.createPayment(paymentData)
  → INSERT INTO pagamentos (paciente_id, valor, forma_pagamento, status: 'pago', ...)

Step 5 — Calculate commission
  financeService.calculateCommission(profissionalId, valor, clinicId)
  → SELECT from regras_comissao WHERE profissional_id = ?
  → Calculate: if tipo = 'percentual': valor_comissao = valor × (percentual/100)
               if tipo = 'fixo':       valor_comissao = regra.valor
  → INSERT INTO commissions (profissional_id, agendamento_id, valor_comissao, ...)

Step 6 — Update appointment status
  appointmentService.updateStatus(agendamentoId, 'realizado')
  → UPDATE agendamentos SET status = 'realizado' WHERE id = ?

Step 7 — Success
  queryClient.invalidateQueries(queryKeys.finance.all)
  queryClient.invalidateQueries(queryKeys.appointments.all)
  toast.success("Pagamento registrado!")
```

---

## Workflow 6: Clinical Evolution Recording

**Actor:** Profissional  
**Entry point:** `/prontuarios` or patient detail page

```
Step 1 — Open prontuários
  Prontuarios.tsx or PacienteDetalhes.tsx renders
  useClinical(patientId) fetches evolution history
  → SELECT from evolutions WHERE paciente_id = ? ORDER BY data_atendimento DESC

Step 2 — New evolution
  Professional clicks "Nova Evolução"
  → Modal or full-page form opens

Step 3 — Fill SOAP fields
  • data_atendimento  → today (editable)
  • tipo_atendimento  → session type
  • agendamento_id    → select from today's appointments (optional)
  • subjetivo         → patient's reported complaints
  • objetivo          → professional's objective findings
  • avaliacao         → clinical assessment
  • plano             → treatment plan for next session
  • observacoes       → additional notes

Step 4 — Submit
  clinicalService.createEvolution({
    paciente_id, profissional_id, agendamento_id,
    data_atendimento, tipo_atendimento,
    subjetivo, objetivo, avaliacao, plano, observacoes
  } as Database["public"]["Tables"]["evolutions"]["Insert"])
  → INSERT INTO evolutions (...)

Step 5 — Success
  queryClient.invalidateQueries(queryKeys.clinical.evolutions(patientId))
  toast.success("Evolução registrada!")
  Form resets, evolution list updates
```

---

## Workflow 7: Patient Check-In

**Actor:** Secretário / Profissional / Patient (self-check via QR)

```
Step 1 — Open check-in page
  CheckInProfissional.tsx (for professional's own check-in)
  OR appointment detail modal (for admin/receptionist)

Step 2 — Professional check-in
  Receptionist confirms professional is present:
  appointmentService.updateAppointment(id, { checkin_profissional: true })
  → UPDATE agendamentos SET checkin_profissional = true WHERE id = ?

Step 3 — Patient check-in
  Patient arrives, receptionist or patient self-checks:
  appointmentService.updateAppointment(id, { checkin_paciente: true })
  → UPDATE agendamentos SET checkin_paciente = true WHERE id = ?

Step 4 — Session starts
  Status update: appointmentService.updateStatus(id, 'confirmado')
  → UPDATE agendamentos SET status = 'confirmado' WHERE id = ?

Step 5 — Session ends
  After session: updateStatus(id, 'realizado')
  → Triggers commission calculation if payment already registered

Step 6 — Missed appointment
  If patient does not arrive: updateStatus(id, 'falta')
  → Can trigger automated notification to patient
  → Plan sessoes_realizadas is NOT incremented

Step 7 — Calendar reflects status
  Appointment colour changes based on status:
  agendado=blue, confirmado=green, realizado=dark, cancelado=red, falta=orange
```

---

## Workflow 8: Multi-Clinic Patient Cross-Booking

**Actor:** Admin (in clinic A, wanting to book patient from clinic B in same group)

```
Step 1 — System setup prerequisite
  clinicas A and B must share the same clinic_group_id
  → Both clinics linked via clinic_groups table

Step 2 — Switch active clinic
  Admin uses ClinicUnitSelector component
  switchClinic(clinicAId) → ClinicContext updated
  All queries now filter by clinicAId

Step 3 — Search for patient from group
  useCrossBooking hook uses group-scoped query:
  → SELECT from pacientes WHERE clinic_id IN (
      SELECT clinic_id FROM clinic_group_members
      WHERE clinic_group_id = (
        SELECT clinic_group_id FROM clinicas WHERE id = activeClinicId
      )
    )
  Patient registered in clinic B appears in results

Step 4 — Book appointment
  Same flow as Workflow 2, but:
  agendamentos row gets:
  • clinic_id = clinicA.id  (where appointment is happening)
  • clinic_group_id = group.id  (for cross-group RLS)

Step 5 — RLS enforces access
  user_in_clinic_group(clinic_group_id) function confirms
  the booking user belongs to a clinic in the same group
  → Policy allows the operation
```

---

## Workflow 9: Subscription Limit Check

**Actor:** System (automatic, triggered by any resource creation)

```
Step 1 — Resource creation attempted
  Admin tries to register a new professional

Step 2 — Plan limit check
  clinicService.checkPlanLimit(clinicId, 'profissionais')
  → DB function: check_plan_limit(clinicId, 'profissionais')
    SELECT COUNT(*) FROM clinic_users WHERE clinic_id = ?
    Compare against clinic_subscriptions → planos_clinica.limite_profissionais

Step 3 — Limit reached
  If count >= limit:
  → throw new AppError("Limite de profissionais atingido. Faça upgrade do plano.")
  → handleError() shows toast.error()
  → Creation blocked

Step 4 — Limit not reached
  Continue with normal creation workflow
```
