import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, MessageSquare, Phone, Mail, Gift, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ChurnRisk {
  paciente_id: string;
  nome: string;
  telefone: string;
  riskScore: number;
  reasons: string[];
  lastSession: string | null;
  pagamentosAtrasados: number;
}

interface Suggestion {
  tipo: "mensagem" | "promocao" | "ligacao" | "email";
  titulo: string;
  descricao: string;
  mensagem_sugerida: string;
  prioridade: "alta" | "media" | "baixa";
}

interface Props {
  patient: ChurnRisk;
}

const tipoIcons = {
  mensagem: MessageSquare,
  promocao: Gift,
  ligacao: Phone,
  email: Mail
};

const prioridadeColors = {
  alta: "bg-red-100 text-red-700 border-red-200",
  media: "bg-amber-100 text-amber-700 border-amber-200",
  baixa: "bg-green-100 text-green-700 border-green-200"
};

export const AIChurnSuggestions = ({ patient }: Props) => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const fetchSuggestions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-assistant", {
        body: {
          action: "churn_reengagement",
          context: {
            nome: patient.nome,
            reasons: patient.reasons,
            riskScore: patient.riskScore,
            lastSession: patient.lastSession,
            pagamentosAtrasados: patient.pagamentosAtrasados
          }
        }
      });
      if (error) throw error;
      if (data?.actions) {
        setSuggestions(data.actions);
        setExpanded(true);
      }
    } catch (e: any) {
      toast.error("Erro ao gerar sugestões: " + (e.message || "Tente novamente"));
    } finally {
      setLoading(false);
    }
  };

  const sendWhatsApp = (msg: string) => {
    const phone = patient.telefone.replace(/\D/g, "");
    const fullPhone = phone.startsWith("55") ? phone : `55${phone}`;
    window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  if (suggestions.length === 0) {
    return (
      <Button
        size="sm"
        variant="ghost"
        className="h-7 gap-1 text-xs"
        onClick={fetchSuggestions}
        disabled={loading}
      >
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
        IA
      </Button>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      <Button
        size="sm"
        variant="ghost"
        className="h-6 gap-1 text-xs w-full justify-between"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="flex items-center gap-1">
          <Sparkles className="h-3 w-3 text-primary" />
          {suggestions.length} sugestões da IA
        </span>
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </Button>
      
      {expanded && (
        <div className="space-y-2 pl-2 border-l-2 border-primary/20">
          {suggestions.map((s, i) => {
            const Icon = tipoIcons[s.tipo];
            return (
              <div key={i} className="bg-muted/50 rounded-lg p-2 space-y-1">
                <div className="flex items-center gap-2">
                  <Icon className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs font-medium flex-1">{s.titulo}</span>
                  <Badge variant="outline" className={`text-[9px] ${prioridadeColors[s.prioridade]}`}>
                    {s.prioridade}
                  </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground">{s.descricao}</p>
                {s.tipo === "mensagem" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-[10px] w-full mt-1"
                    onClick={() => sendWhatsApp(s.mensagem_sugerida)}
                  >
                    <MessageSquare className="h-3 w-3 mr-1" />
                    Enviar via WhatsApp
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
