import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileCheck, ClipboardList } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  pacienteId: string;
}

export function PatientContractsTab({ pacienteId }: Props) {
  const { data: contratos = [], isLoading: loadingContratos } = useQuery({
    queryKey: ["patient-contratos", pacienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contratos_digitais")
        .select("id, titulo, conteudo, created_at, assinado_em")
        .eq("paciente_id", pacienteId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!pacienteId,
  });

  const { data: planos = [], isLoading: loadingPlanos } = useQuery({
    queryKey: ["patient-planos", pacienteId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("planos")
        .select("id, tipo_atendimento, total_sessoes, sessoes_utilizadas, status, valor, created_at")
        .eq("paciente_id", pacienteId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!pacienteId,
  });

  const { data: matriculas = [], isLoading: loadingMatriculas } = useQuery({
    queryKey: ["patient-matriculas-contratos", pacienteId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("matriculas")
        .select("id, status, data_inicio, data_fim, horario, dias_semana, created_at")
        .eq("paciente_id", pacienteId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!pacienteId,
  });

  const isLoading = loadingContratos || loadingPlanos || loadingMatriculas;

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground animate-pulse">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Digital Contracts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-primary" /> Contratos Digitais
          </CardTitle>
        </CardHeader>
        <CardContent>
          {contratos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum contrato registrado.</p>
          ) : (
            <div className="space-y-3">
              {contratos.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">{c.titulo}</p>
                    <p className="text-xs text-muted-foreground">
                      Criado em {format(new Date(c.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  <Badge variant={c.assinado_em ? "default" : "outline"}>
                    {c.assinado_em ? "Assinado" : "Pendente"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Session Plans */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-amber-600" /> Planos de Sessões
          </CardTitle>
        </CardHeader>
        <CardContent>
          {planos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum plano de sessão cadastrado.</p>
          ) : (
            <div className="space-y-3">
              {planos.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div>
                    <p className="text-sm font-medium capitalize">{p.tipo_atendimento}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.sessoes_utilizadas}/{p.total_sessoes} sessões • R$ {Number(p.valor || 0).toFixed(2)}
                    </p>
                  </div>
                  <Badge variant={p.status === "ativo" ? "default" : p.status === "finalizado" ? "secondary" : "outline"}>
                    {p.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Enrollments */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            ⭐ Matrículas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {matriculas.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma matrícula registrada.</p>
          ) : (
            <div className="space-y-3">
              {matriculas.map((m) => (
                <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">{m.horario || "Matrícula"} {m.dias_semana?.length ? `• ${m.dias_semana.length}x/sem` : ""}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.data_inicio ? format(new Date(m.data_inicio), "dd/MM/yyyy") : ""}
                      {m.data_fim ? ` a ${format(new Date(m.data_fim), "dd/MM/yyyy")}` : ""}
                    </p>
                  </div>
                  <Badge variant={m.status === "ativa" ? "default" : "outline"}>{m.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
