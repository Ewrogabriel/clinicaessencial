import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clinicId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Get some context from the database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get clinic stats for context
    const [{ count: totalPacientes }, { count: totalAgendamentos }, { data: modalidades }] = await Promise.all([
      supabase.from("clinic_pacientes").select("*", { count: "exact", head: true }).eq("clinic_id", clinicId),
      supabase.from("agendamentos").select("*", { count: "exact", head: true }).eq("clinic_id", clinicId),
      supabase.from("modalidades").select("nome").eq("clinic_id", clinicId).eq("ativo", true).limit(10),
    ]);

    const modalidadesNomes = modalidades?.map((m: any) => m.nome).join(", ") || "Fisioterapia, Pilates";

    const currentMonth = new Date().toLocaleString("pt-BR", { month: "long" });

    const prompt = `Você é um consultor especializado em gestão de clínicas de saúde (fisioterapia, pilates, estética, etc).

Contexto da clínica:
- Total de pacientes ativos: ${totalPacientes || 0}
- Total de agendamentos: ${totalAgendamentos || 0}
- Modalidades oferecidas: ${modalidadesNomes}
- Mês atual: ${currentMonth}

Gere EXATAMENTE 5 sugestões de metas estratégicas para esta clínica. As metas devem ser:
1. Específicas e mensuráveis
2. Realistas para o porte da clínica
3. Focadas em crescimento, retenção de pacientes, faturamento ou eficiência operacional
4. Variadas (não repetir o mesmo tipo de meta)

Responda APENAS com um JSON válido no formato:
{"suggestions": ["Meta 1", "Meta 2", "Meta 3", "Meta 4", "Meta 5"]}

Não inclua explicações, apenas o JSON.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Você é um consultor de gestão de clínicas. Responda SEMPRE em JSON válido." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Falha ao gerar sugestões");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    // Parse the JSON response
    let suggestions: string[] = [];
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        suggestions = parsed.suggestions || [];
      }
    } catch {
      // Fallback suggestions if parsing fails
      suggestions = [
        "Aumentar a taxa de retenção de pacientes em 15%",
        "Captar 20 novos pacientes este mês",
        "Reduzir taxa de faltas para menos de 10%",
        "Aumentar faturamento mensal em 20%",
        "Melhorar NPS da clínica para acima de 80",
      ];
    }

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
