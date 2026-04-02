# Email Automation

## Overview

Email automation is implemented via a Supabase Edge Function (`send-email`) invoked from the `emailService`.

## Service: `src/modules/shared/services/emailService.ts`

### Methods

| Method | Template | Trigger |
|--------|----------|---------|
| `sendPreCadastroApproved` | `preCadastroApprovedTemplate` | Admin approves pre-registration |
| `sendPreCadastroRejected` | `preCadastroRejectedTemplate` | Admin rejects pre-registration (reason required) |
| `sendPaymentConfirmation` | `paymentConfirmationTemplate` | Payment marked as `pago` |
| `sendCommissionSettlement` | `commissionSettlementTemplate` | Commission period closed |
| `sendEnrollmentRenewal` | `enrollmentRenewalTemplate` | Enrollment renewal reminder |
| `resend(deliveryId)` | — | Re-sends a previous failed email |

## Templates: `src/modules/shared/utils/emailTemplates.ts`

All templates return sanitized HTML strings with:
- Clinic branding (header color, footer)
- Responsive single-column layout
- No external image dependencies
- Inline CSS only (email client compatible)

## Delivery Tracking

All sent emails are logged to `email_delivery_log`:

| Column | Description |
|--------|-------------|
| `id` | UUID |
| `clinic_id` | FK to clinicas |
| `recipient_email` | Recipient address |
| `subject` | Email subject line |
| `template_type` | Template identifier |
| `entity_id` | Related record UUID |
| `entity_type` | Related table name |
| `status` | `pending` / `sent` / `failed` |
| `sent_at` | Timestamp of successful delivery |
| `error_message` | Error if failed |

## Edge Function

The `send-email` Supabase Edge Function must be deployed with the following environment variables:

```
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
FROM_EMAIL=noreply@clinicaessencial.com.br
FROM_NAME=Clínica Essencial
```

## Security

- All HTML content is built from trusted template functions — no user-controlled HTML injection
- `email_delivery_log` RLS restricts reads to the same clinic
- Inserts are allowed for all authenticated users (service-level writes)
