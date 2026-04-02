/**
 * PatientFormBuilder.tsx
 *
 * Unified patient-data collection component used by three flows:
 *   1. PacienteForm (staff create/edit)
 *   2. PatientOnboarding (post-signup wizard)
 *   3. PreCadastro (anonymous self-registration)
 *
 * Each flow passes a `mode` prop that controls which fields, steps and
 * buttons are rendered so all logic lives in one place.
 */
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, ChevronLeft, ChevronRight, User, MapPin, UserCheck, FileText } from "lucide-react";
import { maskCPF, maskPhone, maskCEP, maskRG } from "@/lib/masks";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PatientFormMode = "staff" | "onboarding" | "pre-cadastro";

export interface PatientFormData {
  // Personal
  nome: string;
  cpf: string;
  rg: string;
  email: string;
  telefone: string;
  dataNascimento: string;
  sexo: string;
  // Address
  cep: string;
  rua: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  // Guardian (optional)
  temResponsavel: boolean;
  responsavelNome: string;
  responsavelCpf: string;
  responsavelTelefone: string;
  responsavelEmail: string;
  responsavelParentesco: string;
  // Notes
  observacoes: string;
  // Onboarding-only
  senha?: string;
  confirmSenha?: string;
}

export interface PatientFormStep {
  id: string;
  label: string;
  icon: React.ReactNode;
  fields: (keyof PatientFormData)[];
}

export interface PatientFormBuilderProps {
  mode: PatientFormMode;
  initialData?: Partial<PatientFormData>;
  onSubmit: (data: PatientFormData) => Promise<void> | void;
  onCancel?: () => void;
  loading?: boolean;
  /** When true the form renders all steps on one page (no progress wizard). */
  singlePage?: boolean;
}

// ─── Default / initial state ──────────────────────────────────────────────────

const emptyForm = (): PatientFormData => ({
  nome: "",
  cpf: "",
  rg: "",
  email: "",
  telefone: "",
  dataNascimento: "",
  sexo: "",
  cep: "",
  rua: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  estado: "",
  temResponsavel: false,
  responsavelNome: "",
  responsavelCpf: "",
  responsavelTelefone: "",
  responsavelEmail: "",
  responsavelParentesco: "",
  observacoes: "",
  senha: "",
  confirmSenha: "",
});

// ─── Step definitions ─────────────────────────────────────────────────────────

const STEPS: PatientFormStep[] = [
  {
    id: "personal",
    label: "Dados Pessoais",
    icon: <User className="h-4 w-4" />,
    fields: ["nome", "cpf", "rg", "email", "telefone", "dataNascimento", "sexo"],
  },
  {
    id: "address",
    label: "Endereço",
    icon: <MapPin className="h-4 w-4" />,
    fields: ["cep", "rua", "numero", "complemento", "bairro", "cidade", "estado"],
  },
  {
    id: "guardian",
    label: "Responsável",
    icon: <UserCheck className="h-4 w-4" />,
    fields: [
      "temResponsavel",
      "responsavelNome",
      "responsavelCpf",
      "responsavelTelefone",
      "responsavelEmail",
      "responsavelParentesco",
    ],
  },
  {
    id: "notes",
    label: "Observações",
    icon: <FileText className="h-4 w-4" />,
    fields: ["observacoes"],
  },
];

// Steps shown in each mode
const MODE_STEPS: Record<PatientFormMode, string[]> = {
  staff: ["personal", "address", "guardian", "notes"],
  onboarding: ["personal"],
  "pre-cadastro": ["personal", "address", "guardian"],
};

// ─── Address lookup ───────────────────────────────────────────────────────────

