import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Stethoscope, ClipboardList, FileText } from "lucide-react";

export function PatientEvolutionsTab({ pacienteId }: { pacienteId: string }) {
  const { data: evolutions = [], isLoading } = useQuery({
    queryKey: ["patient-evolutions-portal", pacienteId],
    queryFn: async () => {
      const { data, error } = await (supabase.from("evolutions") as any)
        .select("id, descricao, conduta, data_evolucao, profissional_id")
        .eq("paciente_id", pacienteId)
        .order("data_evolucao", { ascending: false })
        .limit(50);
      if (error) throw error;

      const profIds = [...new Set((data || []).map((e: any) => e.profissional_id))] as string[];
      let profMap: Record<string, string> = {};
      if (profIds.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("user_id, nome").in("user_id", profIds);
        (profs || []).forEach((p: any) => { profMap[p.user_id] = p.nome; });
      }
      return (data || []).map((e: any) => ({ ...e, profissional_nome: profMap[e.profissional_id] || "Profissional" }));
    },
    enabled: !!pacienteId,
  });

  const { data: evaluation } = useQuery({
    queryKey: ["patient-evaluation-portal", pacienteId],
    queryFn: async () => {
      const { data, error } = await (supabase.from("evaluations") as any)
        .select("*")
        .eq("paciente_id", pacienteId)
        .order("data_avaliacao", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error && (error as any).code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!pacienteId,
  });

  const { data: attachments = [] } = useQuery({
    queryKey: ["patient-attachments-portal", pacienteId],
    queryFn: async () => {
      const { data, error } = await (supabase.from("patient_attachments") as any)
        .select("id, file_name, file_type, descricao, created_at")
        .eq("paciente_id", pacienteId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!pacienteId,
  });

  if (isLoading) {
    return <div className="py-8 text-center text-muted-foreground animate-pulse">Carregando prontuário...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Evaluation Summary */}
      {evaluation && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-primary" />
              Avaliação Clínica
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground font-semibold uppercase">Queixa Principal</p>
              <p className="text-sm">{evaluation.queixa_principal}</p>
            </div>
            {evaluation.objetivos_tratamento && (
              <div>
                <p className="text-xs text-muted-foreground font-semibold uppercase">Objetivos</p>
                <p className="text-sm">{evaluation.objetivos_tratamento}</p>
              </div>
            )}
            <p className="text-xs text-muted-foreground text-right">
              Avaliado em {format(new Date(evaluation.data_avaliacao), "dd/MM/yyyy")}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Attachments */}
      {attachments.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Documentos ({attachments.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {attachments.map((att: any) => (
                <div key={att.id} className="flex items-center gap-2 p-2 rounded border text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium">{att.file_name}</p>
                    {att.descricao && <p className="text-xs text-muted-foreground">{att.descricao}</p>}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {format(new Date(att.created_at), "dd/MM/yy")}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Evolutions Timeline */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />
            Evoluções ({evolutions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {evolutions.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-6">Nenhuma evolução registrada ainda.</p>
          ) : (
            <div className="space-y-3">
              {evolutions.map((evol: any) => (
                <div key={evol.id} className="p-3 rounded-lg border space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-xs">
                      {format(new Date(evol.data_evolucao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{evol.profissional_nome}</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{evol.descricao}</p>
                  {evol.conduta && (
                    <div className="pt-2 border-t">
                      <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Conduta</p>
                      <p className="text-sm">{evol.conduta}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}