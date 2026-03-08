import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileText, Download, Send, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useClinic } from "@/hooks/useClinic";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { generateContractPDF } from "@/lib/generateContractPDF";
import { generateProfessionalContractPDF } from "@/lib/generateProfessionalContractPDF";
import { useClinicSettings } from "@/hooks/useClinicSettings";

const Contratos = () => {
  const { user, isPatient, patientId, isAdmin, isGestor } = useAuth();
  const { activeClinicId } = useClinic();
  const { data: clinicSettings } = useClinicSettings();
  const canManage = isAdmin || isGestor;
  const [selectedPaciente, setSelectedPaciente] = useState("");
  const [selectedPlano, setSelectedPlano] = useState("");
  const [selectedMatricula, setSelectedMatricula] = useState("");
  const [selectedProfissional, setSelectedProfissional] = useState("");

  const clinicNome = clinicSettings?.nome || "Essencial Fisio Pilates";
  const clinicCNPJ = clinicSettings?.cnpj || "";
  const clinicEnderecoFull = [clinicSettings?.endereco, clinicSettings?.numero ? `nº ${clinicSettings.numero}` : "", clinicSettings?.bairro, clinicSettings?.cidade ? `${clinicSettings.cidade}/${clinicSettings.estado}` : ""].filter(Boolean).join(", ");
  const clinicTelefone = clinicSettings?.telefone || "";
  const clinicInstagram = clinicSettings?.instagram || "";

  const { data: pacientes = [] } = useQuery({
    queryKey: ["pacientes-contrato", activeClinicId],
    queryFn: async () => {
      if (isPatient && patientId) {
        const { data } = await supabase.from("pacientes").select("id, nome, cpf, rg, telefone, email").eq("id", patientId);
        return data ?? [];
      }
      if (activeClinicId) {
        const { data: cp } = await supabase.from("clinic_pacientes")
          .select("paciente_id").eq("clinic_id", activeClinicId);
        const ids = (cp || []).map(c => c.paciente_id);
        if (!ids.length) return [];
        const { data } = await supabase.from("pacientes")
          .select("id, nome, cpf, rg, telefone, email").in("id", ids).eq("status", "ativo").order("nome");
        return data ?? [];
      }
      const { data } = await supabase.from("pacientes").select("id, nome, cpf, rg, telefone, email").eq("status", "ativo").order("nome");
      return data ?? [];
    },
  });

  const { data: planos = [] } = useQuery({
    queryKey: ["precos-planos-contrato"],
    queryFn: async () => {
      const { data } = await supabase.from("precos_planos").select("*").eq("ativo", true).order("nome");
      return data ?? [];
    },
  });

  const { data: profissionais = [] } = useQuery({
    queryKey: ["profissionais-contrato"],
    queryFn: async () => {
      if (!canManage) return [];
      const { data: roleData } = await supabase.from("user_roles").select("user_id").in("role", ["profissional", "admin"]);
      const userIds = roleData?.map(r => r.user_id) ?? [];
      if (userIds.length === 0) return [];
      const { data } = await supabase.from("profiles").select("*").in("user_id", userIds).order("nome");
      return (data as any[]) ?? [];
    },
    enabled: canManage,
  });

  const { data: matriculas = [] } = useQuery({
    queryKey: ["matriculas-contrato", selectedPaciente],
    queryFn: async () => {
      if (!selectedPaciente) return [];
      const { data } = await supabase.from("matriculas")
        .select("id, tipo_atendimento, valor_mensal, data_inicio, status")
        .eq("paciente_id", selectedPaciente)
        .eq("status", "ativa")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!selectedPaciente,
  });

  const { data: modalidades = [] } = useQuery({
    queryKey: ["modalidades-contrato"],
    queryFn: async () => {
      const { data } = await supabase.from("modalidades").select("id, nome").eq("ativo", true).order("nome");
      return data ?? [];
    },
  });

  const { data: desconto } = useQuery({
    queryKey: ["desconto-paciente", selectedPaciente, selectedPlano],
    queryFn: async () => {
      if (!selectedPaciente) return null;
      let query = supabase.from("descontos_pacientes").select("percentual_desconto, motivo").eq("paciente_id", selectedPaciente).eq("ativo", true);
      if (selectedPlano) query = query.eq("preco_plano_id", selectedPlano);
      const { data } = await query.maybeSingle();
      return data;
    },
    enabled: !!selectedPaciente,
  });

  const paciente = (pacientes as any[]).find((p: any) => p.id === selectedPaciente);
  const plano = (planos as any[]).find((p: any) => p.id === selectedPlano);
  const profissional = (profissionais as any[]).find((p: any) => p.id === selectedProfissional);
  const matricula = (matriculas as any[]).find((m: any) => m.id === selectedMatricula);

  const getContractData = () => ({
    pacienteNome: paciente?.nome || "",
    cpf: paciente?.cpf || "",
    rg: paciente?.rg || "",
    planoNome: plano?.nome || "A definir",
    planoFrequencia: plano?.frequencia_semanal || 1,
    planoModalidade: plano?.modalidade || "grupo",
    planoValor: matricula?.valor_mensal || plano?.valor || 0,
    desconto: desconto?.percentual_desconto || 0,
    dataContrato: format(new Date(), "dd/MM/yyyy"),
  });

  const valorFinal = (matricula?.valor_mensal || (plano ? plano.valor : 0)) * (1 - (desconto?.percentual_desconto || 0) / 100);

  const handleDownload = async () => {
    if (!paciente) { toast({ title: "Selecione um paciente", variant: "destructive" }); return; }
    const pdf = await generateContractPDF(getContractData());
    pdf.save(`Contrato_${paciente.nome.replace(/\s/g, "_")}.pdf`);
    toast({ title: "Contrato gerado com sucesso!" });
  };

  const handleWhatsAppSend = async () => {
    if (!paciente?.telefone) { toast({ title: "Paciente sem telefone cadastrado", variant: "destructive" }); return; }
    await handleDownload();
    const phone = paciente.telefone.replace(/\D/g, "");
    const fullPhone = phone.startsWith("55") ? phone : `55${phone}`;
    const msg = encodeURIComponent(`Olá ${paciente.nome}! Segue seu contrato da Essencial Fisio Pilates. Por favor, confira e assine. Qualquer dúvida estamos à disposição! 😊`);
    window.open(`https://wa.me/${fullPhone}?text=${msg}`, "_blank");
  };

  const handleProfissionalDownload = async () => {
    if (!profissional) { toast({ title: "Selecione um profissional", variant: "destructive" }); return; }
    const endParts = [profissional.endereco, profissional.numero ? `nº ${profissional.numero}` : "", profissional.bairro, profissional.cidade, profissional.estado].filter(Boolean).join(", ");
    const doc = await generateProfessionalContractPDF({
      profissionalNome: profissional.nome,
      registroProfissional: profissional.registro_profissional || "",
      tipoContratacao: profissional.tipo_contratacao || "autonomo",
      cnpj: profissional.cnpj || "",
      commissionRate: profissional.commission_rate || 0,
      cpf: profissional.cpf || "",
      rg: profissional.rg || "",
      endereco: endParts,
      estadoCivil: profissional.estado_civil || "",
      telefone: profissional.telefone || "",
    });
    doc.save(`contrato-profissional-${profissional.nome.replace(/\s+/g, "-").toLowerCase()}.pdf`);
    toast({ title: "Contrato profissional gerado!" });
  };

  useEffect(() => {
    if (isPatient && patientId && !selectedPaciente && pacientes.length > 0) setSelectedPaciente(patientId);
  }, [isPatient, patientId, selectedPaciente, pacientes]);

  const tipoLabel = (t: string) => t === "clt" ? "CLT" : t === "mei" ? "MEI" : t === "pj" ? "Pessoa Jurídica" : "Autônomo";
  const estadoCivilLabel = (e: string) => ({ solteiro: "Solteiro(a)", casado: "Casado(a)", divorciado: "Divorciado(a)", viuvo: "Viúvo(a)", uniao_estavel: "União Estável" }[e] || e);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Contratos</h1>
        <p className="text-muted-foreground">
          {isPatient ? "Visualize e baixe seu contrato" : "Gere contratos preenchidos automaticamente"}
        </p>
      </div>

      <Tabs defaultValue="paciente" className="w-full">
        <TabsList>
          <TabsTrigger value="paciente" className="flex items-center gap-2">
            <FileText className="h-4 w-4" /> Paciente
          </TabsTrigger>
          {canManage && (
            <TabsTrigger value="profissional" className="flex items-center gap-2">
              <Users className="h-4 w-4" /> Profissional
            </TabsTrigger>
          )}
        </TabsList>

        {/* ===== PACIENTE TAB ===== */}
        <TabsContent value="paciente">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1">
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Dados do Contrato</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {!isPatient && (
                  <div>
                    <Label>Paciente</Label>
                    <Select value={selectedPaciente} onValueChange={setSelectedPaciente}>
                      <SelectTrigger><SelectValue placeholder="Selecione o paciente" /></SelectTrigger>
                      <SelectContent>{(pacientes as any[]).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label>Plano</Label>
                  <Select value={selectedPlano} onValueChange={setSelectedPlano}>
                    <SelectTrigger><SelectValue placeholder="Selecione o plano" /></SelectTrigger>
                    <SelectContent>{(planos as any[]).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nome} – R$ {Number(p.valor).toFixed(2)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {selectedPaciente && (matriculas as any[]).length > 0 && (
                  <div>
                    <Label>Matrícula (opcional)</Label>
                    <Select value={selectedMatricula} onValueChange={setSelectedMatricula}>
                      <SelectTrigger><SelectValue placeholder="Vincular a matrícula" /></SelectTrigger>
                      <SelectContent>
                        {(matriculas as any[]).map((m: any) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.tipo_atendimento} – R$ {Number(m.valor_mensal).toFixed(2)} (início {format(new Date(m.data_inicio), "dd/MM/yyyy")})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {paciente && (
                  <div className="rounded-lg border p-3 space-y-1 text-sm bg-muted/30">
                    <p><strong>Nome:</strong> {paciente.nome}</p>
                    <p><strong>CPF:</strong> {paciente.cpf || "Não informado"}</p>
                    <p><strong>RG:</strong> {paciente.rg || "Não informado"}</p>
                    {matricula && (
                      <>
                        <p className="pt-2 border-t mt-2"><strong>Matrícula:</strong> {matricula.tipo_atendimento} – R$ {Number(matricula.valor_mensal).toFixed(2)}/mês</p>
                      </>
                    )}
                    {plano && (
                      <>
                        <p className={matricula ? "" : "pt-2 border-t mt-2"}><strong>Plano:</strong> {plano.nome}</p>
                        <p><strong>Frequência:</strong> {plano.frequencia_semanal}x/semana</p>
                        <p><strong>Modalidade:</strong> {plano.modalidade === "individual" ? "Individual" : "Grupo"}</p>
                        <p><strong>Valor:</strong> R$ {Number(matricula?.valor_mensal || plano.valor).toFixed(2)}</p>
                        {desconto && desconto.percentual_desconto > 0 && (
                          <>
                            <p className="text-green-600 font-medium"><strong>Desconto:</strong> {desconto.percentual_desconto}% ({desconto.motivo || "—"})</p>
                            <p className="text-primary font-bold"><strong>Valor final:</strong> R$ {valorFinal.toFixed(2)}</p>
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}
                <div className="flex flex-col gap-2 pt-2">
                  <Button onClick={handleDownload} disabled={!paciente} className="w-full"><Download className="h-4 w-4 mr-2" /> Baixar PDF</Button>
                  {!isPatient && <Button variant="outline" onClick={handleWhatsAppSend} disabled={!paciente} className="w-full"><Send className="h-4 w-4 mr-2" /> Enviar via WhatsApp</Button>}
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="text-base">Pré-visualização do Contrato</CardTitle></CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none text-foreground space-y-4 text-sm border rounded-lg p-6 bg-white dark:bg-muted/20 max-h-[70vh] overflow-y-auto">
                  <h2 className="text-center font-bold text-lg">{clinicNome.toUpperCase()}</h2>
                  {clinicCNPJ && <p className="text-center text-xs text-muted-foreground">CNPJ: {clinicCNPJ}</p>}
                  <h3 className="text-center font-bold">CONTRATO DE PRESTAÇÃO DE SERVIÇOS{matricula ? ` DE ${matricula.tipo_atendimento.toUpperCase()}` : plano ? ` DE ${(plano.modalidade || "PILATES").toUpperCase()}` : " DE PILATES"}</h3>
                  <p>Pelo presente instrumento particular, de um lado:</p>
                  <p><strong>CONTRATADA:</strong> {clinicNome}, pessoa jurídica de direito privado{clinicEnderecoFull ? `, com sede à ${clinicEnderecoFull}` : ""}{clinicTelefone ? `, telefone/WhatsApp ${clinicTelefone}` : ""}{clinicInstagram ? `, Instagram ${clinicInstagram}` : ""}.</p>
                  <p>E, de outro lado:</p>
                  <p><strong>CONTRATANTE:</strong> <span className="bg-primary/10 px-1 rounded font-semibold">{paciente?.nome || "___________________________"}</span>, CPF nº <span className="bg-primary/10 px-1 rounded">{paciente?.cpf || "_______________"}</span>, RG nº <span className="bg-primary/10 px-1 rounded">{paciente?.rg || "_______________"}</span>.</p>
                  <h4 className="font-bold mt-4">CLÁUSULA 1ª – DO OBJETO</h4>
                  <p>Prestação de serviços de {matricula?.tipo_atendimento || plano?.modalidade || "Pilates"}, conforme plano contratado, com dias e horários previamente agendados.</p>
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
                  {(plano || matricula) && (
                    <div className="border-t pt-4 mt-6">
                      <h3 className="font-bold text-center">PLANO CONTRATADO</h3>
                      <div className="bg-primary/5 rounded-lg p-4 mt-2 space-y-1">
                        {matricula && <p><strong>Modalidade:</strong> {matricula.tipo_atendimento}</p>}
                        {plano && <p><strong>Plano:</strong> {plano.nome}</p>}
                        {plano && <p><strong>Frequência:</strong> {plano.frequencia_semanal}x por semana</p>}
                        {plano && <p><strong>Tipo:</strong> {plano.modalidade === "individual" ? "Individual" : "Grupo"}</p>}
                        <p><strong>Valor mensal:</strong> R$ {valorFinal.toFixed(2)}{desconto && desconto.percentual_desconto > 0 && <span className="text-green-600 ml-2">(desconto de {desconto.percentual_desconto}%)</span>}</p>
                        {matricula && <p><strong>Início da matrícula:</strong> {format(new Date(matricula.data_inicio), "dd/MM/yyyy")}</p>}
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
                      <div className="text-center"><div className="border-t border-foreground/40 pt-2">CONTRATADA</div><p className="text-xs text-muted-foreground">{clinicNome}</p></div>
                      <div className="text-center"><div className="border-t border-foreground/40 pt-2">CONTRATANTE</div><p className="text-xs text-muted-foreground">{paciente?.nome || "_______________"}</p></div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ===== PROFISSIONAL TAB ===== */}
        {canManage && (
          <TabsContent value="profissional">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-1">
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Contrato Profissional</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Profissional</Label>
                    <Select value={selectedProfissional} onValueChange={setSelectedProfissional}>
                      <SelectTrigger><SelectValue placeholder="Selecione o profissional" /></SelectTrigger>
                      <SelectContent>{(profissionais as any[]).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  {profissional && (
                    <div className="rounded-lg border p-3 space-y-1 text-sm bg-muted/30">
                      <p><strong>Nome:</strong> {profissional.nome}</p>
                      <p><strong>CPF:</strong> {profissional.cpf || "Não informado"}</p>
                      <p><strong>RG:</strong> {profissional.rg || "Não informado"}</p>
                      <p><strong>Estado Civil:</strong> {profissional.estado_civil ? estadoCivilLabel(profissional.estado_civil) : "Não informado"}</p>
                      <p><strong>Telefone:</strong> {profissional.telefone || "Não informado"}</p>
                      <p><strong>Endereço:</strong> {[profissional.endereco, profissional.numero, profissional.bairro, profissional.cidade, profissional.estado].filter(Boolean).join(", ") || "Não informado"}</p>
                      <p className="pt-2 border-t mt-2"><strong>CREFITO:</strong> {profissional.registro_profissional || "Não informado"}</p>
                      <p><strong>Vínculo:</strong> {profissional.tipo_contratacao ? tipoLabel(profissional.tipo_contratacao) : "Não definido"}</p>
                      {profissional.tipo_contratacao === "pj" && <p><strong>CNPJ:</strong> {profissional.cnpj || "Não informado"}</p>}
                      <p><strong>Comissão:</strong> {profissional.commission_rate || 0}%</p>
                    </div>
                  )}
                  <Button onClick={handleProfissionalDownload} disabled={!profissional} className="w-full"><Download className="h-4 w-4 mr-2" /> Baixar PDF</Button>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader><CardTitle className="text-base">Pré-visualização do Contrato Profissional</CardTitle></CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none text-foreground space-y-4 text-sm border rounded-lg p-6 bg-white dark:bg-muted/20 max-h-[70vh] overflow-y-auto">
                    <h2 className="text-center font-bold text-lg">{clinicNome.toUpperCase()}</h2>
                    {clinicCNPJ && <p className="text-center text-xs text-muted-foreground">CNPJ: {clinicCNPJ}</p>}
                    <h3 className="text-center font-bold">CONTRATO DE PRESTAÇÃO DE SERVIÇOS PROFISSIONAIS</h3>

                    <p>Pelo presente instrumento particular, de um lado:</p>
                    <p><strong>CLÍNICA:</strong> {clinicNome}, pessoa jurídica de direito privado{clinicEnderecoFull ? `, com sede à ${clinicEnderecoFull}` : ""}{clinicTelefone ? `, telefone/WhatsApp ${clinicTelefone}` : ""}.</p>
                    <p>E, de outro lado:</p>
                    <p>
                      <strong>PROFISSIONAL:</strong>{" "}
                      <span className="bg-primary/10 px-1 rounded font-semibold">{profissional?.nome || "___________________________"}</span>
                      {profissional?.estado_civil && <>, {estadoCivilLabel(profissional.estado_civil)}</>}
                      , CPF nº <span className="bg-primary/10 px-1 rounded">{profissional?.cpf || "_______________"}</span>
                      , RG nº <span className="bg-primary/10 px-1 rounded">{profissional?.rg || "_______________"}</span>
                      {profissional?.endereco && <>, residente à {[profissional.endereco, profissional.numero ? `nº ${profissional.numero}` : "", profissional.bairro, profissional.cidade, profissional.estado].filter(Boolean).join(", ")}</>}
                      {profissional?.telefone && <>, telefone {profissional.telefone}</>}
                      , Registro Profissional: <span className="bg-primary/10 px-1 rounded">{profissional?.registro_profissional || "_______________"}</span>
                    </p>

                    <h4 className="font-bold mt-4">CLÁUSULA 1ª – DO OBJETO</h4>
                    <p>O presente contrato tem por objeto a prestação de serviços profissionais na área de Fisioterapia/Pilates pelo PROFISSIONAL, nas dependências da CLÍNICA.</p>

                    <h4 className="font-bold">CLÁUSULA 2ª – DA NATUREZA JURÍDICA</h4>
                    <p>§1º O presente instrumento possui natureza estritamente civil, inexistindo vínculo empregatício.</p>
                    <p>§2º O PROFISSIONAL atuará com autonomia técnica.</p>
                    <p>§3º O PROFISSIONAL declara atuar como:</p>
                    <div className="pl-4 space-y-1">
                      <p>({profissional?.tipo_contratacao === "autonomo" ? "X" : " "}) Autônomo</p>
                      <p>({profissional?.tipo_contratacao === "mei" ? "X" : " "}) MEI</p>
                      <p>({profissional?.tipo_contratacao === "pj" ? "X" : " "}) Pessoa Jurídica – CNPJ nº <span className="bg-primary/10 px-1 rounded">{profissional?.cnpj || "______________________"}</span></p>
                      <p>({profissional?.tipo_contratacao === "clt" ? "X" : " "}) CLT</p>
                    </div>

                    <h4 className="font-bold">CLÁUSULA 3ª – DA REMUNERAÇÃO</h4>
                    <p>§1º Comissão de <span className="bg-primary/10 px-1 rounded font-semibold">{profissional?.commission_rate || "___"}%</span> sobre valores efetivamente pagos pelos pacientes.</p>
                    <p>§2º A comissão incidirá exclusivamente sobre valores recebidos e compensados.</p>
                    <p>§3º Pagamento até o dia 10 do mês subsequente.</p>
                    <p>§4º Em caso de inadimplência, comissão devida apenas após quitação.</p>
                    <p>§5º Sem comissão sobre descontos, cortesias ou valores não recebidos.</p>

                    <h4 className="font-bold">CLÁUSULA 4ª – DAS OBRIGAÇÕES DO PROFISSIONAL</h4>
                    <ul className="space-y-1">
                      <li>I – Realizar atendimentos com ética e zelo;</li>
                      <li>II – Manter registro profissional regular;</li>
                      <li>III – Zelar pelos equipamentos da CLÍNICA;</li>
                      <li>IV – Cumprir horários agendados;</li>
                      <li>V – Manter sigilo sobre informações;</li>
                      <li>VI – Cumprir legislação vigente.</li>
                    </ul>

                    <h4 className="font-bold">CLÁUSULA 5ª – DAS OBRIGAÇÕES DA CLÍNICA</h4>
                    <ul className="space-y-1">
                      <li>I – Disponibilizar espaço e equipamentos;</li>
                      <li>II – Realizar cobrança dos pacientes;</li>
                      <li>III – Fornecer relatório mensal;</li>
                      <li>IV – Efetuar pagamento da comissão.</li>
                    </ul>

                    <h4 className="font-bold">CLÁUSULA 6ª – DA NÃO CAPTAÇÃO E NÃO DESVIO DE PACIENTES</h4>
                    <p>§1º Vedado captar ou desviar pacientes. §2º Vedação vigente por 12 meses após rescisão. §3º Multa de 10x o valor médio da mensalidade por paciente desviado.</p>

                    <h4 className="font-bold">CLÁUSULA 7ª – DA CONFIDENCIALIDADE E LGPD</h4>
                    <p>Sigilo absoluto sobre dados pessoais, prontuários, lista de pacientes e dados financeiros. Observância à Lei nº 13.709/2018 (LGPD).</p>

                    <h4 className="font-bold">CLÁUSULA 8ª – DA RESPONSABILIDADE TÉCNICA</h4>
                    <p>O PROFISSIONAL é responsável técnico pelos atendimentos realizados.</p>

                    <h4 className="font-bold">CLÁUSULA 9ª – DA RESCISÃO</h4>
                    <p>Rescisão mediante aviso prévio de 30 dias. Comissões apuradas serão quitadas normalmente.</p>

                    <h4 className="font-bold">CLÁUSULA 10ª – DO PRAZO</h4>
                    <p>Prazo indeterminado, iniciando-se em ___/___/______.</p>

                    <h4 className="font-bold">CLÁUSULA 11ª – DO FORO</h4>
                    <p>Foro da comarca de Barbacena/MG.</p>

                    <div className="mt-8 pt-4 border-t">
                      <p>Data: {format(new Date(), "dd/MM/yyyy")}</p>
                      <div className="grid grid-cols-2 gap-8 mt-8">
                        <div className="text-center"><div className="border-t border-foreground/40 pt-2">CLÍNICA</div><p className="text-xs text-muted-foreground">{clinicNome}</p></div>
                        <div className="text-center"><div className="border-t border-foreground/40 pt-2">PROFISSIONAL</div><p className="text-xs text-muted-foreground">{profissional?.nome || "_______________"}</p></div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default Contratos;