async function fetchAddressByCep(
  cep: string,
  setter: (partial: Partial<PatientFormData>) => void,
) {
  const clean = cep.replace(/\D/g, "");
  if (clean.length !== 8) return;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
    const data = await res.json();
    if (!data.erro) {
      setter({
        rua: data.logradouro || "",
        bairro: data.bairro || "",
        cidade: data.localidade || "",
        estado: data.uf || "",
      });
    }
  } catch {
    /* ignore – user can still type manually */
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PatientFormBuilder({
  mode,
  initialData = {},
  onSubmit,
  onCancel,
  loading = false,
  singlePage = false,
}: PatientFormBuilderProps) {
  const [data, setData] = useState<PatientFormData>({ ...emptyForm(), ...initialData });
  const [currentStep, setCurrentStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const activeStepIds = MODE_STEPS[mode];
  const steps = STEPS.filter((s) => activeStepIds.includes(s.id));
  const totalSteps = steps.length;
  const progress = singlePage ? 100 : Math.round(((currentStep + 1) / totalSteps) * 100);

  const set = (field: keyof PatientFormData, value: string | boolean) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  const setPartial = (partial: Partial<PatientFormData>) => {
    setData((prev) => ({ ...prev, ...partial }));
  };

  const handleNext = () => {
    if (currentStep < totalSteps - 1) setCurrentStep((s) => s + 1);
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(data);
    if (mode === "pre-cadastro") setSubmitted(true);
  };

  if (submitted && mode === "pre-cadastro") {
    return (
      <Card className="max-w-lg mx-auto mt-12 text-center">
        <CardContent className="pt-10 pb-8 flex flex-col items-center gap-4">
          <CheckCircle2 className="h-16 w-16 text-green-500" />
          <h2 className="text-2xl font-bold">Pré-cadastro enviado!</h2>
          <p className="text-muted-foreground">
            Nossa equipe entrará em contato em breve para confirmar seu cadastro.
          </p>
        </CardContent>
      </Card>
    );
  }

  const renderStep = (stepId: string) => {
    switch (stepId) {
      case "personal":
        return <PersonalFields data={data} set={set} mode={mode} />;
      case "address":
        return <AddressFields data={data} set={set} setPartial={setPartial} />;
      case "guardian":
        return <GuardianFields data={data} set={set} />;
      case "notes":
        return <NotesFields data={data} set={set} />;
      default:
        return null;
    }
  };

  if (singlePage) {
    return (
      <form onSubmit={handleSubmit} className="space-y-6">
        {steps.map((step) => (
          <Card key={step.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                {step.icon}
                {step.label}
              </CardTitle>
            </CardHeader>
            <CardContent>{renderStep(step.id)}</CardContent>
          </Card>
        ))}
        <FormActions
          mode={mode}
          loading={loading}
          onCancel={onCancel}
          isFirstStep={true}
          isLastStep={true}
          onBack={() => {}}
          onNext={() => {}}
          singlePage
        />
      </form>
    );
  }

  const step = steps[currentStep];

  return (
    <form onSubmit={currentStep < totalSteps - 1 ? (e) => { e.preventDefault(); handleNext(); } : handleSubmit} className="space-y-6">
      {/* Progress */}
      {totalSteps > 1 && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>
              Etapa {currentStep + 1} de {totalSteps}: {step.label}
            </span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="flex gap-2 mt-1">
            {steps.map((s, idx) => (
              <div
                key={s.id}
                className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${
                  idx === currentStep
                    ? "bg-primary text-primary-foreground border-primary"
                    : idx < currentStep
                    ? "bg-green-100 text-green-700 border-green-300"
                    : "text-muted-foreground border-muted"
                }`}
              >
                {s.icon}
                {s.label}
              </div>
            ))}
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            {step.icon}
            {step.label}
          </CardTitle>
          {mode === "onboarding" && (
            <CardDescription>
              Complete seu cadastro para acessar o portal do paciente.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>{renderStep(step.id)}</CardContent>
      </Card>

      <FormActions
        mode={mode}
        loading={loading}
        onCancel={onCancel}
        isFirstStep={currentStep === 0}
        isLastStep={currentStep === totalSteps - 1}
        onBack={handleBack}
        onNext={handleNext}
      />
    </form>
  );
}

// ─── Field groups ─────────────────────────────────────────────────────────────

function PersonalFields({
  data,
  set,
  mode,
}: {
  data: PatientFormData;
  set: (f: keyof PatientFormData, v: string | boolean) => void;
  mode: PatientFormMode;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="sm:col-span-2 space-y-1.5">
        <Label htmlFor="nome">Nome completo *</Label>
        <Input
          id="nome"
          value={data.nome}
          onChange={(e) => set("nome", e.target.value)}
          required
          minLength={3}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cpf">CPF</Label>
        <Input
          id="cpf"
          value={data.cpf}
          onChange={(e) => set("cpf", maskCPF(e.target.value))}
          placeholder="000.000.000-00"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="rg">RG</Label>
        <Input
          id="rg"
          value={data.rg}
          onChange={(e) => set("rg", maskRG(e.target.value))}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          type="email"
          value={data.email}
          onChange={(e) => set("email", e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="telefone">Telefone *</Label>
        <Input
          id="telefone"
          value={data.telefone}
          onChange={(e) => set("telefone", maskPhone(e.target.value))}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="dataNascimento">Data de nascimento</Label>
        <Input
          id="dataNascimento"
          type="date"
          value={data.dataNascimento}
          onChange={(e) => set("dataNascimento", e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sexo">Sexo</Label>
        <select
          id="sexo"
          value={data.sexo}
          onChange={(e) => set("sexo", e.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
        >
          <option value="">Selecione</option>
          <option value="masculino">Masculino</option>
          <option value="feminino">Feminino</option>
          <option value="outro">Outro</option>
          <option value="nao_informado">Prefiro não informar</option>
        </select>
      </div>
      {mode === "onboarding" && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="senha">Senha *</Label>
            <Input
              id="senha"
              type="password"
              value={data.senha ?? ""}
              onChange={(e) => set("senha", e.target.value)}
              required
              minLength={6}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirmSenha">Confirmar senha *</Label>
            <Input
              id="confirmSenha"
              type="password"
              value={data.confirmSenha ?? ""}
              onChange={(e) => set("confirmSenha", e.target.value)}
              required
            />
          </div>
        </>
      )}
    </div>
  );
}

function AddressFields({
  data,
  set,
  setPartial,
}: {
  data: PatientFormData;
  set: (f: keyof PatientFormData, v: string | boolean) => void;
  setPartial: (p: Partial<PatientFormData>) => void;
}) {
  const handleCepBlur = () => fetchAddressByCep(data.cep, setPartial);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="space-y-1.5">
        <Label htmlFor="cep">CEP</Label>
        <Input
          id="cep"
          value={data.cep}
          onChange={(e) => set("cep", maskCEP(e.target.value))}
          onBlur={handleCepBlur}
          placeholder="00000-000"
        />
      </div>
      <div className="sm:col-span-2 space-y-1.5">
        <Label htmlFor="rua">Rua / Logradouro</Label>
        <Input
          id="rua"
          value={data.rua}
          onChange={(e) => set("rua", e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="numero">Número</Label>
        <Input
          id="numero"
          value={data.numero}
          onChange={(e) => set("numero", e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="complemento">Complemento</Label>
        <Input
          id="complemento"
          value={data.complemento}
          onChange={(e) => set("complemento", e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="bairro">Bairro</Label>
        <Input
          id="bairro"
          value={data.bairro}
          onChange={(e) => set("bairro", e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cidade">Cidade</Label>
        <Input
          id="cidade"
          value={data.cidade}
          onChange={(e) => set("cidade", e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="estado">Estado</Label>
        <Input
          id="estado"
          value={data.estado}
          onChange={(e) => set("estado", e.target.value)}
          maxLength={2}
        />
      </div>
    </div>
  );
}

function GuardianFields({
  data,
  set,
}: {
  data: PatientFormData;
  set: (f: keyof PatientFormData, v: string | boolean) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Switch
          id="temResponsavel"
          checked={data.temResponsavel}
          onCheckedChange={(v) => set("temResponsavel", v)}
        />
        <Label htmlFor="temResponsavel">Possui responsável legal</Label>
      </div>
      {data.temResponsavel && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="responsavelNome">Nome do responsável *</Label>
            <Input
              id="responsavelNome"
              value={data.responsavelNome}
              onChange={(e) => set("responsavelNome", e.target.value)}
              required={data.temResponsavel}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="responsavelCpf">CPF do responsável</Label>
            <Input
              id="responsavelCpf"
              value={data.responsavelCpf}
              onChange={(e) => set("responsavelCpf", maskCPF(e.target.value))}
              placeholder="000.000.000-00"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="responsavelTelefone">Telefone do responsável</Label>
            <Input
              id="responsavelTelefone"
              value={data.responsavelTelefone}
              onChange={(e) => set("responsavelTelefone", maskPhone(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="responsavelEmail">E-mail do responsável</Label>
            <Input
              id="responsavelEmail"
              type="email"
              value={data.responsavelEmail}
              onChange={(e) => set("responsavelEmail", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="responsavelParentesco">Parentesco</Label>
            <Input
              id="responsavelParentesco"
              value={data.responsavelParentesco}
              onChange={(e) => set("responsavelParentesco", e.target.value)}
              placeholder="Ex: mãe, pai, cônjuge"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function NotesFields({
  data,
  set,
}: {
  data: PatientFormData;
  set: (f: keyof PatientFormData, v: string | boolean) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="observacoes">Observações</Label>
      <Textarea
        id="observacoes"
        value={data.observacoes}
        onChange={(e) => set("observacoes", e.target.value)}
        rows={4}
        placeholder="Informações adicionais, condições especiais, alergias…"
      />
    </div>
  );
}

// ─── Action bar ───────────────────────────────────────────────────────────────

function FormActions({
  mode,
  loading,
  onCancel,
  isFirstStep,
  isLastStep,
  onBack,
  onNext,
  singlePage = false,
}: {
  mode: PatientFormMode;
  loading: boolean;
  onCancel?: () => void;
  isFirstStep: boolean;
  isLastStep: boolean;
  onBack: () => void;
  onNext: () => void;
  singlePage?: boolean;
}) {
  const submitLabel =
    mode === "pre-cadastro" ? "Enviar pré-cadastro" :
    mode === "onboarding" ? "Concluir cadastro" :
    "Salvar";

  return (
    <div className="flex items-center justify-between gap-2 pt-2">
      <div>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
        )}
      </div>
      <div className="flex gap-2">
        {!isFirstStep && !singlePage && (
          <Button type="button" variant="outline" onClick={onBack} disabled={loading}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Anterior
          </Button>
        )}
        {isLastStep || singlePage ? (
          <Button type="submit" disabled={loading}>
            {loading ? "Salvando…" : submitLabel}
          </Button>
        ) : (
          <Button type="submit" disabled={loading}>
            Próximo
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}
