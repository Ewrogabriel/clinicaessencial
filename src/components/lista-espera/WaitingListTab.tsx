import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, CheckCircle, Trash2, Users, Phone } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const statusBadge: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  aguardando: { label: "Aguardando", variant: "outline" },
  notificado: { label: "Contactado", variant: "default" },
  atendido: { label: "Confirmado", variant: "secondary" },
  cancelado: { label: "Cancelado", variant: "destructive" },
};

interface WaitingListTabProps {
  entries: any[];
  isLoading: boolean;
  canManage: boolean;
  tipo: string;
  emptyMessage: string;
  emptySubMessage: string;
}

const WaitingListTab = ({ entries, isLoading, canManage, tipo, emptyMessage, emptySubMessage }: WaitingListTabProps) => {
  const queryClient = useQueryClient();

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updateData: any = { status };
      if (status === "notificado") updateData.notificado_em = new Date().toISOString();
      const { error } = await (supabase.from("lista_espera") as any).update(updateData).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lista-espera"] });
      toast.success("Status atualizado!");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("lista_espera") as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lista-espera"] });
      toast.success("Removido da lista.");
    },
  });

  const contactViaWhatsApp = (entry: any) => {
    const name = entry.pacientes?.nome?.split(" ")[0] || "Paciente";
    const phone = entry.pacientes?.telefone?.replace(/\D/g, "") || "";
    const fullPhone = phone.startsWith("55") ? phone : `55${phone}`;
    const dias = entry.dia_semana?.length > 0 ? entry.dia_semana.map((d: number) => DIAS_SEMANA[d]).join(", ") : "";
    const horario = entry.hora_preferida_inicio ? `${entry.hora_preferida_inicio}-${entry.hora_preferida_fim || ""}` : "";
    
    let msg = "";
    if (tipo === "espera" || !entry.tipo || entry.tipo === "espera") {
      msg = `Olá ${name}! 🎉 Um horário ficou disponível para ${entry.tipo_atendimento}. Você ainda tem interesse? Entre em contato conosco para agendar!`;
    } else if (entry.tipo === "interesse_mudanca") {
      msg = `Olá ${name}! 🎉 Surgiu uma vaga${dias ? ` no(s) dia(s) ${dias}` : ""}${horario ? ` às ${horario}` : ""} que é do seu interesse. Você gostaria de mudar seu horário? Confirme conosco!`;
    } else {
      msg = `Olá ${name}! 🎉 Temos uma vaga disponível${dias ? ` no(s) dia(s) ${dias}` : ""}${horario ? ` às ${horario}` : ""} para ${entry.tipo_atendimento}. Você ainda tem interesse em se matricular? Entre em contato!`;
    }
    
    window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`, "_blank");
    updateStatusMutation.mutate({ id: entry.id, status: "notificado" });
  };

  const filtered = entries.filter((e: any) =>
    tipo === "espera" ? (!e.tipo || e.tipo === "espera") : e.tipo === tipo
  );

  if (isLoading) return <p className="p-8 text-center text-muted-foreground">Carregando...</p>;

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center py-16 text-muted-foreground">
        <Users className="h-12 w-12 mb-4 opacity-30" />
        <p className="text-lg font-medium">{emptyMessage}</p>
        <p className="text-sm">{emptySubMessage}</p>
      </div>
    );
  }

  return (
    <div className="divide-y">
      {filtered.map((entry: any) => (
        <div key={entry.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{entry.pacientes?.nome || "Paciente"}</p>
            <p className="text-xs text-muted-foreground">
              {entry.tipo_atendimento}
              {entry.dia_semana?.length > 0 && ` • ${entry.dia_semana.map((d: number) => DIAS_SEMANA[d]).join(", ")}`}
              {entry.hora_preferida_inicio && ` • ${entry.hora_preferida_inicio}-${entry.hora_preferida_fim || ""}`}
            </p>
            {entry.matriculas && (
              <p className="text-xs text-primary mt-0.5">
                Matrícula: {entry.matriculas.tipo_atendimento} - {entry.matriculas.status}
              </p>
            )}
            {entry.observacoes && <p className="text-xs text-muted-foreground mt-0.5 italic">{entry.observacoes}</p>}
            <p className="text-xs text-muted-foreground mt-1">
              Desde {format(new Date(entry.created_at), "dd/MM/yyyy", { locale: ptBR })}
              {entry.notificado_em && ` • Contactado em ${format(new Date(entry.notificado_em), "dd/MM HH:mm")}`}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant={statusBadge[entry.status]?.variant || "outline"}>
              {statusBadge[entry.status]?.label || entry.status}
            </Badge>
            {canManage && entry.status === "aguardando" && (
              <>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10" title="Contactar via WhatsApp" onClick={() => contactViaWhatsApp(entry)}>
                  <Phone className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10" title="Confirmar mudança/matrícula" onClick={() => updateStatusMutation.mutate({ id: entry.id, status: "atendido" })}>
                  <CheckCircle className="h-4 w-4" />
                </Button>
              </>
            )}
            {canManage && entry.status === "notificado" && (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10" title="Confirmar mudança/matrícula" onClick={() => updateStatusMutation.mutate({ id: entry.id, status: "atendido" })}>
                <CheckCircle className="h-4 w-4" />
              </Button>
            )}
            {canManage && (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" title="Remover" onClick={() => deleteMutation.mutate(entry.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default WaitingListTab;
