import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MessageSquare, Mail, Bell, UserPlus, FileCheck, Send, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const Automacoes = () => {
  const { clinicId } = useAuth();

  const { data: patients = [] } = useQuery({
    queryKey: ["automation-patients", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pacientes")
        .select("*")
        .eq("clinic_id", clinicId)
        .eq("status", "ativo");
      if (error) throw error;
      return data;
    },
    enabled: !!clinicId,
  });

  const sendWhatsApp = (phone: string, message: string) => {
    const cleanPhone = phone.replace(/\D/g, "");
    const url = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  };

  const triggers = [
    {
      title: "Lembrete de Consulta",
      description: "Mensagem para confirmar presença 24h antes.",
      icon: MessageSquare,
      color: "bg-green-100 text-green-700",
      message: "Olá! Confirmamos sua sessão amanhã no Essencial FisioPilates. Podemos contar com sua presença?",
    },
    {
      title: "Recuperação de Paciente",
      description: "Para pacientes sumidos há mais de 30 dias.",
      icon: UserPlus,
      color: "bg-blue-100 text-blue-700",
      message: "Olá! Sentimos sua falta aqui no Essencial FisioPilates. Como você está? Vamos agendar sua próxima sessão?",
    },
    {
      title: "Aviso de Pendência",
      description: "Cobrança amigável de pagamentos atrasados.",
      icon: Bell,
      color: "bg-amber-100 text-amber-700",
      message: "Olá! Consta uma pendência em aberto no seu cadastro. Poderia nos enviar o comprovante ou regularizar?",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Send className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-[Plus_Jakarta_Sans]">Centro de Automações</h1>
          <p className="text-muted-foreground">Dispare comunicações inteligentes para seus pacientes.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {triggers.map((trigger) => (
          <Card key={trigger.title} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${trigger.color}`}>
                <trigger.icon className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg">{trigger.title}</CardTitle>
              <CardDescription>{trigger.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-3 bg-muted rounded-md text-xs mb-4 italic">
                "{trigger.message}"
              </div>
              <Button className="w-full" variant="outline">
                Configurar Regra
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Disparos Manuais Rápidos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {patients.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum paciente ativo para disparar.</p>
            ) : (
              <div className="grid gap-3">
                {patients.slice(0, 5).map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div>
                      <p className="text-sm font-medium">{p.nome}</p>
                      <p className="text-xs text-muted-foreground">{p.telefone}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="text-green-600 hover:text-green-700 hover:bg-green-50"
                        onClick={() => sendWhatsApp(p.telefone, `Oi ${p.nome.split(' ')[0]}, tudo bem? Passando para lembrar da sua sessão!`)}
                      >
                        <MessageSquare className="h-4 w-4 mr-1" /> WhatsApp
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      >
                        <Mail className="h-4 w-4 mr-1" /> E-mail
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {patients.length > 5 && (
              <Button variant="link" className="w-full text-xs" onClick={() => toast.info("Lista completa em desenvolvimento")}>
                Ver todos os pacientes ativos
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-primary" />
              Templates de Documentos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="ghost" className="w-full justify-start text-sm">
              📄 Recibo de Pagamento - PDF
            </Button>
            <Button variant="ghost" className="w-full justify-start text-sm">
              📄 Termo de Alta Clínica
            </Button>
            <Button variant="ghost" className="w-full justify-start text-sm">
              📄 Recomendações de Exercícios Home
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Automacoes;
