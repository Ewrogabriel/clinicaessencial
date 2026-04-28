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
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Pré-visualização</CardTitle>
                {canManage && (
                  <Link to="/modelos-contrato" className="text-xs text-primary hover:underline flex items-center gap-1">
                    <FileText className="h-3 w-3" /> Editar modelo
                  </Link>
                )}
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none text-foreground space-y-3 text-sm border rounded-lg p-6 bg-card max-h-[70vh] overflow-y-auto">
                  {contractTemplates?.paciente ? (
                    <div className="whitespace-pre-wrap font-serif leading-relaxed">
                      {renderContractTemplate(contractTemplates.paciente, {
                        clinic: clinicSettings,
                        clinicSettings,
                        paciente,
                        plano,
                        valorFinal,
                        taxaMatricula: Number(overrideEnrollmentFee) || 0,
                        formaPagamento: overridePaymentMethod || "Pix",
                      })}
                    </div>
                  ) : (
                  <>
                  <h2 className="text-center font-bold text-lg">{clinicNome.toUpperCase()}</h2>
                  <h3 className="text-center font-bold">CONTRATO DE PRESTAÇÃO DE SERVIÇOS</h3>
                  <p><strong>CONTRATADA:</strong> {clinicNome}{clinicCNPJ ? `, CNPJ ${clinicCNPJ}` : ""}{clinicEnderecoFull ? `, com sede à ${clinicEnderecoFull}` : ""}.</p>
                  <p><strong>CONTRATANTE:</strong> {paciente?.nome || "___________________"}{paciente?.cpf ? `, CPF ${paciente.cpf}` : ""}{paciente?.rg ? `, RG ${paciente.rg}` : ""}.</p>

                  <h4 className="font-bold border-b pb-1">CLÁUSULA 1ª – DO OBJETO</h4>
                  <p>O presente contrato tem por objeto a prestação de serviços de {plano?.modalidade || "atendimento"}, conforme plano contratado: <strong>{plano?.nome || "a definir"}</strong>, com frequência de {plano?.frequencia_semanal || 1}x por semana.</p>

                  <h4 className="font-bold border-b pb-1">CLÁUSULA 2ª – DA VIGÊNCIA</h4>
                  <p>Este contrato vigorará pelo prazo de {paciente?.contract_vigencia_meses ?? clinicSettings?.pref_contract_vigencia_meses ?? 6} meses a contar da data de assinatura, renovando-se automaticamente por iguais períodos, salvo manifestação contrária por escrito de qualquer das partes com antecedência mínima de 30 dias.</p>

                  <h4 className="font-bold border-b pb-1">CLÁUSULA 3ª – DO PAGAMENTO</h4>
                  <p>O CONTRATANTE pagará à CONTRATADA o valor mensal de R$ {valorFinal.toFixed(2)}{Number(overrideEnrollmentFee) > 0 ? `, acrescido de taxa de matrícula de R$ ${Number(overrideEnrollmentFee).toFixed(2)}` : ""}, com vencimento todo dia {paciente?.contract_dia_vencimento ?? clinicSettings?.pref_contract_dia_vencimento ?? 10}, via {overridePaymentMethod || "Pix"}. O atraso ensejará multa de {paciente?.contract_multa_atraso_pct ?? clinicSettings?.pref_contract_multa_atraso_pct ?? 2}% e juros de {paciente?.contract_juros_mensal_pct ?? clinicSettings?.pref_contract_juros_mensal_pct ?? 1}% ao mês.</p>

                  <h4 className="font-bold border-b pb-1">CLÁUSULA 4ª – DAS FALTAS E REPOSIÇÕES</h4>
                  <p>O CONTRATANTE poderá cancelar uma sessão com antecedência mínima de {paciente?.contract_prazo_cancelamento_h ?? clinicSettings?.pref_contract_prazo_cancelamento_h ?? 3} horas, sendo a reposição garantida em até {paciente?.contract_prazo_reposicao_dias ?? clinicSettings?.pref_contract_prazo_reposicao_dias ?? 30} dias. Faltas sem aviso prévio não geram direito à reposição.</p>

                  <h4 className="font-bold border-b pb-1">CLÁUSULA 5ª – DAS OBRIGAÇÕES DA CONTRATADA</h4>
                  <p>Prestar os serviços com zelo, técnica e ética profissional, mantendo equipamentos e instalações adequadas, e respeitando o sigilo das informações do CONTRATANTE conforme a LGPD.</p>

                  <h4 className="font-bold border-b pb-1">CLÁUSULA 6ª – DAS OBRIGAÇÕES DO CONTRATANTE</h4>
                  <p>Comparecer pontualmente às sessões, informar quaisquer condições de saúde relevantes, seguir as orientações dos profissionais e efetuar os pagamentos nas datas acordadas.</p>

                  <h4 className="font-bold border-b pb-1">CLÁUSULA 7ª – DA RESCISÃO</h4>
                  <p>O contrato poderá ser rescindido por qualquer das partes mediante comunicação por escrito com antecedência mínima de 30 dias, ressalvado o pagamento das mensalidades vencidas até a efetiva rescisão.</p>

                  <h4 className="font-bold border-b pb-1">CLÁUSULA 8ª – DA PROTEÇÃO DE DADOS (LGPD)</h4>
                  <p>O CONTRATANTE autoriza o tratamento dos seus dados pessoais e de saúde para fins de prestação dos serviços, comunicação e cumprimento de obrigações legais, em conformidade com a Lei nº 13.709/2018.</p>

                  <h4 className="font-bold border-b pb-1">CLÁUSULA 9ª – DO FORO</h4>
                  <p>Fica eleito o foro da comarca de {paciente?.contract_cidade_foro ?? clinicSettings?.pref_contract_cidade_foro ?? clinicSettings?.cidade ?? "Barbacena"}/{paciente?.contract_estado_foro ?? clinicSettings?.pref_contract_estado_foro ?? clinicSettings?.estado ?? "MG"} para dirimir quaisquer controvérsias oriundas deste contrato.</p>

                  <p className="pt-3">{clinicSettings?.cidade || "_______________"}, {format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}.</p>
                  </>
                  )}

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
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Pré-visualização do Contrato</CardTitle>
                  {canManage && (
                    <Link to="/modelos-contrato" className="text-xs text-primary hover:underline flex items-center gap-1">
                      <FileText className="h-3 w-3" /> Editar modelo
                    </Link>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none text-foreground space-y-3 text-sm border rounded-lg p-6 bg-card max-h-[70vh] overflow-y-auto">
                    {contractTemplates?.profissional ? (
                      <div className="whitespace-pre-wrap font-serif leading-relaxed">
                        {renderContractTemplate(contractTemplates.profissional, {
                          clinic: clinicSettings,
                          clinicSettings,
                          profissional,
                        })}
                      </div>
                    ) : (
                    <>
                    <h2 className="text-center font-bold text-lg">{clinicNome.toUpperCase()}</h2>
                    <h3 className="text-center font-bold">CONTRATO DE PRESTAÇÃO DE SERVIÇOS PROFISSIONAIS</h3>
                    <p><strong>CLÍNICA (CONTRATANTE):</strong> {clinicNome}{clinicCNPJ ? `, CNPJ ${clinicCNPJ}` : ""}{clinicEnderecoFull ? `, sede ${clinicEnderecoFull}` : ""}.</p>
                    <p><strong>PROFISSIONAL (CONTRATADO):</strong> {profissional?.nome || "___________________"}{profissional?.cpf ? `, CPF ${profissional.cpf}` : ""}{profissional?.registro_profissional ? `, ${profissional?.conselho_profissional || "Conselho"} ${profissional.registro_profissional}` : ""}.</p>

                    <h4 className="font-bold border-b pb-1">CLÁUSULA 1ª – DO OBJETO</h4>
                    <p>Prestação de serviços profissionais autônomos pelo CONTRATADO em favor da CONTRATANTE, sem vínculo empregatício, observada a legislação do respectivo conselho de classe.</p>

                    <h4 className="font-bold border-b pb-1">CLÁUSULA 2ª – DA REMUNERAÇÃO</h4>
                    <p>Comissão de {profissional?.commission_rate || "___"}% sobre os valores efetivamente recebidos pela CONTRATANTE referentes aos atendimentos prestados pelo CONTRATADO. O pagamento será efetuado até o dia {profissional?.contract_dia_pagamento_comissao ?? clinicSettings?.pref_contract_dia_pagamento_comissao ?? 10} do mês subsequente.</p>

                    <h4 className="font-bold border-b pb-1">CLÁUSULA 3ª – DA NÃO CAPTAÇÃO DE CLIENTES</h4>
                    <p>Fica vedado ao CONTRATADO, durante a vigência deste contrato e por 12 (doze) meses após sua rescisão, atender clientes da CONTRATANTE em consultório próprio ou de terceiros num raio de {profissional?.contract_raio_nao_concorrencia_km ?? clinicSettings?.pref_contract_raio_nao_concorrencia_km ?? 5} km, sob pena de multa equivalente a {profissional?.contract_multa_nao_captacao_fator ?? clinicSettings?.pref_contract_multa_nao_captacao_fator ?? 10}x o valor mensal recebido pelo cliente captado.</p>

                    <h4 className="font-bold border-b pb-1">CLÁUSULA 4ª – DA RESCISÃO E AVISO PRÉVIO</h4>
                    <p>Qualquer das partes poderá rescindir o contrato mediante aviso prévio de {profissional?.contract_prazo_aviso_previo_dias ?? clinicSettings?.pref_contract_prazo_aviso_previo_dias ?? 30} dias, garantindo a continuidade dos atendimentos em curso.</p>

                    <h4 className="font-bold border-b pb-1">CLÁUSULA 5ª – DO USO DA MARCA</h4>
                    <p>O uso indevido da marca, logotipo ou imagem da CONTRATANTE pelo CONTRATADO acarretará multa de R$ {Number(profissional?.contract_multa_uso_marca_valor ?? clinicSettings?.pref_contract_multa_uso_marca_valor ?? 5000).toFixed(2)}, sem prejuízo de demais perdas e danos.</p>

                    <h4 className="font-bold border-b pb-1">CLÁUSULA 6ª – DA CONFIDENCIALIDADE</h4>
                    <p>O CONTRATADO compromete-se a manter sigilo absoluto sobre informações de pacientes, fluxos internos e dados estratégicos da CONTRATANTE, em conformidade com a LGPD.</p>

                    <h4 className="font-bold border-b pb-1">CLÁUSULA 7ª – DO FORO</h4>
                    <p>Fica eleito o foro da comarca de {clinicSettings?.pref_contract_cidade_foro || clinicSettings?.cidade || "Barbacena"}/{clinicSettings?.pref_contract_estado_foro || clinicSettings?.estado || "MG"}.</p>

                    <p className="pt-3">{clinicSettings?.cidade || "_______________"}, {format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}.</p>
                    </>
                    )}

                    <div className="mt-8 grid grid-cols-2 gap-8 text-center border-t pt-8">
                      <div>
                        <div className="h-12" />
                        <div className="border-t border-muted-foreground pt-2">CONTRATANTE<br/><span className="text-xs">{clinicNome}</span></div>
                      </div>
                      <div>
                        <div className="h-12" />
                        <div className="border-t border-muted-foreground pt-2">CONTRATADO<br/><span className="text-xs">{profissional?.nome || ""}</span></div>
                      </div>
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
