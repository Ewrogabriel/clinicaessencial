import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileText, Download, Send, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { generateContractPDF } from "@/lib/generateContractPDF";

const Contratos = () => {
  const { user, isPatient, patientId } = useAuth();
  const [selectedPaciente, setSelectedPaciente] = useState("");
  const [selectedPlano, setSelectedPlano] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  const { data: pacientes = [] } = useQuery({
    queryKey: ["pacientes-contrato"],
    queryFn: async () => {
      if (isPatient && patientId) {
        const { data } = await supabase
          .from("pacientes")
          .select("id, nome, cpf, rg, telefone, email")
          .eq("id", patientId) as any;
        return data ?? [];
      }
      const { data } = await supabase
        .from("pacientes")
        .select("id, nome, cpf, rg, telefone, email")
        .eq("status", "ativo")
        .order("nome");
      return data ?? [];
    },
  });

  const { data: planos = [] } = useQuery({
    queryKey: ["precos-planos-contrato"],
    queryFn: async () => {
      const { data } = await supabase
        .from("precos_planos")
        .select("*")
        .eq("ativo", true)
        .order("nome") as any;
      return data ?? [];
    },
  });

  const { data: desconto } = useQuery({
    queryKey: ["desconto-paciente", selectedPaciente, selectedPlano],
    queryFn: async () => {
      if (!selectedPaciente) return null;
      const query = supabase
        .from("descontos_pacientes")
        .select("percentual_desconto, motivo")
        .eq("paciente_id", selectedPaciente)
        .eq("ativo", true) as any;
      
      if (selectedPlano) {
        query.eq("preco_plano_id", selectedPlano);
      }
      
      const { data } = await query.maybeSingle();
      return data;
    },
    enabled: !!selectedPaciente,
  });

  const paciente = (pacientes as any[]).find((p: any) => p.id === selectedPaciente);
  const plano = (planos as any[]).find((p: any) => p.id === selectedPlano);

  const getContractData = () => ({
    pacienteNome: paciente?.nome || "",
    cpf: paciente?.cpf || "",
    rg: paciente?.rg || "",
    planoNome: plano?.nome || "A definir",
    planoFrequencia: plano?.frequencia_semanal || 1,
    planoModalidade: plano?.modalidade || "grupo",
    planoValor: plano?.valor || 0,
    desconto: desconto?.percentual_desconto || 0,
    dataContrato: format(new Date(), "dd/MM/yyyy"),
  });

  const handleDownload = () => {
    if (!paciente) {
      toast({ title: "Selecione um paciente", variant: "destructive" });
      return;
    }
    const pdf = generateContractPDF(getContractData());
    pdf.save(`Contrato_${paciente.nome.replace(/\s/g, "_")}.pdf`);
    toast({ title: "Contrato gerado com sucesso!" });
  };

  const handleWhatsAppSend = () => {
    if (!paciente?.telefone) {
      toast({ title: "Paciente sem telefone cadastrado", variant: "destructive" });
      return;
    }
    // Generate and download first, then open WhatsApp
    handleDownload();
    const phone = paciente.telefone.replace(/\D/g, "");
    const fullPhone = phone.startsWith("55") ? phone : `55${phone}`;
    const msg = encodeURIComponent(
      `Olá ${paciente.nome}! Segue seu contrato da Essencial Fisio Pilates. Por favor, confira e assine. Qualquer dúvida estamos à disposição! 😊`
    );
    window.open(`https://wa.me/${fullPhone}?text=${msg}`, "_blank");
  };

  useEffect(() => {
    if (isPatient && patientId && !selectedPaciente && pacientes.length > 0) {
      setSelectedPaciente(patientId);
    }
  }, [isPatient, patientId, selectedPaciente, pacientes]);

  const valorFinal = plano
    ? plano.valor * (1 - (desconto?.percentual_desconto || 0) / 100)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Contratos</h1>
        <p className="text-muted-foreground">
          {isPatient ? "Visualize e baixe seu contrato" : "Gere contratos preenchidos automaticamente"}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Dados do Contrato
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isPatient && (
              <div>
                <Label>Paciente</Label>
                <Select value={selectedPaciente} onValueChange={setSelectedPaciente}>
                  <SelectTrigger><SelectValue placeholder="Selecione o paciente" /></SelectTrigger>
                  <SelectContent>
                    {(pacientes as any[]).map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Plano</Label>
              <Select value={selectedPlano} onValueChange={setSelectedPlano}>
                <SelectTrigger><SelectValue placeholder="Selecione o plano" /></SelectTrigger>
                <SelectContent>
                  {(planos as any[]).map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome} – R$ {Number(p.valor).toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {paciente && (
              <div className="rounded-lg border p-3 space-y-1 text-sm bg-muted/30">
                <p><strong>Nome:</strong> {paciente.nome}</p>
                <p><strong>CPF:</strong> {paciente.cpf || "Não informado"}</p>
                <p><strong>RG:</strong> {paciente.rg || "Não informado"}</p>
                {plano && (
                  <>
                    <p className="pt-2 border-t mt-2"><strong>Plano:</strong> {plano.nome}</p>
                    <p><strong>Frequência:</strong> {plano.frequencia_semanal}x/semana</p>
                    <p><strong>Modalidade:</strong> {plano.modalidade === "individual" ? "Individual" : "Grupo"}</p>
                    <p><strong>Valor:</strong> R$ {Number(plano.valor).toFixed(2)}</p>
                    {desconto && desconto.percentual_desconto > 0 && (
                      <>
                        <p className="text-green-600 font-medium">
                          <strong>Desconto:</strong> {desconto.percentual_desconto}% ({desconto.motivo || "—"})
                        </p>
                        <p className="text-primary font-bold">
                          <strong>Valor final:</strong> R$ {valorFinal.toFixed(2)}
                        </p>
                      </>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2">
              <Button onClick={handleDownload} disabled={!paciente} className="w-full">
                <Download className="h-4 w-4 mr-2" /> Baixar PDF
              </Button>
              {!isPatient && (
                <Button variant="outline" onClick={handleWhatsAppSend} disabled={!paciente} className="w-full">
                  <Send className="h-4 w-4 mr-2" /> Enviar via WhatsApp
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Pré-visualização do Contrato</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none text-foreground space-y-4 text-sm border rounded-lg p-6 bg-white dark:bg-muted/20 max-h-[70vh] overflow-y-auto">
              <h2 className="text-center font-bold text-lg">ESSENCIAL FISIO PILATES</h2>
              <p className="text-center text-xs text-muted-foreground">CNPJ: 61.080.977/0001-50</p>
              <h3 className="text-center font-bold">CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE PILATES</h3>

              <p>Pelo presente instrumento particular, de um lado:</p>
              <p><strong>CONTRATADA:</strong> Essencial Fisio Pilates, pessoa jurídica de direito privado, com sede à Rua Capitão Antônio Ferreira Campos, nº 46 – Bairro Carmo – Barbacena/MG, telefone/WhatsApp (32) 98415-2802, Instagram @essencialfisiopilatesbq.</p>
              <p>E, de outro lado:</p>
              <p>
                <strong>CONTRATANTE:</strong>{" "}
                <span className="bg-primary/10 px-1 rounded font-semibold">
                  {paciente?.nome || "___________________________"}
                </span>
                , CPF nº{" "}
                <span className="bg-primary/10 px-1 rounded">{paciente?.cpf || "_______________"}</span>
                , RG nº{" "}
                <span className="bg-primary/10 px-1 rounded">{paciente?.rg || "_______________"}</span>.
              </p>

              <h4 className="font-bold mt-4">CLÁUSULA 1ª – DO OBJETO</h4>
              <p>Prestação de serviços de Pilates, conforme plano contratado, com dias e horários previamente agendados.</p>

              <h4 className="font-bold">CLÁUSULA 2ª – DA NATUREZA DO SERVIÇO</h4>
              <p>O CONTRATANTE declara estar ciente de que o Pilates é um serviço mensal, não sendo contratado por aula, por dia ou por comparecimento.</p>
              <p><em>Parágrafo único: Faltas não geram desconto ou devolução de valores.</em></p>

              <h4 className="font-bold">CLÁUSULA 3ª – DO VALOR E PAGAMENTO</h4>
              <p>O valor da mensalidade será conforme o plano contratado.</p>
              <p>§1º A mensalidade deverá ser paga no primeiro dia de aula do mês.</p>
              <p>§2º O não pagamento autoriza a suspensão das aulas até a regularização.</p>

              <h4 className="font-bold">CLÁUSULA 4ª – CANCELAMENTOS E REPOSIÇÕES</h4>
              <p>§1º Somente haverá reposição de aulas desmarcadas com antecedência mínima de 3 horas.</p>
              <p>§2º Cancelamentos fora desse prazo não geram reposição.</p>
              <p>§3º As reposições devem ocorrer em até 30 dias, sob pena de perda da aula.</p>

              <h4 className="font-bold">CLÁUSULA 5ª – DOS FERIADOS E RECESSOS</h4>
              <p>Não haverá aulas em feriados ou durante recessos previamente comunicados pela clínica.</p>

              <h4 className="font-bold">CLÁUSULA 6ª – DAS CONDIÇÕES DE SAÚDE</h4>
              <p>O CONTRATANTE declara estar apto à prática do Pilates.</p>

              <h4 className="font-bold">CLÁUSULA 7ª – DO DIREITO DE IMAGEM</h4>
              <p>O CONTRATANTE autoriza o uso de sua imagem e voz para fins institucionais.</p>

              <h4 className="font-bold">CLÁUSULA 8ª – DA SUSPENSÃO TEMPORÁRIA</h4>
              <p>Suspensões somente serão aceitas mediante solicitação prévia e aprovação da CONTRATADA.</p>

              <h4 className="font-bold">CLÁUSULA 9ª – DA RESCISÃO</h4>
              <p>O contrato poderá ser rescindido por qualquer das partes.</p>

              <h4 className="font-bold">CLÁUSULA 10ª – DO FORO</h4>
              <p>Fica eleito o foro da comarca de Barbacena/MG.</p>

              {plano && (
                <div className="border-t pt-4 mt-6">
                  <h3 className="font-bold text-center">PLANO CONTRATADO</h3>
                  <div className="bg-primary/5 rounded-lg p-4 mt-2 space-y-1">
                    <p><strong>Plano:</strong> {plano.nome}</p>
                    <p><strong>Frequência:</strong> {plano.frequencia_semanal}x por semana</p>
                    <p><strong>Modalidade:</strong> {plano.modalidade === "individual" ? "Individual" : "Grupo"}</p>
                    <p><strong>Valor mensal:</strong> R$ {valorFinal.toFixed(2)}
                      {desconto && desconto.percentual_desconto > 0 && (
                        <span className="text-green-600 ml-2">(desconto de {desconto.percentual_desconto}%)</span>
                      )}
                    </p>
                  </div>
                </div>
              )}

              <div className="border-t pt-6 mt-6 space-y-2">
                <h4 className="font-bold text-center">CONTRATO-RESUMO</h4>
                <ul className="space-y-1">
                  <li>✔ O Pilates é mensal, não é por aula ou por dia</li>
                  <li>✔ A mensalidade é paga no primeiro dia de aula do mês</li>
                  <li>✔ Faltas não geram desconto</li>
                  <li>✔ Reposição somente se avisar com 3 horas de antecedência</li>
                  <li>✔ Reposição deve ocorrer em até 30 dias</li>
                  <li>✔ Feriados e recessos não têm reposição</li>
                  <li>✔ Aulas sem aviso prévio são perdidas</li>
                  <li>✔ Autorizo o uso de imagem para divulgação da clínica</li>
                </ul>
              </div>

              <div className="mt-8 pt-4 border-t">
                <p>Data: {format(new Date(), "dd/MM/yyyy")}</p>
                <div className="grid grid-cols-2 gap-8 mt-8">
                  <div className="text-center">
                    <div className="border-t border-foreground/40 pt-2">CONTRATADA</div>
                    <p className="text-xs text-muted-foreground">Essencial Fisio Pilates</p>
                  </div>
                  <div className="text-center">
                    <div className="border-t border-foreground/40 pt-2">CONTRATANTE</div>
                    <p className="text-xs text-muted-foreground">{paciente?.nome || "_______________"}</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Contratos;
