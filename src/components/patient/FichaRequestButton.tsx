import { FileDown, Loader2, Clock, CheckCircle, XCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  pacienteId: string;
}

export const FichaRequestButton = ({ pacienteId }: Props) => {
  const queryClient = useQueryClient();

  const { data: request, isLoading } = useQuery({
    queryKey: ["ficha-request", pacienteId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("ficha_requests")
        .select("*")
        .eq("paciente_id", pacienteId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const createRequest = useMutation({
    mutationFn: async () => {
      // First delete any old rejected request so patient can re-request
      await (supabase as any)
        .from("ficha_requests")
        .delete()
        .eq("paciente_id", pacienteId)
        .eq("status", "rejeitado");

      const { error } = await (supabase as any)
        .from("ficha_requests")
        .insert([{ paciente_id: pacienteId, status: "pendente" }]);
      if (error) throw error;

      // Notify admins
      const { data: adminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      const adminIds = (adminRoles || []).map((r: any) => r.user_id);
      if (adminIds.length > 0) {
        await supabase.from("notificacoes").insert(
          adminIds.map((adminId: string) => ({
            user_id: adminId,
            tipo: "ficha_request",
            titulo: "Solicitação de Ficha",
            resumo: "Um paciente solicitou acesso à sua ficha completa.",
            link: "/solicitacoes-alteracao",
          }))
        );
      }
    },
    onSuccess: () => {
      toast.success("Solicitação enviada! Aguarde a aprovação da clínica.");
      queryClient.invalidateQueries({ queryKey: ["ficha-request", pacienteId] });
    },
    onError: () => toast.error("Erro ao enviar solicitação."),
  });

  if (isLoading) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  if (!request) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => createRequest.mutate()}
        disabled={createRequest.isPending}
        className="gap-2"
      >
        {createRequest.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
        Solicitar Minha Ficha
      </Button>
    );
  }

  if (request.status === "pendente") {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="gap-1.5 py-1 px-3">
          <Clock className="h-3 w-3" />
          Aguardando aprovação
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => createRequest.mutate()}
          disabled={createRequest.isPending}
          className="text-xs text-muted-foreground h-7"
        >
          Reenviar
        </Button>
      </div>
    );
  }

  if (request.status === "rejeitado") {
    return (
      <div className="flex flex-col gap-2">
        <Badge variant="destructive" className="gap-1.5 py-1 px-3 w-fit">
          <XCircle className="h-3 w-3" />
          Solicitação rejeitada
        </Badge>
        {request.motivo_rejeicao && (
          <p className="text-xs text-muted-foreground">Motivo: {request.motivo_rejeicao}</p>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => createRequest.mutate()}
          disabled={createRequest.isPending}
          className="gap-2 w-fit"
        >
          <Send className="h-3 w-3" />
          Nova Solicitação
        </Button>
      </div>
    );
  }

  if (request.status === "aprovado") {
    const hasDownload = !!request.pdf_url;
    const isExpired = request.pdf_available_until && new Date(request.pdf_available_until) < new Date();

    return (
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="gap-1.5 py-1 px-3 border-primary text-primary">
          <CheckCircle className="h-3 w-3" />
          Ficha aprovada
        </Badge>
        {hasDownload && !isExpired ? (
          <Button
            variant="default"
            size="sm"
            className="gap-2"
            onClick={() => window.open(request.pdf_url, "_blank")}
          >
            <FileDown className="h-4 w-4" /> Baixar Prontuário
          </Button>
        ) : hasDownload && isExpired ? (
          <Badge variant="secondary" className="gap-1 text-xs">
            <Clock className="h-3 w-3" /> Link expirado
          </Badge>
        ) : (
          <Badge variant="secondary" className="gap-1 text-xs">
            <Clock className="h-3 w-3" /> PDF em preparação
          </Badge>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => createRequest.mutate()}
          disabled={createRequest.isPending}
          className="text-xs text-muted-foreground h-7"
        >
          Nova solicitação
        </Button>
      </div>
    );
  }

  return null;
};
