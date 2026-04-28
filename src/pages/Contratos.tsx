import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileText, Download, Send, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { generateContractPDF } from "@/lib/generateContractPDF";
import { generateProfessionalContractPDF } from "@/lib/generateProfessionalContractPDF";
import { useClinicSettings } from "@/modules/clinic/hooks/useClinicSettings";
import { PatientCombobox } from "@/components/ui/patient-combobox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PenTool } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SignaturePad } from "@/components/clinical/SignaturePad";
import { toast } from "sonner";
import { History, Search, Eye, Trash2 } from "lucide-react";

const Contratos = () => {
  const { user, isPatient, patientId, isAdmin, isGestor } = useAuth();
  const { activeClinicId } = useClinic();
  const { data: clinicSettings } = useClinicSettings();
  const canManage = isAdmin || isGestor;
  const isProfissional = !canManage && !isPatient;
  const [selectedPaciente, setSelectedPaciente] = useState("");
  const [selectedPlano, setSelectedPlano] = useState("");
  const [selectedMatricula, setSelectedMatricula] = useState("");
  const [selectedProfissional, setSelectedProfissional] = useState("");
  const [incluirCarimbo, setIncluirCarimbo] = useState(false);
  const [incluirRubrica, setIncluirRubrica] = useState(false);
  const [rubricaNoCarimbo, setRubricaNoCarimbo] = useState(false);
  const [usarAssinaturaClinica, setUsarAssinaturaClinica] = useState(false);
  const [pacienteSignature, setPacienteSignature] = useState<string | null>(null);
  const [isSignatureDialogOpen, setIsSignatureDialogOpen] = useState(false);
  const [overrideEnrollmentFee, setOverrideEnrollmentFee] = useState<string>("");
  const [overridePaymentMethod, setOverridePaymentMethod] = useState<string>("");
  const clinicNome = clinicSettings?.nome || "Essencial Fisio Pilates";
  const clinicCNPJ = clinicSettings?.cnpj || "";
  const clinicEnderecoFull = [clinicSettings?.endereco, clinicSettings?.numero ? `nº ${clinicSettings.numero}` : "", clinicSettings?.bairro, clinicSettings?.cidade ? `${clinicSettings.cidade}/${clinicSettings.estado}` : ""].filter(Boolean).join(", ");
  const clinicTelefone = clinicSettings?.telefone || "";
  const clinicInstagram = clinicSettings?.instagram || "";

  const { data: pacientes = [] } = useQuery({
    queryKey: ["pacientes-contrato", activeClinicId],
    queryFn: async () => {
      if (isPatient && patientId) {
        const { data } = await supabase.from("pacientes")
          .select("id, nome, cpf, rg, telefone, email, rua, numero, complemento, bairro, cidade, estado, cep, contract_multa_atraso_pct, contract_juros_mensal_pct, contract_prazo_cancelamento_h, contract_dia_vencimento, contract_prazo_reposicao_dias, contract_vigencia_meses, contract_cidade_foro, contract_estado_foro, contract_enrollment_fee, contract_payment_method")
          .eq("id", patientId);
        return data ?? [];
      }
      if (activeClinicId) {
        const { data: cp } = await supabase.from("clinic_pacientes")
          .select("paciente_id").eq("clinic_id", activeClinicId);
        const ids = (cp || []).map(c => c.paciente_id);
        if (!ids.length) return [];
        const { data } = await supabase.from("pacientes")
          .select("id, nome, cpf, rg, telefone, email, rua, numero, complemento, bairro, cidade, estado, cep, contract_multa_atraso_pct, contract_juros_mensal_pct, contract_prazo_cancelamento_h, contract_dia_vencimento, contract_prazo_reposicao_dias, contract_vigencia_meses, contract_cidade_foro, contract_estado_foro, contract_enrollment_fee, contract_payment_method")
          .in("id", ids).eq("status", "ativo").order("nome");
        return data ?? [];
      }
      const { data } = await supabase.from("pacientes")
        .select("id, nome, cpf, rg, telefone, email, rua, numero, complemento, bairro, cidade, estado, cep, contract_multa_atraso_pct, contract_juros_mensal_pct, contract_prazo_cancelamento_h, contract_dia_vencimento, contract_prazo_reposicao_dias, contract_vigencia_meses, contract_cidade_foro, contract_estado_foro, contract_enrollment_fee, contract_payment_method")
        .eq("status", "ativo").order("nome");
      return data ?? [];
    },
  });

  const { data: contractHistory = [], refetch: refetchHistory } = useQuery({
    queryKey: ["documentos-contratos", activeClinicId, patientId],
    queryFn: async () => {
      let query = supabase.from("documentos_contratos").select("*, pacientes(nome)").order("criado_em", { ascending: false });
      if (activeClinicId) query = query.eq("clinic_id", activeClinicId);
      if (isPatient && patientId) query = query.eq("paciente_id", patientId);
      const { data } = await query;
      return data ?? [];
    }
  });

  const { data: planos = [] } = useQuery({
    queryKey: ["precos-planos-contrato", selectedPaciente],
    queryFn: async () => {
      // Carrega planos pré-cadastrados (catálogo) + planos de sessão ativos do paciente selecionado
      const { data: precos } = await supabase.from("precos_planos").select("*").eq("ativo", true).order("nome");
      const catalogo = (precos || []).map((p: any) => ({
        id: `preco:${p.id}`,
        nome: p.nome,
        valor: p.valor,
        frequencia_semanal: p.frequencia_semanal,
        modalidade: p.modalidade,
        origem: "catalogo" as const,
      }));

      let sessoes: any[] = [];
      if (selectedPaciente) {
        const { data: planosSessao } = await supabase
          .from("planos")
          .select("id, tipo_atendimento, total_sessoes, sessoes_utilizadas, valor, status")
          .eq("paciente_id", selectedPaciente)
          .eq("status", "ativo");
        sessoes = (planosSessao || []).map((p: any) => ({
          id: `sessao:${p.id}`,
          nome: `Plano de Sessões — ${p.tipo_atendimento} (${p.sessoes_utilizadas || 0}/${p.total_sessoes})`,
          valor: p.valor,
          frequencia_semanal: 1,
          modalidade: p.tipo_atendimento,
          origem: "sessao" as const,
        }));
      }
      return [...catalogo, ...sessoes];
    },
  });

  const { data: profissionais = [] } = useQuery({
    queryKey: ["profissionais-contrato", activeClinicId, isProfissional, user?.id],
    queryFn: async () => {
      if (isProfissional) {
        const { data } = await supabase.from("profiles")
          .select("*, assinatura_url, nome, user_id, rua, numero, complemento, bairro, cidade, estado, cep, registro_conselho, conselho_profissional, registro_profissional, contract_raio_nao_concorrencia_km, contract_multa_nao_captacao_fator, contract_multa_nao_captacao_valor, contract_dia_pagamento_comissao, contract_prazo_aviso_previo_dias, contract_multa_uso_marca_valor")
          .eq("user_id", user?.id).order("nome");
        return (data as any[]) ?? [];
      }
      if (!canManage) return [];
      // Carrega todos os profissionais da clínica ativa (mais robusto que filtrar por role)
      let userIds: string[] = [];
      if (activeClinicId) {
        const { data: cu } = await supabase.from("clinic_users")
          .select("user_id, role")
          .eq("clinic_id", activeClinicId)
          .in("role", ["profissional", "admin", "gestor"]);
        userIds = (cu || []).map(r => r.user_id);
      }
      // Fallback: se não houver clinic_users mapeados, usa user_roles
      if (userIds.length === 0) {
        const { data: roleData } = await supabase.from("user_roles").select("user_id").in("role", ["profissional", "admin", "gestor"]);
        userIds = roleData?.map(r => r.user_id) ?? [];
      }
      if (userIds.length === 0) return [];
      const { data } = await supabase.from("profiles")
        .select("*, assinatura_url, nome, user_id, rua, numero, complemento, bairro, cidade, estado, cep, registro_conselho, conselho_profissional, registro_profissional, contract_raio_nao_concorrencia_km, contract_multa_nao_captacao_fator, contract_multa_nao_captacao_valor, contract_dia_pagamento_comissao, contract_prazo_aviso_previo_dias, contract_multa_uso_marca_valor")
        .in("user_id", userIds).order("nome");
      return (data as any[]) ?? [];
    },
    enabled: canManage || isProfissional,
  });

  const { data: currentUserProfile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles")
        .select("nome, assinatura_url, rubrica_url, registro_profissional, conselho_profissional, registro_conselho, rua, numero, complemento, bairro, cidade, estado, cep, contract_raio_nao_concorrencia_km, contract_multa_nao_captacao_fator, contract_multa_nao_captacao_valor, contract_dia_pagamento_comissao, contract_prazo_aviso_previo_dias, contract_multa_uso_marca_valor")
        .eq("user_id", user?.id).single();
      return data;
    },
    enabled: !!user?.id,
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

  const getContractData = () => {
    const prof = currentUserProfile as any;
    const sigUrl = usarAssinaturaClinica ? clinicSettings?.assinatura_url : prof?.assinatura_url;
    const rubUrl = usarAssinaturaClinica ? clinicSettings?.rubrica_url : prof?.rubrica_url;

    const pacienteEndereco = [
      paciente?.rua,
      paciente?.numero ? `nº ${paciente.numero}` : "",
      paciente?.complemento,
      paciente?.bairro,
      paciente?.cidade ? `${paciente.cidade}/${paciente.estado}` : ""
    ].filter(Boolean).join(", ");

    return {
      pacienteNome: paciente?.nome || "",
      cpf: paciente?.cpf || "",
      rg: paciente?.rg || "",
      pacienteEndereco: pacienteEndereco,
      pacienteTelefone: paciente?.telefone || "",
      planoNome: plano?.nome || "A definir",
      planoFrequencia: plano?.frequencia_semanal || 1,
      planoModalidade: plano?.modalidade || "grupo",
      planoValor: matricula?.valor_mensal || plano?.valor || 0,
      desconto: desconto?.percentual_desconto || 0,
      dataContrato: format(new Date(), "dd/MM/yyyy"),
      horarios: matricula?.horarios || "A definir",
      pacienteSignature: pacienteSignature || undefined,
      profissionalSignature: sigUrl || undefined,
      profissionalNome: usarAssinaturaClinica ? clinicNome : (prof?.nome || clinicNome),
      profissionalRubrica: (incluirRubrica || (incluirCarimbo && rubricaNoCarimbo)) ? rubUrl : undefined,
      rubricaNoCarimbo: incluirCarimbo && rubricaNoCarimbo,
      incluirRubrica: incluirRubrica,
      incluirCarimbo: incluirCarimbo,
      profissionalRegistro: usarAssinaturaClinica ? clinicSettings?.cnpj : (prof?.registro_conselho || prof?.registro_profissional),
      conselhoProfissional: usarAssinaturaClinica ? undefined : prof?.conselho_profissional,
      contractId: crypto.randomUUID(),
      // Novos campos com fallback
      contractMultaAtrasoPct: paciente?.contract_multa_atraso_pct ?? clinicSettings?.pref_contract_multa_atraso_pct ?? 2,
      contractJurosMensalPct: paciente?.contract_juros_mensal_pct ?? clinicSettings?.pref_contract_juros_mensal_pct ?? 1,
      contractPrazoCancelamentoH: paciente?.contract_prazo_cancelamento_h ?? clinicSettings?.pref_contract_prazo_cancelamento_h ?? 3,
      contractPrazoReposicaoDias: paciente?.contract_prazo_reposicao_dias ?? clinicSettings?.pref_contract_prazo_reposicao_dias ?? 30,
      contractVigenciaMeses: paciente?.contract_vigencia_meses ?? clinicSettings?.pref_contract_vigencia_meses ?? 6,
      contractCidadeForo: paciente?.contract_cidade_foro ?? clinicSettings?.pref_contract_cidade_foro ?? clinicSettings?.cidade ?? "Barbacena",
      contractEstadoForo: paciente?.contract_estado_foro ?? clinicSettings?.pref_contract_estado_foro ?? clinicSettings?.estado ?? "MG",
      contractEnrollmentFee: Number(overrideEnrollmentFee) || 0,
      contractPaymentMethod: overridePaymentMethod || "Pix",
      witness1Name: clinicSettings?.pref_contract_witness1_name,
      witness1Cpf: clinicSettings?.pref_contract_witness1_cpf,
      witness2Name: clinicSettings?.pref_contract_witness2_name,
      witness2Cpf: clinicSettings?.pref_contract_witness2_cpf,
    };
  };

  const valorFinal = (matricula?.valor_mensal || (plano ? plano.valor : 0)) * (1 - (desconto?.percentual_desconto || 0) / 100);

  const handleDownload = async () => {
    if (!paciente) { toast.error("Selecione um paciente"); return; }
    const contractData = getContractData();
    const pdf = await generateContractPDF(contractData);
    
    // Automatic Storage
    try {
      const pdfBlob = pdf.output("blob");
      const fileName = `contrato_${paciente.id}_${Date.now()}.pdf`;
      const filePath = `${activeClinicId}/${fileName}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("contratos")
        .upload(filePath, pdfBlob);
        
      if (uploadError) throw uploadError;
      
      const { data: publicUrl } = supabase.storage.from("contratos").getPublicUrl(filePath);
      
      await supabase.from("documentos_contratos").insert({
        clinic_id: activeClinicId,
        paciente_id: paciente.id,
        tipo_documento: "paciente",
        arquivo_url: publicUrl.publicUrl,
        versao: 1,
        metadados: contractData
      });
      
      refetchHistory();
    } catch (e) {
      console.error("Erro ao salvar contrato:", e);
      toast.error("Não foi possível arquivar o contrato automaticamente, mas o download seguirá.");
    }

    pdf.save(`Contrato_${paciente.nome.replace(/\s/g, "_")}.pdf`);
    toast.success("Contrato gerado e arquivado com sucesso!");
  };

  const handleWhatsAppSend = async () => {
    if (!paciente?.telefone) { toast.error("Paciente sem telefone cadastrado"); return; }
    await handleDownload();
    const phone = paciente.telefone.replace(/\D/g, "");
    const fullPhone = phone.startsWith("55") ? phone : `55${phone}`;
    const msg = encodeURIComponent(`Olá ${paciente.nome}! Segue seu contrato da Essencial Fisio Pilates. Por favor, confira e assine. Qualquer dúvida estamos à disposição! 😊`);
    window.open(`https://wa.me/${fullPhone}?text=${msg}`, "_blank");
  };

  const handleProfissionalDownload = async () => {
    if (!profissional) { toast.error("Selecione um profissional"); return; }
    const endParts = [profissional.rua, profissional.numero ? `nº ${profissional.numero}` : "", profissional.complemento, profissional.bairro, profissional.cidade, profissional.estado].filter(Boolean).join(", ");
    const doc = await generateProfessionalContractPDF({
      profissionalNome: profissional.nome,
      registroProfissional: profissional.registro_conselho || profissional.registro_profissional || "",
      conselhoProfissional: profissional.conselho_profissional || "",
      tipoContratacao: profissional.tipo_contratacao || "autonomo",
      cnpj: profissional.cnpj || "",
      commissionRate: profissional.commission_rate || 0,
      cpf: profissional.cpf || "",
      rg: profissional.rg || "",
      endereco: endParts || "",
      estadoCivil: profissional.estado_civil || "",
      telefone: profissional.telefone || "",
      diaPagamento: profissional.contract_dia_pagamento_comissao ?? clinicSettings?.pref_contract_dia_pagamento_comissao ?? 10,
      raioNaoConcorrencia: profissional.contract_raio_nao_concorrencia_km ?? clinicSettings?.pref_contract_raio_nao_concorrencia_km ?? 5,
      multaNaoCaptacaoFator: profissional.contract_multa_nao_captacao_fator ?? clinicSettings?.pref_contract_multa_nao_captacao_fator,
      multaNaoCaptacaoValor: profissional.contract_multa_nao_captacao_valor ?? clinicSettings?.pref_contract_multa_nao_captacao_valor,
      prazoAvisoPrevio: profissional.contract_prazo_aviso_previo_dias ?? clinicSettings?.pref_contract_prazo_aviso_previo_dias ?? 30,
      multaUsoMarca: profissional.contract_multa_uso_marca_valor ?? clinicSettings?.pref_contract_multa_uso_marca_valor ?? 5000,
      valorSessaoFixo: profissional.contract_valor_sessao_fixo ?? 0,
      dataInicio: format(new Date(), "dd/MM/yyyy"),
    });
    doc.save(`contrato-profissional-${profissional.nome.replace(/\s+/g, "-").toLowerCase()}.pdf`);
    toast.success("Contrato profissional gerado!");
  };

  useEffect(() => {
    if (isPatient && patientId && !selectedPaciente && pacientes.length > 0) setSelectedPaciente(patientId);
    if (paciente) {
      setOverrideEnrollmentFee((paciente.contract_enrollment_fee ?? clinicSettings?.pref_contract_enrollment_fee ?? 0).toString());
      setOverridePaymentMethod(paciente.contract_payment_method ?? "Pix");
    }
  }, [isPatient, patientId, selectedPaciente, pacientes, paciente, clinicSettings]);

  useEffect(() => {
    if (isProfissional && profissionais.length > 0 && !selectedProfissional) {
      setSelectedProfissional(profissionais[0].id);
    }
  }, [isProfissional, profissionais, selectedProfissional]);

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
          {(canManage || isProfissional) && (
            <TabsTrigger value="profissional" className="flex items-center gap-2">
              <Users className="h-4 w-4" /> {isProfissional ? "Meu Contrato" : "Profissional"}
            </TabsTrigger>
          )}
          <TabsTrigger value="historico" className="flex items-center gap-2">
            <History className="h-4 w-4" /> Histórico
          </TabsTrigger>
        </TabsList>

        {/* ===== TAB PACIENTE ===== */}
        <TabsContent value="paciente">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" /> Dados do Contrato
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!isPatient && (
                  <PatientCombobox
                    patients={pacientes as any[]}
                    value={selectedPaciente}
                    onValueChange={setSelectedPaciente}
                    placeholder="Selecione o paciente"
                  />
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
                {selectedPaciente && (matriculas as any[]).length > 0 && (
                  <div>
                    <Label>Matrícula (opcional)</Label>
                    <Select value={selectedMatricula} onValueChange={setSelectedMatricula}>
                      <SelectTrigger><SelectValue placeholder="Vincular a matrícula" /></SelectTrigger>
                      <SelectContent>
                        {(matriculas as any[]).map((m: any) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.tipo_atendimento} – R$ {Number(m.valor_mensal).toFixed(2)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {paciente && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs" htmlFor="override-enrollment">Taxa Matrícula (R$)</Label>
                      <Input
                        id="override-enrollment"
                        type="number"
                        className="h-8"
                        value={overrideEnrollmentFee}
                        onChange={(e) => setOverrideEnrollmentFee(e.target.value)}
                        placeholder="0.00"
                        title="Taxa de matrícula"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs" htmlFor="override-payment">Forma de Pagto.</Label>
                      <Input
                        id="override-payment"
                        type="text"
                        className="h-8"
                        value={overridePaymentMethod}
                        onChange={(e) => setOverridePaymentMethod(e.target.value)}
                        placeholder="Ex: Pix"
                        title="Forma de pagamento"
                      />
                    </div>
                  </div>
                )}

                {paciente && (
                  <div className="rounded-lg border p-3 space-y-1 text-sm bg-muted/30">
                    <p><strong>Nome:</strong> {paciente.nome}</p>
                    <p><strong>CPF:</strong> {paciente.cpf || "Não informado"}</p>
                    <p><strong>RG:</strong> {paciente.rg || "Não informado"}</p>
                    {plano && (
                      <p className="pt-2 border-t mt-2">
                        <strong>Plano:</strong> {plano.nome} ({plano.frequencia_semanal}x/semana)
                      </p>
                    )}
                    <p className="text-primary font-bold"><strong>Valor:</strong> R$ {valorFinal.toFixed(2)}</p>
                  </div>
                )}

                {!isPatient && (
                  <div className="space-y-4 pt-2 border-t mt-2">
                    <div className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors">
                      <Label className="text-xs font-semibold cursor-pointer" htmlFor="inc-assinatura-clinica">Usar assinatura da clínica</Label>
                      <input
                        id="inc-assinatura-clinica"
                        type="checkbox"
                        title="Usar assinatura da clínica"
                        className="h-4 w-4 rounded border-gray-300"
                        checked={usarAssinaturaClinica}
                        onChange={(e) => setUsarAssinaturaClinica(e.target.checked)}
                      />
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors">
                      <Label className="text-xs font-semibold cursor-pointer" htmlFor="inc-carimbo">Incluir Carimbo</Label>
                      <input
                        id="inc-carimbo"
                        type="checkbox"
                        title="Incluir Carimbo"
                        className="h-4 w-4 rounded border-gray-300"
                        checked={incluirCarimbo}
                        onChange={(e) => setIncluirCarimbo(e.target.checked)}
                      />
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-2 pt-2">
                  <Button onClick={() => setIsSignatureDialogOpen(true)} variant="outline" disabled={!paciente} className="w-full">
                    <PenTool className="h-4 w-4 mr-2" /> Assinar
                  </Button>
                  <Button onClick={handleDownload} disabled={!paciente} className="w-full">
                    <Download className="h-4 w-4 mr-2" /> PDF
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Pré-visualização</CardTitle>
                <p className="text-xs text-muted-foreground">Esta pré-visualização reflete fielmente o PDF que será gerado.</p>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none text-foreground space-y-3 text-sm border rounded-lg p-6 bg-card max-h-[70vh] overflow-y-auto">
                  <h2 className="text-center font-bold text-lg">{clinicNome.toUpperCase()}</h2>
                  <h3 className="text-center font-bold">CONTRATO DE PRESTAÇÃO DE SERVIÇOS – PILATES</h3>

                  <p><strong>CONTRATADA:</strong> {clinicNome}{clinicEnderecoFull ? `, com sede à ${clinicEnderecoFull}` : ""}{clinicTelefone ? `, telefone ${clinicTelefone}` : ""}{clinicInstagram ? `, Instagram ${clinicInstagram}` : ""}.</p>
                  <p><strong>CONTRATANTE (PACIENTE):</strong> Nome: {paciente?.nome || "___________________"} | CPF: {paciente?.cpf || "_______________"} | RG: {paciente?.rg || "_______________"}{paciente?.telefone ? ` | Telefone: ${paciente.telefone}` : ""}{paciente ? ` | Endereço: ${[paciente.rua, paciente.numero ? `nº ${paciente.numero}` : "", paciente.complemento, paciente.bairro, paciente.cidade ? `${paciente.cidade}/${paciente.estado}` : ""].filter(Boolean).join(", ") || "—"}` : ""}.</p>

                  <h4 className="font-bold border-b pb-1">CLÁUSULA 1ª – DO OBJETO</h4>
                  <p>Prestação de serviços de Pilates, conforme plano contratado, com horários previamente agendados.</p>

                  <h4 className="font-bold border-b pb-1">CLÁUSULA 2ª – DA NATUREZA DO PLANO</h4>
                  <p className="whitespace-pre-line">O CONTRATANTE declara ciência de que:{"\n"}✔ O serviço é mensal;{"\n"}✔ Não é vinculado a número de aulas frequentadas;{"\n"}✔ A vaga/horário é reservada mensalmente;{"\n"}✔ Faltas não geram desconto ou crédito.</p>

                  <h4 className="font-bold border-b pb-1">CLÁUSULA 3ª – DO PLANO CONTRATADO</h4>
                  <p className="whitespace-pre-line">Plano: {plano?.nome || "A definir"}{"\n"}Frequência: {plano?.frequencia_semanal || 1} vez(es) por semana{"\n"}Horário(s): {matricula?.horarios || "A definir"}{"\n"}Valor mensal: R$ {valorFinal.toFixed(2)}{Number(overrideEnrollmentFee) > 0 ? `\nTaxa de matrícula: R$ ${Number(overrideEnrollmentFee).toFixed(2)}` : ""}</p>

                  <h4 className="font-bold border-b pb-1">CLÁUSULA 4ª – DO PAGAMENTO</h4>
                  <p className="whitespace-pre-line">§1º O pagamento será realizado no primeiro dia de aula do mês{overridePaymentMethod ? `, via ${overridePaymentMethod}` : ""}.{"\n"}§2º Em caso de atraso: Multa de {paciente?.contract_multa_atraso_pct ?? clinicSettings?.pref_contract_multa_atraso_pct ?? 2}% e Juros de {paciente?.contract_juros_mensal_pct ?? clinicSettings?.pref_contract_juros_mensal_pct ?? 1}% ao mês.{"\n"}§3º Após inadimplência: Aulas poderão ser suspensas imediatamente e o horário poderá ser liberado para outro paciente.</p>

                  <h4 className="font-bold border-b pb-1">CLÁUSULA 5ª – DAS FALTAS E REPOSIÇÕES</h4>
                  <p className="whitespace-pre-line">§1º Reposição somente se avisado com mínimo de {paciente?.contract_prazo_cancelamento_h ?? clinicSettings?.pref_contract_prazo_cancelamento_h ?? 3} horas de antecedência.{"\n"}§2º Aulas não desmarcadas no prazo serão consideradas realizadas.{"\n"}§3º Reposição deve ocorrer em até {paciente?.contract_prazo_reposicao_dias ?? clinicSettings?.pref_contract_prazo_reposicao_dias ?? 30} dias.{"\n"}§4º A reposição depende de disponibilidade de vaga.{"\n"}§5º Após {paciente?.contract_prazo_reposicao_dias ?? clinicSettings?.pref_contract_prazo_reposicao_dias ?? 30} dias → aula perdida sem direito a compensação.</p>

                  <h4 className="font-bold border-b pb-1">CLÁUSULA 6ª – DOS FERIADOS E RECESSOS</h4>
                  <p className="whitespace-pre-line">§1º Não haverá aulas em feriados ou recessos da clínica.{"\n"}§2º Não há reposição ou desconto nesses casos.</p>

                  <h4 className="font-bold border-b pb-1">CLÁUSULA 7ª – DOS ATRASOS</h4>
                  <p>Atrasos do paciente não prolongam a aula e não geram reposição.</p>

                  <h4 className="font-bold border-b pb-1">CLÁUSULA 8ª – DA SAÚDE E RESPONSABILIDADE DO PACIENTE</h4>
                  <p className="whitespace-pre-line">§1º O paciente declara estar apto à prática.{"\n"}§2º Obriga-se a informar: Lesões, Doenças, Cirurgias, Gravidez ou uso de medicação relevante.{"\n"}§3º A omissão dessas informações transfere a responsabilidade ao paciente.</p>

                  <h4 className="font-bold border-b pb-1">CLÁUSULA 9ª – DOS RISCOS DA ATIVIDADE</h4>
                  <p>O CONTRATANTE reconhece que o Pilates envolve atividade física e riscos inerentes, ainda que mínimos.</p>

                  <h4 className="font-bold border-b pb-1">CLÁUSULA 10ª – DO SEGURO E LIMITAÇÃO DE RESPONSABILIDADE</h4>
                  <p className="whitespace-pre-line">§1º A clínica poderá manter seguro de responsabilidade civil.{"\n"}§2º A responsabilidade da clínica e dos profissionais somente ocorrerá em caso de dolo ou culpa comprovada.{"\n"}§3º Não há responsabilidade nos casos de omissão de informações de saúde, descumprimento de orientações, execução inadequada ou limitações pré-existentes.{"\n"}§4º Eventuais indenizações seguirão os limites legais e da apólice (se houver).</p>

                  <h4 className="font-bold border-b pb-1">CLÁUSULA 11ª – DA PROTEÇÃO DOS PROFISSIONAIS</h4>
                  <p>O paciente compromete-se a respeitar os profissionais, seguir orientações técnicas e manter conduta adequada. Parágrafo único: Conduta inadequada pode gerar cancelamento imediato.</p>

                  <h4 className="font-bold border-b pb-1">CLÁUSULA 12ª – DO DIREITO DE IMAGEM</h4>
                  <p>Autoriza o uso de imagem para divulgação da clínica. Pode revogar por escrito.</p>

                  <h4 className="font-bold border-b pb-1">CLÁUSULA 13ª – DA LGPD (DADOS PESSOAIS)</h4>
                  <p className="whitespace-pre-line">§1º Dados serão usados para cadastro, atendimento, comunicação e obrigações legais.{"\n"}§2º Dados de saúde são considerados sensíveis.{"\n"}§3º A clínica adota medidas de segurança.</p>

                  <h4 className="font-bold border-b pb-1">CLÁUSULA 14ª – DO TRANCAMENTO</h4>
                  <p className="whitespace-pre-line">§1º Deve ser solicitado com antecedência e depende de aprovação da clínica.{"\n"}§2º Não há devolução de valores.</p>

                  <h4 className="font-bold border-b pb-1">CLÁUSULA 15ª – DO CANCELAMENTO</h4>
                  <p className="whitespace-pre-line">§1º Pode ser solicitado a qualquer momento.{"\n"}§2º Não há devolução de valores pagos.{"\n"}§3º O paciente perde o direito ao horário reservado.</p>

                  <h4 className="font-bold border-b pb-1">CLÁUSULA 16ª – DOS OBJETOS PESSOAIS</h4>
                  <p>A clínica não se responsabiliza por perdas ou danos a objetos pessoais.</p>

                  <h4 className="font-bold border-b pb-1">CLÁUSULA 17ª – DO USO DA ESTRUTURA</h4>
                  <p>O paciente deve zelar pelos equipamentos, seguir orientações e não utilizar aparelhos sem autorização.</p>

                  <h4 className="font-bold border-b pb-1">CLÁUSULA 18ª – DO CASO FORTUITO</h4>
                  <p>A clínica não se responsabiliza por interrupções externas (energia, força maior, etc.).</p>

                  <h4 className="font-bold border-b pb-1">CLÁUSULA 19ª – DA VIGÊNCIA</h4>
                  <p>Prazo indeterminado.</p>

                  <h4 className="font-bold border-b pb-1">CLÁUSULA 20ª – DO FORO</h4>
                  <p>Fica eleito o foro da comarca de {paciente?.contract_cidade_foro ?? clinicSettings?.pref_contract_cidade_foro ?? clinicSettings?.cidade ?? "Barbacena"}/{paciente?.contract_estado_foro ?? clinicSettings?.pref_contract_estado_foro ?? clinicSettings?.estado ?? "MG"}.</p>

                  <h4 className="font-bold border-b pb-1">CLÁUSULA 21ª – DA VALIDADE DAS ASSINATURAS ELETRÔNICAS</h4>
                  <p>As partes reconhecem a validade jurídica das assinaturas eletrônicas apostas neste contrato, conforme a Medida Provisória nº 2.200-2/2001 e o Código Civil Brasileiro, outorgando-lhe plena eficácia jurídica e executiva.</p>

                  <p className="pt-3">{clinicSettings?.cidade || "_______________"}, {format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}.</p>

                  <div className="mt-8 grid grid-cols-2 gap-8 text-center border-t pt-8">
                    <div>
                      {pacienteSignature ? <img src={pacienteSignature} alt="Assinatura" className="h-12 mx-auto mb-2" /> : <div className="h-12" />}
                      <div className="border-t border-muted-foreground pt-2">CONTRATANTE<br/><span className="text-xs">{paciente?.nome || ""}</span></div>
                    </div>
                    <div>
                      <div className="h-12" />
                      <div className="border-t border-muted-foreground pt-2">CONTRATADA<br/><span className="text-xs">{clinicNome}</span></div>
                    </div>
                  </div>

                  {(clinicSettings?.pref_contract_witness1_name || clinicSettings?.pref_contract_witness2_name) && (
                    <div className="mt-6 grid grid-cols-2 gap-8 text-center border-t pt-6 text-xs">
                      {clinicSettings?.pref_contract_witness1_name && (
                        <div>
                          <div className="h-8" />
                          <div className="border-t border-muted-foreground pt-1">TESTEMUNHA 1<br/>{clinicSettings.pref_contract_witness1_name}<br/>CPF: {clinicSettings.pref_contract_witness1_cpf || "—"}</div>
                        </div>
                      )}
                      {clinicSettings?.pref_contract_witness2_name && (
                        <div>
                          <div className="h-8" />
                          <div className="border-t border-muted-foreground pt-1">TESTEMUNHA 2<br/>{clinicSettings.pref_contract_witness2_name}<br/>CPF: {clinicSettings.pref_contract_witness2_cpf || "—"}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* PÁGINA EXTRA: TERMO DE SAÚDE */}
                  <div className="mt-10 pt-6 border-t-2 border-dashed">
                    <h3 className="text-center font-bold text-base">TERMO DE SAÚDE E RESPONSABILIDADE DO PACIENTE</h3>
                    <h4 className="font-bold mt-4">1. DECLARAÇÃO DE CONDIÇÃO DE SAÚDE</h4>
                    <p>Declaro que fui orientado(a) a informar corretamente meu estado de saúde e afirmo que:</p>
                    <p className="whitespace-pre-line">( ) Estou apto(a) para prática de exercícios físicos{"\n"}( ) Possuo restrições médicas (detalhar abaixo):</p>
                    <div className="border-b border-muted-foreground h-5" />
                    <div className="border-b border-muted-foreground h-5 mt-3" />

                    <h4 className="font-bold mt-4">2. INFORMAÇÕES OBRIGATÓRIAS DE SAÚDE (Marque se possuir)</h4>
                    <p className="whitespace-pre-line">( ) Lesões atuais/antigas{"\n"}( ) Cirurgias prévias{"\n"}( ) Doenças cardiovasculares{"\n"}( ) Problemas ortopédicos{"\n"}( ) Gravidez/Pós-parto{"\n"}( ) Uso de medicamentos contínuos</p>

                    <h4 className="font-bold mt-4">3. RESPONSABILIDADE E ISENÇÃO</h4>
                    <p className="text-justify">O Pilates é uma atividade orientada, mas há riscos inerentes. A omissão de informações transfere a responsabilidade ao paciente. A clínica não se responsabiliza por lesões decorrentes de omissões ou descumprimento de orientações técnicas.</p>
                    <div className="mt-6 w-1/2">
                      <div className="border-t border-muted-foreground pt-1 text-xs">Assinatura do Paciente</div>
                    </div>
                  </div>

                  {/* PÁGINA EXTRA: POLÍTICA INTERNA */}
                  <div className="mt-10 pt-6 border-t-2 border-dashed">
                    <h3 className="text-center font-bold text-base">POLÍTICA INTERNA – PACIENTES</h3>
                    <h4 className="font-bold mt-4">1. ORGANIZAÇÃO</h4>
                    <p>Aulas com horário agendado. Reserva exclusiva da vaga. Atrasos não prorrogam a aula.</p>
                    <h4 className="font-bold mt-4">2. FALTAS E REPOSIÇÕES</h4>
                    <p>Cancelamento com mín. {paciente?.contract_prazo_cancelamento_h ?? clinicSettings?.pref_contract_prazo_cancelamento_h ?? 3}h de antecedência. Reposição em até {paciente?.contract_prazo_reposicao_dias ?? clinicSettings?.pref_contract_prazo_reposicao_dias ?? 30} dias, conforme vaga disponível.</p>
                    <h4 className="font-bold mt-4">3. PAGAMENTOS</h4>
                    <p>Mensalidade paga no primeiro dia de aula do mês. Atrasos incorrem em multa de {paciente?.contract_multa_atraso_pct ?? clinicSettings?.pref_contract_multa_atraso_pct ?? 2}% e juros de {paciente?.contract_juros_mensal_pct ?? clinicSettings?.pref_contract_juros_mensal_pct ?? 1}% ao mês.</p>
                    <h4 className="font-bold mt-4">4. CONDUTA</h4>
                    <p>Respeito profissional. Vestimenta adequada. Proibido usar aparelhos sem orientação.</p>
                    <h4 className="font-bold mt-4">5. FERIADOS E RECESSOS</h4>
                    <p>Não há aulas em feriados e recessos. Não há reposição ou abatimento nesses períodos.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ===== TAB PROFISSIONAL ===== */}
        {(canManage || isProfissional) && (
          <TabsContent value="profissional">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-1">
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Profissional</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {!isProfissional && (
                    <Select value={selectedProfissional} onValueChange={setSelectedProfissional}>
                      <SelectTrigger><SelectValue placeholder="Selecione o profissional" /></SelectTrigger>
                      <SelectContent>
                        {(profissionais as any[]).map((p: any) => (
                          <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {profissional && (
                    <div className="rounded-lg border p-3 space-y-1 text-sm bg-muted/30">
                      <p><strong>Nome:</strong> {profissional.nome}</p>
                      <p><strong>CREFITO:</strong> {profissional.registro_profissional}</p>
                      <p><strong>Vínculo:</strong> {tipoLabel(profissional.tipo_contratacao || "")}</p>
                    </div>
                  )}
                  <Button onClick={handleProfissionalDownload} disabled={!profissional} className="w-full">
                    <Download className="h-4 w-4 mr-2" /> Baixar PDF
                  </Button>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Pré-visualização do Contrato</CardTitle>
                  <p className="text-xs text-muted-foreground">Esta pré-visualização reflete fielmente o PDF que será gerado.</p>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none text-foreground space-y-3 text-sm border rounded-lg p-6 bg-card max-h-[70vh] overflow-y-auto">
                    <h2 className="text-center font-bold text-lg">{clinicNome.toUpperCase()}</h2>
                    <h3 className="text-center font-bold">CONTRATO DE PRESTAÇÃO DE SERVIÇOS PROFISSIONAIS – PILATES</h3>

                    <p><strong>CONTRATANTE:</strong> {clinicNome}{clinicEnderecoFull ? `, com sede à ${clinicEnderecoFull}` : ""}{clinicTelefone ? `, telefone ${clinicTelefone}` : ""}, doravante denominada CLÍNICA.</p>
                    <p><strong>CONTRATADO(A):</strong> Nome: {profissional?.nome || "___________________"} | CPF: {profissional?.cpf || "_______________"} | RG: {profissional?.rg || "_______________"} | {profissional?.conselho_profissional || "REGISTRO"}: {profissional?.registro_conselho || profissional?.registro_profissional || "_______________"}{profissional ? ` | Endereço: ${[profissional.rua, profissional.numero ? `nº ${profissional.numero}` : "", profissional.complemento, profissional.bairro, profissional.cidade, profissional.estado].filter(Boolean).join(", ") || "—"}` : ""}, doravante denominado(a) PROFISSIONAL.</p>

                    <h4 className="font-bold border-b pb-1">CLÁUSULA 1ª – DO OBJETO</h4>
                    <p>Prestação de serviços profissionais de Pilates e/ou atendimentos correlatos nas dependências da CLÍNICA ou em local por ela indicado.</p>

                    <h4 className="font-bold border-b pb-1">CLÁUSULA 2ª – DA NATUREZA JURÍDICA</h4>
                    <p className="whitespace-pre-line">§1º Este contrato possui natureza civil/autônoma, não gerando vínculo empregatício.{"\n"}§2º Não há subordinação jurídica, controle de jornada ou exclusividade obrigatória, salvo previsão expressa.{"\n"}§3º O PROFISSIONAL declara atuar como: ({(profissional?.tipo_contratacao || "autonomo") === "autonomo" ? "X" : " "}) Autônomo | ({profissional?.tipo_contratacao === "mei" ? "X" : " "}) MEI | ({profissional?.tipo_contratacao === "pj" ? "X" : " "}) Pessoa Jurídica{profissional?.cnpj ? ` – CNPJ nº ${profissional.cnpj}` : ""}</p>

                    <h4 className="font-bold border-b pb-1">CLÁUSULA 3ª – DA REMUNERAÇÃO (COMISSÃO)</h4>
                    <p className="whitespace-pre-line">§1º O PROFISSIONAL receberá {profissional?.commission_rate ?? "___"}% sobre os valores efetivamente pagos pelos pacientes.{"\n"}§2º A comissão incidirá sobre: Mensalidades, Sessões avulsas e Pacotes efetivamente quitados.{"\n"}§3º Não incide comissão sobre: Cortesias, Descontos, Valores inadimplentes e Taxas administrativas.{"\n"}§4º O pagamento será realizado até o dia {profissional?.contract_dia_pagamento_comissao ?? clinicSettings?.pref_contract_dia_pagamento_comissao ?? 10} do mês seguinte.{"\n"}§5º A CLÍNICA poderá reter valores em caso de: Estorno, Chargeback ou Reembolso ao paciente.</p>

                    <h4 className="font-bold border-b pb-1">CLÁUSULA 4ª – DA ORGANIZAÇÃO DOS ATENDIMENTOS</h4>
                    <p className="whitespace-pre-line">§1º A agenda será organizada em conjunto.{"\n"}§2º O atendimento deve respeitar padrões da clínica.{"\n"}§3º Atrasos recorrentes poderão gerar advertência ou rescisão.</p>

                    <h4 className="font-bold border-b pb-1">CLÁUSULA 5ª – DAS OBRIGAÇÕES DO PROFISSIONAL</h4>
                    <p className="whitespace-pre-line">I – Atuar com ética e técnica;{"\n"}II – Manter registro profissional regular;{"\n"}III – Seguir protocolos da clínica;{"\n"}IV – Zelar por equipamentos;{"\n"}V – Não prestar orientações fora de sua competência;{"\n"}VI – Utilizar uniforme/padrão quando exigido;{"\n"}VII – Cumprir LGPD e sigilo absoluto.</p>

                    <h4 className="font-bold border-b pb-1">CLÁUSULA 6ª – DAS OBRIGAÇÕES DA CLÍNICA</h4>
                    <p className="whitespace-pre-line">I – Disponibilizar estrutura e equipamentos;{"\n"}II – Realizar cobrança dos pacientes;{"\n"}III – Fornecer demonstrativo financeiro;{"\n"}IV – Efetuar pagamento da comissão.</p>

                    <h4 className="font-bold border-b pb-1">CLÁUSULA 7ª – DA NÃO CAPTAÇÃO DE PACIENTES</h4>
                    <p className="whitespace-pre-line">§1º É proibido captar ou desviar pacientes.{"\n"}§2º Vigência: durante o contrato e até 12 meses após saída.{"\n"}§3º Inclui: Oferecer atendimento particular, Passar contato pessoal com finalidade profissional e Levar paciente para outro local.{"\n"}§4º Multa: {profissional?.contract_multa_nao_captacao_valor ? `R$ ${Number(profissional.contract_multa_nao_captacao_valor).toFixed(2)}` : `${profissional?.contract_multa_nao_captacao_fator ?? clinicSettings?.pref_contract_multa_nao_captacao_fator ?? 10}x valor médio da mensalidade`} por paciente desviado, podendo acumular.</p>

                    <h4 className="font-bold border-b pb-1">CLÁUSULA 8ª – DA NÃO CONCORRÊNCIA</h4>
                    <p>§1º O PROFISSIONAL não poderá atuar em clínica concorrente no raio de {profissional?.contract_raio_nao_concorrencia_km ?? clinicSettings?.pref_contract_raio_nao_concorrencia_km ?? 5} km durante a vigência do contrato.</p>

                    <h4 className="font-bold border-b pb-1">CLÁUSULA 9ª – CONFIDENCIALIDADE E LGPD</h4>
                    <p className="whitespace-pre-line">§1º O PROFISSIONAL compromete-se a proteger: Dados pessoais e sensíveis, Prontuários, Lista de pacientes, Dados financeiros e estratégicos.{"\n"}§2º Deverá cumprir a Lei nº 13.709/2018 (LGPD).{"\n"}§3º É proibido: Tirar fotos de prontuários, Compartilhar dados via WhatsApp pessoal sem segurança e Armazenar dados sem proteção.{"\n"}§4º Vazamento gera responsabilidade civil.{"\n"}§5º Sigilo é vitalício (mesmo após saída).{"\n"}§6º Multa: R$ {Number(profissional?.contract_multa_uso_marca_valor ?? clinicSettings?.pref_contract_multa_uso_marca_valor ?? 5000).toFixed(2)} + perdas e danos.</p>

                    <h4 className="font-bold border-b pb-1">CLÁUSULA 10ª – DO USO DA MARCA E IMAGEM</h4>
                    <p className="whitespace-pre-line">§1º O PROFISSIONAL não pode usar a marca da clínica sem autorização.{"\n"}§2º Não pode divulgar pacientes ou atendimentos sem consentimento.{"\n"}§3º Autoriza a clínica a usar sua imagem institucionalmente.</p>

                    <h4 className="font-bold border-b pb-1">CLÁUSULA 11ª – DOS DANOS E RESPONSABILIDADES</h4>
                    <p className="whitespace-pre-line">§1º Danos causados por negligência serão de responsabilidade do PROFISSIONAL.{"\n"}§2º Danos a equipamentos poderão ser cobrados.</p>

                    <h4 className="font-bold border-b pb-1">CLÁUSULA 12ª – DAS FALTAS E CANCELAMENTOS</h4>
                    <p className="whitespace-pre-line">§1º Comissão só é devida sobre atendimento realizado e pago.{"\n"}§2º Falta do profissional sem aviso pode gerar penalidade.{"\n"}§3º Reposição segue regras da clínica.</p>

                    <h4 className="font-bold border-b pb-1">CLÁUSULA 13ª – DA AUDITORIA E CONTROLE</h4>
                    <p>A CLÍNICA poderá auditar atendimentos, agenda e registros para conferência de comissões.</p>

                    <h4 className="font-bold border-b pb-1">CLÁUSULA 14ª – DA RESCISÃO</h4>
                    <p className="whitespace-pre-line">§1º Aviso prévio: {profissional?.contract_prazo_aviso_previo_dias ?? clinicSettings?.pref_contract_prazo_aviso_previo_dias ?? 30} dias.{"\n"}§2º Rescisão imediata em caso de: Quebra de sigilo, Desvio de pacientes ou Conduta antiética.</p>

                    <h4 className="font-bold border-b pb-1">CLÁUSULA 15ª – DAS PENALIDADES</h4>
                    <p>Podem ser aplicadas: Advertência, Suspensão, Multa ou Rescisão.</p>

                    <h4 className="font-bold border-b pb-1">CLÁUSULA 16ª – DO PRAZO</h4>
                    <p>Prazo indeterminado, iniciando em {format(new Date(), "dd/MM/yyyy")}.</p>

                    <h4 className="font-bold border-b pb-1">CLÁUSULA 17ª – DO FORO</h4>
                    <p>Foro de {clinicSettings?.pref_contract_cidade_foro || clinicSettings?.cidade || "Barbacena"}/{clinicSettings?.pref_contract_estado_foro || clinicSettings?.estado || "MG"}.</p>

                    <h4 className="font-bold border-b pb-1">CLÁUSULA 18ª – DA VALIDADE DAS ASSINATURAS ELETRÔNICAS</h4>
                    <p>As partes reconhecem a validade jurídica das assinaturas eletrônicas apostas neste contrato, conforme a Medida Provisória nº 2.200-2/2001 e o Código Civil Brasileiro, outorgando-lhe plena eficácia jurídica e executiva.</p>

                    <p className="pt-3">{clinicSettings?.cidade || "_______________"}, {format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}.</p>

                    <div className="mt-8 grid grid-cols-2 gap-8 text-center border-t pt-8">
                      <div>
                        <div className="h-12" />
                        <div className="border-t border-muted-foreground pt-2">CLÍNICA<br/><span className="text-xs">{clinicNome}</span></div>
                      </div>
                      <div>
                        <div className="h-12" />
                        <div className="border-t border-muted-foreground pt-2">PROFISSIONAL<br/><span className="text-xs">{profissional?.nome || ""}</span></div>
                      </div>
                    </div>

                    {/* PÁGINA EXTRA: POLÍTICA INTERNA PROFISSIONAL */}
                    <div className="mt-10 pt-6 border-t-2 border-dashed">
                      <h3 className="text-center font-bold text-base">POLÍTICA INTERNA – PROFISSIONAIS</h3>
                      <h4 className="font-bold mt-4">1. CONDUTA</h4>
                      <p>Ética e respeito. Seguir protocolos técnicos. Postura profissional irrepreensível.</p>
                      <h4 className="font-bold mt-4">2. CONFIDENCIALIDADE</h4>
                      <p>Proibido compartilhar dados, fotografar prontuários ou usar dados fora da clínica.</p>
                      <h4 className="font-bold mt-4">3. RELACIONAMENTO</h4>
                      <p>Vedado atendimento particular de pacientes da clínica ou desvio para outros locais.</p>
                      <h4 className="font-bold mt-4">4. ESTRUTURA</h4>
                      <p>Zelo absoluto pelos equipamentos. Notificar danos imediatamente.</p>
                      <h4 className="font-bold mt-4">5. AGENDA</h4>
                      <p>Cumprimento rigoroso de horários. Aviso prévio obrigatório para ausências.</p>
                      <h4 className="font-bold mt-4">6. LGPD</h4>
                      <p>Tratamento de dados com sigilo absoluto. Não armazenar dados em dispositivos pessoais.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}

        {/* ===== TAB HISTÓRICO ===== */}
        <TabsContent value="historico">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-4 w-4 text-primary" /> Histórico de Contratos Gerados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      <th className="px-4 py-3 text-left font-medium">Data</th>
                      <th className="px-4 py-3 text-left font-medium">Paciente</th>
                      <th className="px-4 py-3 text-left font-medium">Tipo</th>
                      <th className="px-4 py-3 text-right font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-muted-foreground">
                    {contractHistory.length > 0 ? (
                      contractHistory.map((doc: any) => (
                        <tr key={doc.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3">{format(new Date(doc.criado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}</td>
                          <td className="px-4 py-3 font-medium text-foreground">{doc.pacientes?.nome || "Profissional"}</td>
                          <td className="px-4 py-3 capitalize">{doc.tipo_documento}</td>
                          <td className="px-4 py-3 text-right space-x-2">
                            <Button variant="ghost" size="icon" asChild>
                              <a href={doc.arquivo_url} target="_blank" rel="noreferrer" title="Visualizar">
                                <Eye className="h-4 w-4" />
                              </a>
                            </Button>
                            <Button variant="ghost" size="icon" asChild>
                              <a href={doc.arquivo_url} download title="Download">
                                <Download className="h-4 w-4" />
                              </a>
                            </Button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground italic">
                          Nenhum contrato gerado e arquivado ainda.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isSignatureDialogOpen} onOpenChange={setIsSignatureDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assinatura do Paciente</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <SignaturePad
              onSave={(dataUrl) => {
                setPacienteSignature(dataUrl);
                setIsSignatureDialogOpen(false);
                toast.success("Assinatura capturada com sucesso!");
              }}
              initialValue={pacienteSignature || undefined}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Contratos;
