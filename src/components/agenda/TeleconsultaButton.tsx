import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Video, Copy, ExternalLink } from "lucide-react";
import { toast } from "@/modules/shared/hooks/use-toast";

interface TeleconsultaButtonProps {
  agendamentoId: string;
  pacienteNome: string;
  profissionalNome: string;
  dataHorario: string;
  compact?: boolean;
}

export function TeleconsultaButton({
  agendamentoId,
  pacienteNome,
  profissionalNome,
  dataHorario,
  compact = false,
}: TeleconsultaButtonProps) {
  const navigate = useNavigate();

  const openRoom = () => {
    navigate(`/teleconsulta?agendamento=${agendamentoId}`);
  };

  const copyLink = () => {
    const url = `${window.location.origin}/teleconsulta?agendamento=${agendamentoId}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copiado!", description: "Envie para o paciente via WhatsApp ou mensagem." });
  };

  const sendWhatsApp = () => {
    const firstName = pacienteNome.split(" ")[0];
    const url = `${window.location.origin}/teleconsulta?agendamento=${agendamentoId}`;
    const msg = `Olá, ${firstName}! Segue o link da sua teleconsulta com ${profissionalNome}:\n\n📹 ${url}\n\nBasta clicar no link no horário agendado. Até lá!`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  if (compact) {
    return (
      <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={openRoom}>
        <Video className="h-3.5 w-3.5" />
        Teleconsulta
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" className="gap-2" onClick={openRoom}>
        <Video className="h-4 w-4 text-primary" />
        Entrar na Sala
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={copyLink} title="Copiar link">
        <Copy className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={sendWhatsApp} title="Enviar via WhatsApp">
        <ExternalLink className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export function TeleconsultaBadge({ agendamentoId }: { agendamentoId: string }) {
  const navigate = useNavigate();

  return (
    <Badge
      variant="outline"
      className="cursor-pointer gap-1 text-xs hover:bg-primary hover:text-primary-foreground transition-colors"
      onClick={() => navigate(`/teleconsulta?agendamento=${agendamentoId}`)}
    >
      <Video className="h-3 w-3" />
      Teleconsulta
    </Badge>
  );
}
