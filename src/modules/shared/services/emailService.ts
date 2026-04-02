import { supabase } from "@/integrations/supabase/client";
import { handleError } from "@/modules/shared/utils/errorHandler";
import {
  preCadastroApprovedTemplate,
  preCadastroRejectedTemplate,
  paymentConfirmationTemplate,
  commissionSettlementTemplate,
  enrollmentRenewalTemplate,
} from "@/modules/shared/utils/emailTemplates";

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface PreCadastroEmailParams {
  toEmail: string;
  toName: string;
  onboardingLink?: string;
}

export interface RejectionEmailParams {
  toEmail: string;
  toName: string;
  reason: string;
}

export interface PaymentEmailParams {
  toEmail: string;
  toName: string;
  amount: number;
  date: string;
  paymentMethod: string;
  receiptNumber?: string;
}

export interface CommissionEmailParams {
  toEmail: string;
  toName: string;
  period: string;
  totalSessions: number;
  totalValue: number;
  commissionRate: number;
  commissionValue: number;
}

export interface EnrollmentRenewalEmailParams {
  toEmail: string;
  toName: string;
  planName: string;
  renewalDate: string;
  amount: number;
}

/**
 * Email delivery status tracking entry.
 */
export interface EmailDeliveryRecord {
  id?: string;
  recipient_email: string;
  template_type: string;
  entity_id: string;
  entity_type: string;
  status: "sent" | "failed" | "pending";
  sent_at?: string;
  error_message?: string;
  clinic_id?: string | null;
}

export const emailService = {
  /**
   * Send pre-cadastro approval email with onboarding link.
   */
  async sendPreCadastroApproved(
    params: PreCadastroEmailParams,
    preCadastroId: string,
    clinicId: string | null
  ): Promise<EmailResult> {
    return emailService._send(
      params.toEmail,
      "Bem-vindo(a)! Seu cadastro foi aprovado",
      preCadastroApprovedTemplate(params),
      { template_type: "pre_cadastro_approved", entity_id: preCadastroId, entity_type: "pre_cadastros", clinic_id: clinicId, recipient_email: params.toEmail }
    );
  },

  /**
   * Send pre-cadastro rejection email with reason.
   */
  async sendPreCadastroRejected(
    params: RejectionEmailParams,
    preCadastroId: string,
    clinicId: string | null
  ): Promise<EmailResult> {
    return emailService._send(
      params.toEmail,
      "Atualização sobre seu cadastro",
      preCadastroRejectedTemplate(params),
      { template_type: "pre_cadastro_rejected", entity_id: preCadastroId, entity_type: "pre_cadastros", clinic_id: clinicId, recipient_email: params.toEmail }
    );
  },

  /**
   * Send payment confirmation email.
   */
  async sendPaymentConfirmation(
    params: PaymentEmailParams,
    paymentId: string,
    clinicId: string | null
  ): Promise<EmailResult> {
    return emailService._send(
      params.toEmail,
      "Confirmação de pagamento",
      paymentConfirmationTemplate(params),
      { template_type: "payment_confirmation", entity_id: paymentId, entity_type: "pagamentos", clinic_id: clinicId, recipient_email: params.toEmail }
    );
  },

  /**
   * Send commission settlement notification.
   */
  async sendCommissionSettlement(
    params: CommissionEmailParams,
    commissionId: string,
    clinicId: string | null
  ): Promise<EmailResult> {
    return emailService._send(
      params.toEmail,
      `Liquidação de comissões - ${params.period}`,
      commissionSettlementTemplate(params),
      { template_type: "commission_settlement", entity_id: commissionId, entity_type: "commissions", clinic_id: clinicId, recipient_email: params.toEmail }
    );
  },

  /**
   * Send enrollment renewal reminder.
   */
  async sendEnrollmentRenewal(
    params: EnrollmentRenewalEmailParams,
    enrollmentId: string,
    clinicId: string | null
  ): Promise<EmailResult> {
    return emailService._send(
      params.toEmail,
      `Renovação de matrícula - ${params.planName}`,
      enrollmentRenewalTemplate(params),
      { template_type: "enrollment_renewal", entity_id: enrollmentId, entity_type: "matriculas", clinic_id: clinicId, recipient_email: params.toEmail }
    );
  },

  /**
   * Resend an email by delivery record ID.
   */
  async resend(deliveryId: string): Promise<EmailResult> {
    try {
      const { data, error } = await (supabase as any)
        .from("email_delivery_log")
        .select("*")
        .eq("id", deliveryId)
        .single();

      if (error || !data) throw new Error("Registro de entrega não encontrado.");

      // Re-invoke via edge function
      const result = await emailService._invokeEdgeFunction(
        data.recipient_email,
        data.subject ?? "Reenvio",
        data.html_content ?? "",
        data
      );

      // Update status
      await (supabase as any)
        .from("email_delivery_log")
        .update({
          status: result.success ? "sent" : "failed",
          sent_at: result.success ? new Date().toISOString() : null,
          error_message: result.error ?? null,
        })
        .eq("id", deliveryId);

      return result;
    } catch (error) {
      handleError(error, "Erro ao reenviar e-mail.");
      return { success: false, error: String(error) };
    }
  },

  /** Internal: send via Supabase Edge Function and log result. */
  async _send(
    toEmail: string,
    subject: string,
    html: string,
    record: Omit<EmailDeliveryRecord, "status" | "sent_at">
  ): Promise<EmailResult> {
    try {
      const result = await emailService._invokeEdgeFunction(
        toEmail,
        subject,
        html,
        {}
      );

      // Log delivery status
      await (supabase as any).from("email_delivery_log").insert({
        ...record,
        subject,
        html_content: html,
        status: result.success ? "sent" : "failed",
        sent_at: result.success ? new Date().toISOString() : null,
        error_message: result.error ?? null,
      } as any);

      return result;
    } catch (error) {
      handleError(error, "Erro ao enviar e-mail.");
      return { success: false, error: String(error) };
    }
  },

  /** Invoke the Supabase send-email edge function. */
  async _invokeEdgeFunction(
    toEmail: string,
    subject: string,
    html: string,
    _extra: Record<string, unknown>
  ): Promise<EmailResult> {
    try {
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: { to: toEmail, subject, html },
      });

      if (error) throw error;
      return { success: true, messageId: data?.messageId };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
};
