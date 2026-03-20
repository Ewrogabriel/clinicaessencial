import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, productName, productCategory, currentDescription } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    if (action === "suggest_description") {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `Você é um especialista em marketing de produtos para clínicas de saúde e bem-estar.
Gere descrições de produtos atrativas, profissionais e focadas em benefícios para o paciente.
Retorne APENAS JSON válido.`,
            },
            {
              role: "user",
              content: `Gere 3 sugestões de descrição para o produto "${productName}"${productCategory ? ` na categoria "${productCategory}"` : ""}.
${currentDescription ? `Descrição atual: "${currentDescription}". Melhore-a.` : ""}

Cada descrição deve ter entre 50-150 caracteres, focando em benefícios.

Retorne JSON: {"suggestions": ["descrição 1", "descrição 2", "descrição 3"]}`,
            },
          ],
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error("AI gateway error");
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { suggestions: [] };

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "generate_image") {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image",
          messages: [
            {
              role: "user",
              content: `Generate a professional product photo for a health clinic product called "${productName}". ${currentDescription ? `Description: ${currentDescription}.` : ""} Style: clean, professional, white/light background, high quality product photography, soft lighting, suitable for e-commerce.`,
            },
          ],
          modalities: ["image", "text"],
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Limite de requisições excedido." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error("AI image generation error");
      }

      const data = await response.json();
      const imageData = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

      if (!imageData) {
        throw new Error("No image generated");
      }

      // Upload to storage
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
      const binaryData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
      const fileName = `product-${Date.now()}.png`;

      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const { error: uploadError } = await supabaseAdmin.storage
        .from("clinic-uploads")
        .upload(`produtos/${fileName}`, binaryData, {
          contentType: "image/png",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabaseAdmin.storage
        .from("clinic-uploads")
        .getPublicUrl(`produtos/${fileName}`);

      return new Response(JSON.stringify({ imageUrl: urlData.publicUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Ação inválida");
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
