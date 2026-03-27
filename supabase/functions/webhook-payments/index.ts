import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from 'https://esm.sh/stripe@12.1.1?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2022-11-15',
  httpClient: Stripe.createFetchHttpClient(),
});

const cryptoProvider = Stripe.createSubtleCryptoProvider();

serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  const endpointSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

  try {
    const body = await req.text();
    let event;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    // Identificação de Webhook Stripe
    if (signature && endpointSecret) {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        endpointSecret,
        undefined,
        cryptoProvider
      );

      switch (event.type) {
        case 'payment_intent.succeeded': {
          const paymentIntent = event.data.object as any;
          // Os metadados devem ser passados na criação do PaymentIntent no frontend
          const { clinic_id, pagamento_id } = paymentIntent.metadata;

          if (pagamento_id) {
            await supabase
              .from('pagamentos')
              .update({ 
                status: 'pago', 
                data_pagamento: new Date().toISOString() 
              })
              .eq('id', pagamento_id);
              
            // Log do webhook
            if (clinic_id) {
              await supabase.from('integracao_sync_logs').insert({
                 clinic_id: clinic_id,
                 tipo: 'stripe_webhook',
                 acao: 'payment_intent.succeeded',
                 status: 'sucesso',
                 resposta_recebida: { payment_intent_id: paymentIntent.id }
              });
            }
          }
          break;
        }
        case 'checkout.session.completed': {
           const session = event.data.object as any;
           // Processamento adicional para checkout sessions se usado
           break;
        }
      }

      return new Response(JSON.stringify({ received: true }), { 
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Identificação de Webhook Banco Inter (Exemplo Base)
    // O Banco Inter costuma validar webhooks via mTLS ou assinaturas específicas
    const interSignature = req.headers.get('x-inter-signature');
    if (interSignature) {
      // Parse do payload
      const interPayload = JSON.parse(body);
      
      // Validação de segurança básica para o Inter
      // Atualizar pagamentos baseado no interPayload...
      
      return new Response(JSON.stringify({ received: true }), { 
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ error: "Provedor webhook não reconhecido ou assinatura ausente" }), { 
      status: 400,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    return new Response(
      JSON.stringify({ error: `Webhook Error: ${err.message}` }),
      { 
        status: 400,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
});
