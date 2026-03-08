import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Building2, Users, Layers } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

const STEPS = [
  { icon: Building2, title: "Dados da Clínica", desc: "Configure o nome e contato da sua clínica" },
  { icon: Layers, title: "Modalidades", desc: "Defina os tipos de atendimento oferecidos" },
  { icon: Users, title: "Profissionais", desc: "Cadastre os profissionais da equipe" },
];

export function AdminOnboardingWizard() {
  const { user, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [clinicName, setClinicName] = useState("");
  const [clinicPhone, setClinicPhone] = useState("");
  const [modalidade, setModalidade] = useState("");
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (!isAdmin || !user) return;
    const dismissed = localStorage.getItem("onboarding-dismissed");
    if (dismissed) return;

    const check = async () => {
      const { data } = await supabase.from("clinic_settings").select("nome").limit(1);
      if (!data?.length || !data[0].nome) {
        setOpen(true);
      }
    };
    check();
  }, [isAdmin, user]);

  const handleSaveClinic = async () => {
    if (!clinicName.trim()) return;
    const { data: existing } = await supabase.from("clinic_settings").select("id").limit(1);
    if (existing?.length) {
      await supabase.from("clinic_settings").update({ nome: clinicName, telefone: clinicPhone }).eq("id", existing[0].id);
    } else {
      await supabase.from("clinic_settings").insert({ nome: clinicName, telefone: clinicPhone });
    }
    toast({ title: "Clínica configurada! ✅" });
    setStep(1);
  };

  const handleSaveModalidade = async () => {
    if (!modalidade.trim()) { setStep(2); return; }
    await supabase.from("modalidades").insert({ nome: modalidade, created_by: user!.id });
    toast({ title: "Modalidade criada! ✅" });
    setStep(2);
  };

  const handleFinish = () => {
    setCompleted(true);
    localStorage.setItem("onboarding-dismissed", "true");
    setTimeout(() => setOpen(false), 1500);
  };

  const handleDismiss = () => {
    localStorage.setItem("onboarding-dismissed", "true");
    setOpen(false);
  };

  if (!isAdmin) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {completed ? (
              <><CheckCircle2 className="h-5 w-5 text-green-500" /> Tudo pronto!</>
            ) : (
              <>
                {(() => { const Icon = STEPS[step].icon; return <Icon className="h-5 w-5 text-primary" />; })()}
                {STEPS[step].title}
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {completed ? "Sua clínica está configurada. Bom trabalho!" : STEPS[step].desc}
          </DialogDescription>
        </DialogHeader>

        {/* Progress */}
        <div className="flex gap-2 mb-4">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>

        {!completed && step === 0 && (
          <div className="space-y-4">
            <div>
              <Label>Nome da clínica *</Label>
              <Input value={clinicName} onChange={(e) => setClinicName(e.target.value)} placeholder="Ex: Clínica Viver Bem" />
            </div>
            <div>
              <Label>Telefone / WhatsApp</Label>
              <Input value={clinicPhone} onChange={(e) => setClinicPhone(e.target.value)} placeholder="(11) 99999-9999" />
            </div>
          </div>
        )}

        {!completed && step === 1 && (
          <div className="space-y-4">
            <div>
              <Label>Adicionar uma modalidade (opcional)</Label>
              <Input value={modalidade} onChange={(e) => setModalidade(e.target.value)} placeholder="Ex: Pilates, Fisioterapia, RPG..." />
            </div>
            <p className="text-xs text-muted-foreground">Você pode adicionar mais modalidades depois em Configurações.</p>
          </div>
        )}

        {!completed && step === 2 && (
          <div className="space-y-3 text-center py-4">
            <Users className="h-12 w-12 mx-auto text-primary/60" />
            <p className="text-sm text-muted-foreground">
              Para cadastrar profissionais, vá até <strong>Profissionais → Novo Profissional</strong> no menu lateral.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2">
          {!completed && (
            <Button variant="ghost" size="sm" onClick={handleDismiss}>
              Pular
            </Button>
          )}
          {!completed && step === 0 && (
            <Button onClick={handleSaveClinic} disabled={!clinicName.trim()}>Próximo</Button>
          )}
          {!completed && step === 1 && (
            <Button onClick={handleSaveModalidade}>{modalidade.trim() ? "Salvar e próximo" : "Próximo"}</Button>
          )}
          {!completed && step === 2 && (
            <Button onClick={handleFinish}>Concluir</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
