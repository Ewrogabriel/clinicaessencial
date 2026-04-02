import type {
  PreCadastroEmailParams,
  RejectionEmailParams,
  PaymentEmailParams,
  CommissionEmailParams,
  EnrollmentRenewalEmailParams,
} from "../services/emailService";

const baseStyle = `
  font-family: Arial, sans-serif;
  max-width: 600px;
  margin: 0 auto;
  color: #333;
`;

const headerStyle = `
  background: #2563eb;
  color: white;
  padding: 24px;
  border-radius: 8px 8px 0 0;
`;

const bodyStyle = `
  background: #fff;
  padding: 24px;
  border: 1px solid #e5e7eb;
`;

const footerStyle = `
  background: #f9fafb;
  padding: 16px 24px;
  border: 1px solid #e5e7eb;
  border-top: none;
  border-radius: 0 0 8px 8px;
  font-size: 12px;
  color: #6b7280;
`;

const btnStyle = `
  display: inline-block;
  background: #2563eb;
  color: white;
  padding: 12px 24px;
  border-radius: 6px;
  text-decoration: none;
  font-weight: bold;
  margin: 16px 0;
`;

function wrap(content: string): string {
  return `
    <div style="${baseStyle}">
      ${content}
      <div style="${footerStyle}">
        <p>Este é um e-mail automático. Por favor, não responda.</p>
        <p>Clínica Essencial · Todos os direitos reservados.</p>
      </div>
    </div>
  `;
}

/**
 * Pre-cadastro approved email.
 */
export function preCadastroApprovedTemplate(
  params: PreCadastroEmailParams
): string {
  return wrap(`
    <div style="${headerStyle}">
      <h1 style="margin:0;font-size:22px;">✅ Cadastro Aprovado!</h1>
    </div>
    <div style="${bodyStyle}">
      <p>Olá, <strong>${params.toName}</strong>!</p>
      <p>
        Temos o prazer de informar que o seu pré-cadastro foi <strong>aprovado</strong>.
        Bem-vindo(a) à nossa clínica!
      </p>
      <p>Para completar o seu onboarding e acessar todos os recursos, clique no botão abaixo:</p>
      ${
        params.onboardingLink
          ? `<a href="${params.onboardingLink}" style="${btnStyle}">Acessar meu cadastro</a>`
          : ""
      }
      <p>Caso tenha dúvidas, entre em contato com nossa equipe.</p>
    </div>
  `);
}

/**
 * Pre-cadastro rejected email with reason.
 */
export function preCadastroRejectedTemplate(
  params: RejectionEmailParams
): string {
  return wrap(`
    <div style="${headerStyle.replace("#2563eb", "#dc2626")}">
      <h1 style="margin:0;font-size:22px;">ℹ️ Atualização sobre seu cadastro</h1>
    </div>
    <div style="${bodyStyle}">
      <p>Olá, <strong>${params.toName}</strong>!</p>
      <p>
        Infelizmente, após análise, o seu pré-cadastro <strong>não pôde ser aprovado</strong>
        no momento.
      </p>
      <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:12px 16px;border-radius:4px;margin:16px 0;">
        <strong>Motivo:</strong>
        <p style="margin:4px 0 0 0;">${params.reason}</p>
      </div>
      <p>
        Se desejar esclarecimentos ou acredita que houve um equívoco,
        por favor entre em contato com nossa equipe.
      </p>
    </div>
  `);
}

/**
 * Payment confirmation email.
 */
export function paymentConfirmationTemplate(
  params: PaymentEmailParams
): string {
  const formatted = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(params.amount);

  return wrap(`
    <div style="${headerStyle.replace("#2563eb", "#16a34a")}">
      <h1 style="margin:0;font-size:22px;">💳 Pagamento Confirmado</h1>
    </div>
    <div style="${bodyStyle}">
      <p>Olá, <strong>${params.toName}</strong>!</p>
      <p>Seu pagamento foi confirmado com sucesso. Veja os detalhes:</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr style="background:#f3f4f6;">
          <td style="padding:8px 12px;font-weight:bold;">Valor</td>
          <td style="padding:8px 12px;">${formatted}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;font-weight:bold;">Data</td>
          <td style="padding:8px 12px;">${params.date}</td>
        </tr>
        <tr style="background:#f3f4f6;">
          <td style="padding:8px 12px;font-weight:bold;">Forma de Pagamento</td>
          <td style="padding:8px 12px;">${params.paymentMethod}</td>
        </tr>
        ${
          params.receiptNumber
            ? `<tr>
                <td style="padding:8px 12px;font-weight:bold;">Nº do Recibo</td>
                <td style="padding:8px 12px;">${params.receiptNumber}</td>
              </tr>`
            : ""
        }
      </table>
      <p>Obrigado por manter seus pagamentos em dia!</p>
    </div>
  `);
}

/**
 * Commission settlement notification.
 */
export function commissionSettlementTemplate(
  params: CommissionEmailParams
): string {
  const fmtValue = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  return wrap(`
    <div style="${headerStyle.replace("#2563eb", "#7c3aed")}">
      <h1 style="margin:0;font-size:22px;">💼 Comissões do Período</h1>
    </div>
    <div style="${bodyStyle}">
      <p>Olá, <strong>${params.toName}</strong>!</p>
      <p>Segue o resumo das suas comissões referente a <strong>${params.period}</strong>:</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr style="background:#f3f4f6;">
          <td style="padding:8px 12px;font-weight:bold;">Total de Sessões</td>
          <td style="padding:8px 12px;">${params.totalSessions}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;font-weight:bold;">Valor Total das Sessões</td>
          <td style="padding:8px 12px;">${fmtValue.format(params.totalValue)}</td>
        </tr>
        <tr style="background:#f3f4f6;">
          <td style="padding:8px 12px;font-weight:bold;">Taxa de Comissão</td>
          <td style="padding:8px 12px;">${params.commissionRate}%</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;font-weight:bold;color:#7c3aed;">Sua Comissão</td>
          <td style="padding:8px 12px;font-weight:bold;color:#7c3aed;">${fmtValue.format(params.commissionValue)}</td>
        </tr>
      </table>
    </div>
  `);
}

/**
 * Enrollment renewal reminder.
 */
export function enrollmentRenewalTemplate(
  params: EnrollmentRenewalEmailParams
): string {
  const formatted = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(params.amount);

  return wrap(`
    <div style="${headerStyle.replace("#2563eb", "#ea580c")}">
      <h1 style="margin:0;font-size:22px;">🔔 Renovação de Matrícula</h1>
    </div>
    <div style="${bodyStyle}">
      <p>Olá, <strong>${params.toName}</strong>!</p>
      <p>
        Sua matrícula no plano <strong>${params.planName}</strong> está
        próxima do vencimento.
      </p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr style="background:#f3f4f6;">
          <td style="padding:8px 12px;font-weight:bold;">Plano</td>
          <td style="padding:8px 12px;">${params.planName}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;font-weight:bold;">Data de Renovação</td>
          <td style="padding:8px 12px;">${params.renewalDate}</td>
        </tr>
        <tr style="background:#f3f4f6;">
          <td style="padding:8px 12px;font-weight:bold;">Valor</td>
          <td style="padding:8px 12px;">${formatted}</td>
        </tr>
      </table>
      <p>Entre em contato com nossa equipe para renovar ou alterar seu plano.</p>
    </div>
  `);
}
