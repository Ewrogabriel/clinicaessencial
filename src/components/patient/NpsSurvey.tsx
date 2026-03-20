import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/modules/shared/hooks/use-toast";
import { Star, CheckCircle } from "lucide-react";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { cn } from "@/lib/utils";

interface NpsSurveyProps {
  pacienteId: string;
}

export const NpsSurvey = ({ pacienteId }: NpsSurveyProps) => {
  const { activeClinicId } = useClinic();
  const queryClient = useQueryClient();
  const [nota, setNota] = useState<number | null>(null);
  const [comentario, setComentario] = useState("");

  const { data: lastSurvey } = useQuery({
    queryKey: ["nps-last", pacienteId],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data } = await (supabase
        .from("pesquisa_satisfacao") as any)
        .select("*")
        .eq("paciente_id", pacienteId)
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!pacienteId,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (nota === null) throw new Error("Selecione uma nota");
      const { error } = await (supabase.from("pesquisa_satisfacao") as any).insert({
        paciente_id: pacienteId,
        nota,
        comentario: comentario || null,
        clinic_id: activeClinicId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nps-last", pacienteId] });
      toast({ title: "Obrigado pelo seu feedback! 💙" });
      setNota(null);
      setComentario("");
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  // Already answered recently
  if (lastSurvey) {
    return (
      <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-900">
        <CardContent className="flex items-center gap-3 py-4">
          <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
          <p className="text-sm text-green-800 dark:text-green-300">
            Obrigado! Você avaliou com nota <strong>{lastSurvey.nota}</strong> recentemente.
          </p>
        </CardContent>
      </Card>
    );
  }

  const getColor = (n: number) => {
    if (n <= 6) return "bg-destructive text-destructive-foreground";
    if (n <= 8) return "bg-amber-500 text-white";
    return "bg-green-600 text-white";
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Star className="h-4 w-4 text-primary" />
          Como está sua experiência?
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          De 0 a 10, qual a probabilidade de recomendar nossa clínica?
        </p>
        <div className="flex gap-1.5 flex-wrap">
          {Array.from({ length: 11 }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setNota(i)}
              className={cn(
                "h-9 w-9 rounded-lg text-sm font-medium border transition-all",
                nota === i ? getColor(i) : "bg-muted hover:bg-muted/80 text-foreground"
              )}
            >
              {i}
            </button>
          ))}
        </div>
        {nota !== null && (
          <>
            <Textarea
              placeholder="Conte-nos mais sobre sua experiência (opcional)..."
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              rows={2}
            />
            <Button
              size="sm"
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? "Enviando..." : "Enviar Avaliação"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};
