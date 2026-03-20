/**
 * usePatientForm
 *
 * Centralises all state, side-effects and handlers that were previously
 * scattered across 47 individual `useState` calls in PacienteForm.tsx.
 *
 * State is grouped into logical domain buckets so the component itself
 * becomes a pure rendering layer.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { toast } from "@/modules/shared/hooks/use-toast";
import { maskCPF, maskPhone, maskCEP, maskRG, isValidCPF, unmask } from "@/lib/masks";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";

// ── Grouped state shapes ───────────────────────────────────────────────────────

export interface PatientBasic {
  nome: string;
  cpf: string;
  rg: string;
  telefone: string;
  email: string;
  dataNascimento: string;
  fotoUrl: string;
  sexo: string;
  identidadeGenero: string;
  nomeSocial: string;
}

export interface PatientAddress {
  cep: string;
  rua: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
}

export interface PatientGuardian {
  temResponsavel: boolean;
  nome: string;
  cpf: string;
  rg: string;
  telefone: string;
  email: string;
  parentesco: string;
  endereco: string;
  cep: string;
  rua: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
}

export interface PatientInvoice {
  solicitaNf: boolean;
  razaoSocial: string;
  cnpjCpf: string;
  endereco: string;
  inscricaoEstadual: string;
  email: string;
}

export interface PatientClinical {
  tipoAtendimento: string;
  status: "ativo" | "inativo";
  observacoes: string;
  convenioId: string | null;
}

// ── Default values ─────────────────────────────────────────────────────────────

const defaultBasic: PatientBasic = {
  nome: "", cpf: "", rg: "", telefone: "", email: "",
  dataNascimento: "", fotoUrl: "", sexo: "", identidadeGenero: "", nomeSocial: "",
};

const defaultAddress: PatientAddress = {
  cep: "", rua: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "",
};

const defaultGuardian: PatientGuardian = {
  temResponsavel: false, nome: "", cpf: "", rg: "", telefone: "", email: "",
  parentesco: "", endereco: "", cep: "", rua: "", numero: "", complemento: "",
  bairro: "", cidade: "", estado: "",
};

const defaultInvoice: PatientInvoice = {
  solicitaNf: false, razaoSocial: "", cnpjCpf: "", endereco: "", inscricaoEstadual: "", email: "",
};

const defaultClinical: PatientClinical = {
  tipoAtendimento: "", status: "ativo", observacoes: "", convenioId: null,
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function generateAccessCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function usePatientForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { activeClinicId } = useClinic();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEditing = !!id;

  // ── Grouped state ──────────────────────────────────────────────────────────
  const [basic, setBasic] = useState<PatientBasic>(defaultBasic);
  const [address, setAddress] = useState<PatientAddress>(defaultAddress);
  const [guardian, setGuardian] = useState<PatientGuardian>(defaultGuardian);
  const [invoice, setInvoice] = useState<PatientInvoice>(defaultInvoice);
  const [clinical, setClinical] = useState<PatientClinical>(defaultClinical);

  const [lgpdConsentimento, setLgpdConsentimento] = useState(false);
  const [codigoAcesso, setCodigoAcesso] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // ── Reference data queries ─────────────────────────────────────────────────
  const { data: modalidades = [] } = useQuery({
    queryKey: ["modalidades-ativas"],
    queryFn: async () => {
      const { data } = await supabase.from("modalidades").select("id, nome").eq("ativo", true).order("nome");
      return data ?? [];
    },
  });

  const { data: convenios = [] } = useQuery({
    queryKey: ["convenios-ativos"],
    queryFn: async () => {
      const { data } = await supabase.from("convenios").select("id, nome").eq("ativo", true).order("nome");
      return data ?? [];
    },
  });

  // ── Load existing patient ─────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    setLoadingData(true);
    supabase.from("pacientes").select("*").eq("id", id).single()
      .then(({ data, error }) => {
        if (error || !data) {
          toast({ title: "Paciente não encontrado", variant: "destructive" });
          navigate("/pacientes");
          return;
        }
        setBasic({
          nome: data.nome,
          cpf: data.cpf || "",
          rg: data.rg || "",
          telefone: data.telefone || "",
          email: data.email || "",
          dataNascimento: data.data_nascimento || "",
          fotoUrl: data.foto_url || "",
          sexo: data.sexo || "",
          identidadeGenero: data.identidade_genero || "",
          nomeSocial: data.nome_social || "",
        });
        setAddress({
          cep: data.cep || "",
          rua: data.rua || "",
          numero: data.numero || "",
          complemento: data.complemento || "",
          bairro: data.bairro || "",
          cidade: data.cidade || "",
          estado: data.estado || "",
        });
        setGuardian({
          temResponsavel: data.tem_responsavel_legal || false,
          nome: data.responsavel_nome || "",
          cpf: data.responsavel_cpf || "",
          rg: data.responsavel_rg || "",
          telefone: data.responsavel_telefone || "",
          email: data.responsavel_email || "",
          parentesco: data.responsavel_parentesco || "",
          endereco: data.responsavel_endereco || "",
          cep: data.responsavel_cep || "",
          rua: data.responsavel_rua || "",
          numero: data.responsavel_numero || "",
          complemento: data.responsavel_complemento || "",
          bairro: data.responsavel_bairro || "",
          cidade: data.responsavel_cidade || "",
          estado: data.responsavel_estado || "",
        });
        setClinical({
          tipoAtendimento: data.tipo_atendimento,
          status: data.status,
          observacoes: data.observacoes || "",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          convenioId: (data as any).convenio_id || null,
        });
        setInvoice({
          solicitaNf: data.solicita_nf || false,
          razaoSocial: data.nf_razao_social || "",
          cnpjCpf: data.nf_cnpj_cpf || "",
          endereco: data.nf_endereco || "",
          inscricaoEstadual: data.nf_inscricao_estadual || "",
          email: data.nf_email || "",
        });
        setCodigoAcesso(data.codigo_acesso || null);
        setLgpdConsentimento(data.lgpd_consentimento || false);
        setLoadingData(false);
      });
  }, [id, navigate]);

  // ── CEP lookup ─────────────────────────────────────────────────────────────
  const fetchAddressFor = useCallback(async (
    cepCode: string,
    target: "paciente" | "responsavel"
  ) => {
    const cleanCep = cepCode.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await res.json();
      if (data.erro) {
        toast({ title: "CEP não encontrado", variant: "destructive" });
        return;
      }
      if (target === "paciente") {
        setAddress((prev) => ({
          ...prev,
          rua: data.logradouro || "",
          bairro: data.bairro || "",
          cidade: data.localidade || "",
          estado: data.uf || "",
        }));
      } else {
        setGuardian((prev) => ({
          ...prev,
          rua: data.logradouro || "",
          bairro: data.bairro || "",
          cidade: data.localidade || "",
          estado: data.uf || "",
        }));
      }
    } catch (err) {
      console.error("Erro ao buscar CEP", err);
      toast({ title: "Erro ao buscar endereço", variant: "destructive" });
    }
  }, []);

  // ── Photo upload ───────────────────────────────────────────────────────────
  const handlePhotoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Selecione uma imagem válida", variant: "destructive" });
      return;
    }
    setUploadingPhoto(true);
    const ext = file.name.split(".").pop();
    const path = `pacientes/${id || generateUUID()}/foto.${ext}`;
    const { error } = await supabase.storage.from("clinic-uploads").upload(path, file, { upsert: true });
    if (error) {
      toast({ title: "Erro ao enviar foto", description: error.message, variant: "destructive" });
    } else {
      const { data: urlData } = supabase.storage.from("clinic-uploads").getPublicUrl(path);
      setBasic((prev) => ({ ...prev, fotoUrl: urlData.publicUrl }));
      toast({ title: "Foto enviada! 📸" });
    }
    setUploadingPhoto(false);
  }, [id]);

  // ── Copy address to guardian ───────────────────────────────────────────────
  const copyAddressToGuardian = useCallback(() => {
    setGuardian((prev) => ({
      ...prev,
      cep: address.cep,
      rua: address.rua,
      numero: address.numero,
      complemento: address.complemento,
      bairro: address.bairro,
      cidade: address.cidade,
      estado: address.estado,
    }));
    toast({ title: "Endereço copiado! 📋" });
  }, [address]);

  // ── Generate invite link ───────────────────────────────────────────────────
  const generateInviteLink = useCallback(async () => {
    if (!id) return;
    let accessCode = codigoAcesso;
    if (!accessCode) {
      const { data } = await supabase.from("pacientes").select("codigo_acesso").eq("id", id).single();
      if (data?.codigo_acesso) {
        accessCode = data.codigo_acesso;
        setCodigoAcesso(data.codigo_acesso);
      }
    }
    if (!accessCode) {
      toast({ title: "Código não encontrado", variant: "destructive" });
      return;
    }
    const accessLink = `${window.location.origin}/paciente-access`;
    const inviteMessage = `Olá ${basic.nome.split(" ")[0]}! 👋\n\nVocê foi cadastrado(a) em nosso sistema Essencial FisioPilates. Para acessar sua área de atendimento, use o código abaixo:\n\n📱 CÓDIGO DE ACESSO: ${accessCode}\n\n🔗 Link: ${accessLink}\n\nSimplemente acesse o link acima e insira seu código de acesso.\n\nQualquer dúvida, entre em contato conosco! 😊`;
    navigator.clipboard.writeText(inviteMessage)
      .then(() => toast({ title: "Convite Copiado! ✓", description: "O convite com código foi copiado para a área de transferência." }))
      .catch(() => toast({ title: "Erro ao copiar o convite.", variant: "destructive" }));
  }, [id, codigoAcesso, basic.nome]);

  // ── Form submit ────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;

    const rawCpf = unmask(basic.cpf);
    if (rawCpf.length > 0) {
      if (!isValidCPF(rawCpf)) {
        toast({ title: "CPF inválido", description: "O CPF do paciente não é válido. Verifique os dígitos.", variant: "destructive" });
        return;
      }
      const { data: existingPatient } = await supabase.from("pacientes").select("id, nome").eq("cpf", basic.cpf);
      const dupPatient = (existingPatient ?? []).filter((p: { id: string }) => !isEditing || p.id !== id);
      if (dupPatient.length > 0) {
        toast({ title: "CPF já cadastrado", description: `Este CPF já pertence ao paciente: ${(dupPatient[0] as { nome: string }).nome}`, variant: "destructive" });
        return;
      }
    }

    if (guardian.temResponsavel) {
      const rawRespCpf = unmask(guardian.cpf);
      if (rawRespCpf.length > 0 && !isValidCPF(rawRespCpf)) {
        toast({ title: "CPF do responsável inválido", description: "O CPF do responsável não é válido. Verifique os dígitos.", variant: "destructive" });
        return;
      }
    }

    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        nome: basic.nome, cpf: basic.cpf || null, rg: basic.rg || null,
        telefone: basic.telefone || null, email: basic.email || null,
        data_nascimento: basic.dataNascimento || null, foto_url: basic.fotoUrl || null,
        sexo: basic.sexo || null, identidade_genero: basic.identidadeGenero || null,
        nome_social: basic.nomeSocial || null,
        cep: address.cep || null, rua: address.rua || null, numero: address.numero || null,
        complemento: address.complemento || null, bairro: address.bairro || null,
        cidade: address.cidade || null, estado: address.estado || null,
        tipo_atendimento: clinical.tipoAtendimento, status: clinical.status,
        observacoes: clinical.observacoes || null,
        tem_responsavel_legal: guardian.temResponsavel,
        responsavel_nome: guardian.temResponsavel ? guardian.nome || null : null,
        responsavel_cpf: guardian.temResponsavel ? guardian.cpf || null : null,
        responsavel_rg: guardian.temResponsavel ? guardian.rg || null : null,
        responsavel_telefone: guardian.temResponsavel ? guardian.telefone || null : null,
        responsavel_email: guardian.temResponsavel ? guardian.email || null : null,
        responsavel_parentesco: guardian.temResponsavel ? guardian.parentesco || null : null,
        responsavel_endereco: guardian.temResponsavel ? guardian.endereco || null : null,
        responsavel_cep: guardian.temResponsavel ? guardian.cep || null : null,
        responsavel_rua: guardian.temResponsavel ? guardian.rua || null : null,
        responsavel_numero: guardian.temResponsavel ? guardian.numero || null : null,
        responsavel_complemento: guardian.temResponsavel ? guardian.complemento || null : null,
        responsavel_bairro: guardian.temResponsavel ? guardian.bairro || null : null,
        responsavel_cidade: guardian.temResponsavel ? guardian.cidade || null : null,
        responsavel_estado: guardian.temResponsavel ? guardian.estado || null : null,
        solicita_nf: invoice.solicitaNf,
        nf_razao_social: invoice.solicitaNf ? invoice.razaoSocial || null : null,
        nf_cnpj_cpf: invoice.solicitaNf ? invoice.cnpjCpf || null : null,
        nf_endereco: invoice.solicitaNf ? invoice.endereco || null : null,
        nf_inscricao_estadual: invoice.solicitaNf ? invoice.inscricaoEstadual || null : null,
        nf_email: invoice.solicitaNf ? invoice.email || null : null,
        lgpd_consentimento: lgpdConsentimento,
        lgpd_consentimento_data: lgpdConsentimento ? new Date().toISOString() : null,
        convenio_id: clinical.convenioId || null,
      };

      let savedPatientId = id;

      if (isEditing) {
        const { error } = await supabase.from("pacientes").update(payload).eq("id", id);
        if (error) throw error;
        toast({ title: "Paciente atualizado com sucesso!" });
      } else {
        const accessCode = generateAccessCode();
        const insertData = { ...payload, created_by: user.id, profissional_id: user.id, codigo_acesso: accessCode };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await supabase.from("pacientes").insert([insertData as any]).select("id").single();
        if (error) throw error;
        if (!data) throw new Error("Erro ao criar paciente");
        savedPatientId = data.id;
        setCodigoAcesso(accessCode);

        const accessLink = `${window.location.origin}/paciente-access`;
        const inviteMessage = `Olá ${basic.nome.split(" ")[0]}!\n\nVocê foi cadastrado em nosso sistema. Para acessar, use o código:\n\nCÓDIGO: ${accessCode}\n\nLink: ${accessLink}\n\nQualquer dúvida, entre em contato!`;
        toast({
          title: "Paciente cadastrado com sucesso!",
          description: "Código de acesso gerado. Clique para copiar.",
          action: (
            <Button variant="outline" size="sm" onClick={() => {
              navigator.clipboard.writeText(inviteMessage);
              toast({ title: "Convite copiado!" });
            }}>
              <Copy className="h-4 w-4 mr-2" /> Copiar
            </Button>
          ),
          duration: 10000,
        });

        if (activeClinicId && savedPatientId) {
          await supabase.from("clinic_pacientes").insert({ clinic_id: activeClinicId, paciente_id: savedPatientId });
        }
      }

      if (basic.cpf && basic.cpf.replace(/\D/g, "").length === 11) {
        try {
          await supabase.functions.invoke("create-patient-account", { body: { cpf: basic.cpf, nome: basic.nome, paciente_id: savedPatientId } });
        } catch (err) {
          console.error("Erro ao criar conta do paciente:", err);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["pacientes"] });
      navigate("/pacientes");
    } catch (err: unknown) {
      const errorMessage = (err as Error)?.message || "Erro ao salvar paciente";
      toast({ title: "Erro ao salvar", description: errorMessage, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user, basic, address, guardian, invoice, clinical, lgpdConsentimento, id, isEditing, activeClinicId, queryClient, navigate]);

  // ── Mask setters (convenience wrappers) ────────────────────────────────────
  const setBasicField = useCallback(<K extends keyof PatientBasic>(field: K, value: PatientBasic[K]) => {
    setBasic((prev) => ({ ...prev, [field]: value }));
  }, []);

  const setAddressField = useCallback(<K extends keyof PatientAddress>(field: K, value: PatientAddress[K]) => {
    setAddress((prev) => ({ ...prev, [field]: value }));
  }, []);

  const setGuardianField = useCallback(<K extends keyof PatientGuardian>(field: K, value: PatientGuardian[K]) => {
    setGuardian((prev) => ({ ...prev, [field]: value }));
  }, []);

  const setInvoiceField = useCallback(<K extends keyof PatientInvoice>(field: K, value: PatientInvoice[K]) => {
    setInvoice((prev) => ({ ...prev, [field]: value }));
  }, []);

  const setClinicalField = useCallback(<K extends keyof PatientClinical>(field: K, value: PatientClinical[K]) => {
    setClinical((prev) => ({ ...prev, [field]: value }));
  }, []);

  return {
    // Identifiers
    id,
    isEditing,
    // Grouped state
    basic, setBasicField,
    address, setAddressField,
    guardian, setGuardian, setGuardianField,
    invoice, setInvoiceField,
    clinical, setClinicalField,
    // Flags
    lgpdConsentimento, setLgpdConsentimento,
    codigoAcesso,
    // Meta
    loading, loadingData, uploadingPhoto,
    // Refs
    fileInputRef,
    // Reference data
    modalidades, convenios,
    // Handlers
    handleSubmit,
    handlePhotoUpload,
    fetchAddressFor,
    copyAddressToGuardian,
    generateInviteLink,
    // Mask helpers (pre-applied)
    maskCPF, maskPhone, maskCEP, maskRG,
  };
}
