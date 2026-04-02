import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailPayload {
  template: "pre_cadastro_aprovado" | "confirmacao_link" | "lembrete_agendamento" | "comprovante_pagamento";
  to: string;
  patientName: string;
  onboardingLink?: string;
  appointmentDate?: string;
  paymentAmount?: number;
  clinicName?: string;
}

function buildEmailHtml(payload: EmailPayload): { subject: string; html: string } {
  const clinic = payload.clinicName || "Clínica";

  switch (payload.template) {
    case "pre_cadastro_aprovado":
      return {
        subject: `Bem-vindo(a) à ${clinic}! Seu cadastro foi aprovado`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
            <h2 style="color:#2563eb">Cadastro Aprovado! 🎉</h2>
            <p>Olá, <strong>${payload.patientName}</strong>!</p>
            <p>Seu pré-cadastro na <strong>${clinic}</strong> foi aprovado com sucesso.</p>
            ${payload.onboardingLink ? `
            <p>Clique no botão abaixo para completar o seu cadastro e acessar sua área do paciente:</p>
            <div style="text-align:center;margin:32px 0">
              <a href="${payload.onboardingLink}"
                 style="background:#2563eb;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">
                Completar Cadastro
              </a>
            </div>
            <p style="font-size:12px;color:#6b7280">
              Ou copie e cole este link no navegador:<br/>
              <a href="${payload.onboardingLink}">${payload.onboardingLink}</a>
            </p>
            ` : ""}
            <p>Em caso de dúvidas, entre em contato com a clínica.</p>
            <p>Atenciosamente,<br/><strong>${clinic}</strong></p>
          </div>
        `,
      };

    case "confirmacao_link":
      return {
        subject: `Confirme seu acesso — ${clinic}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
            <h2 style="color:#2563eb">Link de Confirmação</h2>
            <p>Olá, <strong>${payload.patientName}</strong>!</p>
            <p>Use o link abaixo para acessar sua conta na <strong>${clinic}</strong>:</p>
            ${payload.onboardingLink ? `
            <div style="text-align:center;margin:32px 0">
              <a href="${payload.onboardingLink}"
                 style="background:#2563eb;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">
                Acessar Minha Conta
              </a>
            </div>
            ` : ""}
            <p>Atenciosamente,<br/><strong>${clinic}</strong></p>
          </div>
        `,
      };

    case "lembrete_agendamento":
      return {
        subject: `Lembrete de Agendamento — ${clinic}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
            <h2 style="color:#2563eb">Lembrete de Sessão 📅</h2>
            <p>Olá, <strong>${payload.patientName}</strong>!</p>
            <p>Este é um lembrete do seu agendamento na <strong>${clinic}</strong>
              ${payload.appointmentDate ? ` para <strong>${payload.appointmentDate}</strong>` : ""}.</p>
            <p>Em caso de imprevistos, entre em contato com antecedência para reagendamento.</p>
            <p>Atenciosamente,<br/><strong>${clinic}</strong></p>
          </div>
        `,
      };

    case "comprovante_pagamento":
      return {
        subject: `Comprovante de Pagamento — ${clinic}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
            <h2 style="color:#16a34a">Pagamento Confirmado ✅</h2>
            <p>Olá, <strong>${payload.patientName}</strong>!</p>
            <p>Seu pagamento foi processado com sucesso.</p>
            ${payload.paymentAmount !== undefined ? `
            <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:16px;margin:16px 0;text-align:center">
              <p style="font-size:24px;font-weight:bold;color:#16a34a;margin:0">
                R$ ${payload.paymentAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>
            ` : ""}
            <p>Obrigado por confiar na <strong>${clinic}</strong>!</p>
            <p>Atenciosamente,<br/><strong>${clinic}</strong></p>
          </div>
        `,
      };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sendgridKey = Deno.env.get("SENDGRID_API_KEY");
    const fromEmail = Deno.env.get("EMAIL_FROM") || "noreply@clinicaessencial.com.br";

    const payload: EmailPayload = await req.json();

    if (!payload.to || !payload.patientName || !payload.template) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, patientName, template" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { subject, html } = buildEmailHtml(payload);

    // If SendGrid key is configured, send real email
    if (sendgridKey) {
      const sgResponse = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sendgridKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: payload.to, name: payload.patientName }] }],
          from: { email: fromEmail, name: payload.clinicName || "Clínica Essencial" },
          subject,
          content: [{ type: "text/html", value: html }],
        }),
      });

      if (!sgResponse.ok) {
        const errorText = await sgResponse.text();
        console.error("SendGrid error:", sgResponse.status, errorText);
        throw new Error(`SendGrid error: ${sgResponse.status}`);
      }
    } else {
      // Fallback: log email to notifications table in-app
      console.log(`[send-pre-cadastro-email] No SendGrid key. Would send to ${payload.to}: ${subject}`);
    }

    // Record the email sent as in-app notification if patient has a user account
    const { data: paciente } = await supabase
      .from("pacientes")
      .select("user_id")
      .eq("email", payload.to)
      .maybeSingle();

    if (paciente?.user_id) {
      await supabase.from("notificacoes").insert({
        user_id: paciente.user_id,
        tipo: "sistema",
        titulo: subject,
        resumo: `Email enviado: ${payload.template}`,
        lida: false,
      } as any);
    }

    return new Response(
      JSON.stringify({ success: true, subject }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("send-pre-cadastro-email error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
