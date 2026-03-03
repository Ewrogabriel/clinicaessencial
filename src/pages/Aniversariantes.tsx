import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Cake, Mail, Send } from "lucide-react";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";

export default function Aniversariantes() {
  const [sendingId, setSendingId] = useState<string | null>(null);

  const { data: aniversariantes = [] } = useQuery({
    queryKey: ["aniversariantes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pacientes")
        .select("id, nome, data_nascimento, email, telefone")
        .not("data_nascimento", "is", null)
        .order("data_nascimento");

      if (error) throw error;

      const agora = new Date();
      const mesAtual = agora.getMonth();

      return (data || [])
        .map((p: any) => {
          if (!p.data_nascimento) return null;
          
          const dataNasc = parse(p.data_nascimento, "yyyy-MM-dd", new Date());
          return {
            ...p,
            mes: dataNasc.getMonth(),
            dia: dataNasc.getDate(),
            idade: agora.getFullYear() - dataNasc.getFullYear(),
            isHoje: dataNasc.getMonth() === mesAtual && dataNasc.getDate() === agora.getDate(),
            isEstesMes: dataNasc.getMonth() === mesAtual,
          };
        })
        .filter((p: any) => p && p.isEstesMes)
        .sort((a: any, b: any) => a.dia - b.dia);
    },
  });

  const aniversarianteHoje = aniversariantes.filter((a: any) => a.isHoje);

  const handleEnviarMensagem = async (paciente: any) => {
    setSendingId(paciente.id);
    try {
      // Aqui você poderia integrar com seu serviço de mensagens
      console.log("Enviando mensagem para:", paciente.nome);
      // await enviarMensagem(paciente.id, "Parabéns pelo seu aniversário!");
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Aniversariantes do Mês</h1>
        <p className="text-gray-600">Acompanhe os aniversários dos seus pacientes</p>
      </div>

      {/* Alerta de Aniversariante Hoje */}
      {aniversarianteHoje.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-900">
              <Cake className="w-5 h-5" />
              Aniversariante Hoje!
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {aniversarianteHoje.map((a: any) => (
                <div key={a.id} className="p-3 bg-white rounded-lg border border-yellow-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-lg">{a.nome}</p>
                      <p className="text-sm text-gray-600">
                        Completa {a.idade + 1} anos hoje! 🎉
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleEnviarMensagem(a)}
                      disabled={sendingId === a.id}
                    >
                      <Send className="w-4 h-4 mr-2" />
                      {sendingId === a.id ? "Enviando..." : "Enviar Parabéns"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de Aniversariantes do Mês */}
      <Card>
        <CardHeader>
          <CardTitle>Todos os Aniversariantes</CardTitle>
          <CardDescription>
            {aniversariantes.length} pacientes fazem aniversário este mês
          </CardDescription>
        </CardHeader>
        <CardContent>
          {aniversariantes.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              Nenhum aniversariante este mês
            </p>
          ) : (
            <div className="space-y-3">
              {aniversariantes.map((paciente: any) => (
                <div
                  key={paciente.id}
                  className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <Cake className="w-5 h-5 text-pink-500" />
                        <div>
                          <p className="font-semibold">{paciente.nome}</p>
                          <p className="text-sm text-gray-600">
                            {format(
                              parse(paciente.data_nascimento, "yyyy-MM-dd", new Date()),
                              "dd 'de' MMMM",
                              { locale: ptBR }
                            )}
                            {" "} • {paciente.idade} anos
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {paciente.isHoje && (
                        <Badge className="bg-yellow-100 text-yellow-800">Hoje</Badge>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEnviarMensagem(paciente)}
                        disabled={sendingId === paciente.id}
                      >
                        <Mail className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
