import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import type { Clinica, Profissional } from "@/types/helpers";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Building2, CreditCard, Crown, Link2, Plus, Users, AlertTriangle, Check, X,
  DollarSign, TrendingUp, Package, FileText, BookOpen,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { maskPhone, maskCNPJ, maskCEP } from "@/lib/masks";
import { ClinicDetailDialog } from "@/components/master/ClinicDetailDialog";
import { ALL_RESOURCES } from "@/lib/resources";
import { generateSubscriptionContractPDF } from "@/lib/generateSubscriptionContractPDF";
import { MasterMarketingTab } from "@/components/master/MasterMarketingTab";
import { ManualTab } from "@/components/master/ManualTab";
import { Rocket } from "lucide-react";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  ativa: "default",
  suspensa: "secondary",
  cancelada: "destructive",
  trial: "outline",
  pendente: "secondary",
  pago: "default",
  atrasado: "destructive",
};

// ─── Clinics Tab ────────────────────────────────────────────
function ClinicsTab() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedClinic, setSelectedClinic] = useState<Clinica | null>(null);
  const [form, setForm] = useState({
    nome: "", cnpj: "", endereco: "", numero: "", bairro: "", cidade: "", estado: "", cep: "",
    telefone: "", whatsapp: "", email: "", instagram: "",
    responsavel_nome: "", responsavel_email: "", responsavel_telefone: "",
    plan_id: "", observacoes: "",
    admin_nome: "", admin_email: "",
  });

  const { data: clinics = [], isLoading } = useQuery({
    queryKey: ["master-clinics"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clinicas")
        .select("id,nome,cnpj,email,telefone,whatsapp,endereco,numero,bairro,cidade,estado,cep,instagram,ativo,created_at,updated_at")
        .order("nome");
      return (data as Clinica[]) || [];
    },
  });

  const { data: plans = [] } = useQuery({
    queryKey: ["platform-plans"],
    queryFn: async () => {
      const { data } = await supabase
        .from("platform_plans")
        .select("id,nome,valor_mensal,recursos_disponiveis,ativo,created_at")
        .eq("ativo", true)
        .order("valor_mensal");
      return data || [];
    },
  });

  const { data: subscriptions = [] } = useQuery({
    queryKey: ["master-subscriptions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clinic_subscriptions")
        .select("*,platform_plans(nome,valor_mensal,cor),clinicas(nome)");
      return data || [];
    },
  });

  const handleSave = async () => {
    if (!form.nome) { toast.error("Nome é obrigatório"); return; }

    // Create clinic
    const { data: clinic, error } = await supabase.from("clinicas").insert({
      nome: form.nome, cnpj: form.cnpj || null, endereco: form.endereco || null,
      numero: form.numero || null, bairro: form.bairro || null, cidade: form.cidade || null,
      estado: form.estado || null, cep: form.cep || null, telefone: form.telefone || null,
      whatsapp: form.whatsapp || null, email: form.email || null, instagram: form.instagram || null,
    }).select().single();

    if (error) { toast.error("Erro ao criar clínica", { description: error.message }); return; }

    // Create subscription if plan selected
    if (form.plan_id && clinic) {
      const plan = plans.find(p => p.id === form.plan_id);
      const vencimento = new Date();
      vencimento.setMonth(vencimento.getMonth() + 1);

      const { data: subscription } = await supabase.from("clinic_subscriptions").insert({
        clinic_id: clinic.id,
        plan_id: form.plan_id,
        responsavel_nome: form.responsavel_nome || null,
        responsavel_email: form.responsavel_email || null,
        responsavel_telefone: form.responsavel_telefone || null,
        observacoes: form.observacoes || null,
        data_vencimento: vencimento.toISOString().split("T")[0],
      }).select().single();

      // Generate contract PDF if subscription created
      if (subscription && plan) {
        const contractData = {
          clinicaNome: form.nome,
          clinicaCNPJ: form.cnpj || "",
          clinicaEndereco: form.endereco || "",
          clinicaCidade: form.cidade || "",
          clinicaEstado: form.estado || "",
          responsavelNome: form.responsavel_nome || "",
          responsavelEmail: form.responsavel_email || "",
          responsavelTelefone: form.responsavel_telefone || "",
          planoNome: plan.nome,
          planoValor: Number(plan.valor_mensal),
          recursos: Array.isArray(plan.recursos_disponiveis) ? (plan.recursos_disponiveis as string[]) : [],
          dataContrato: format(new Date(), "dd/MM/yyyy", { locale: ptBR }),
        };

        const pdfDoc = await generateSubscriptionContractPDF(contractData);
        pdfDoc.save(`Contrato_${form.nome.replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd")}.pdf`);
      }
    }

    // Create admin user if provided
    if (form.admin_email && form.admin_nome && clinic) {
      try {
        const { data, error: adminError } = await supabase.functions.invoke('create-clinic-admin', {
          body: {
            clinic_id: clinic.id,
            admin_email: form.admin_email,
            admin_nome: form.admin_nome,
            clinic_nome: form.nome,
          }
        });

        if (adminError) throw adminError;

        if (data?.tempPassword) {
          toast.success("Admin criado com sucesso! 🎉", { description: `Email: ${form.admin_email}\nSenha temporária: ${data.tempPassword}` });
        }
      } catch (adminError: any) {
        console.error("Error creating admin:", adminError);
        toast.error("Clínica criada, mas erro ao criar admin", { description: adminError.message });
      }
    }

    toast.success("Clínica criada com sucesso! ✅");
    setForm({ nome: "", cnpj: "", endereco: "", numero: "", bairro: "", cidade: "", estado: "", cep: "", telefone: "", whatsapp: "", email: "", instagram: "", responsavel_nome: "", responsavel_email: "", responsavel_telefone: "", plan_id: "", observacoes: "", admin_nome: "", admin_email: "" });
    setDialogOpen(false);
    queryClient.invalidateQueries({ queryKey: ["master-clinics"] });
    queryClient.invalidateQueries({ queryKey: ["master-subscriptions"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Clínicas Cadastradas</h2>
        <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Nova Clínica</Button>
      </div>

      <div className="grid gap-4">
        {clinics.map((c: any) => {
          const sub = subscriptions.find((s: any) => s.clinic_id === c.id);
          return (
            <Card key={c.id} className="cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all" onClick={() => setSelectedClinic(c)}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{c.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.cidade && `${c.cidade}${c.estado ? ` - ${c.estado}` : ""}`}
                        {c.cnpj && ` · ${c.cnpj}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {sub ? (
                      <>
                        <Badge variant={(STATUS_COLORS[sub.status] as any) || "default"}>{sub.status}</Badge>
                        <Badge variant="outline">{sub.platform_plans?.nome}</Badge>
                      </>
                    ) : (
                      <Badge variant="destructive">Sem plano</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {!isLoading && clinics.length === 0 && (
          <p className="text-center text-muted-foreground py-8">Nenhuma clínica cadastrada.</p>
        )}
      </div>

      {/* New Clinic Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Clínica</DialogTitle>
            <DialogDescription>Preencha os dados da clínica e selecione um plano.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label>Nome *</Label><Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} /></div>
              <div><Label>CNPJ</Label><Input value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: maskCNPJ(e.target.value) }))} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div><Label>Endereço</Label><Input value={form.endereco} onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))} /></div>
              <div><Label>Número</Label><Input value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} /></div>
              <div><Label>Bairro</Label><Input value={form.bairro} onChange={e => setForm(f => ({ ...f, bairro: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div><Label>Cidade</Label><Input value={form.cidade} onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} /></div>
              <div><Label>Estado</Label><Input value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))} maxLength={2} /></div>
              <div><Label>CEP</Label><Input value={form.cep} onChange={e => setForm(f => ({ ...f, cep: maskCEP(e.target.value) }))} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label>Telefone</Label><Input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: maskPhone(e.target.value) }))} /></div>
              <div><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: maskPhone(e.target.value) }))} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label>E-mail</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div><Label>Instagram</Label><Input value={form.instagram} onChange={e => setForm(f => ({ ...f, instagram: e.target.value }))} /></div>
            </div>

            <hr />
            <h3 className="font-semibold text-sm">Responsável</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div><Label>Nome</Label><Input value={form.responsavel_nome} onChange={e => setForm(f => ({ ...f, responsavel_nome: e.target.value }))} /></div>
              <div><Label>E-mail</Label><Input value={form.responsavel_email} onChange={e => setForm(f => ({ ...f, responsavel_email: e.target.value }))} /></div>
              <div><Label>Telefone</Label><Input value={form.responsavel_telefone} onChange={e => setForm(f => ({ ...f, responsavel_telefone: maskPhone(e.target.value) }))} /></div>
            </div>

            <hr />
            <h3 className="font-semibold text-sm">Cadastrar Administrador</h3>
            <p className="text-xs text-muted-foreground">O admin receberá as credenciais de acesso por este sistema</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label>Nome do Admin</Label><Input value={form.admin_nome} onChange={e => setForm(f => ({ ...f, admin_nome: e.target.value }))} placeholder="Nome completo" /></div>
              <div><Label>E-mail do Admin</Label><Input type="email" value={form.admin_email} onChange={e => setForm(f => ({ ...f, admin_email: e.target.value }))} placeholder="admin@exemplo.com" /></div>
            </div>

            <hr />
            <h3 className="font-semibold text-sm">Plano</h3>
            <Select value={form.plan_id} onValueChange={v => setForm(f => ({ ...f, plan_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecione um plano" /></SelectTrigger>
              <SelectContent>
                {plans.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome} — R$ {Number(p.valor_mensal).toFixed(2)}/mês
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div><Label>Observações</Label><Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} /></div>

            <Button onClick={handleSave}>Criar Clínica e Gerar Contrato</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ClinicDetailDialog
        open={!!selectedClinic}
        onOpenChange={(open) => { if (!open) setSelectedClinic(null); }}
        clinic={selectedClinic}
      />
    </div>
  );
}

// ─── Plans Tab ──────────────────────────────────────────────
function PlansTab() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    nome: "", descricao: "", valor_mensal: "", max_pacientes: "", max_profissionais: "", max_clinicas: "1", cor: "#3b82f6", destaque: false,
    recursos_selecionados: [] as string[], validade_dias: "",
  });

  const { data: plans = [] } = useQuery({
    queryKey: ["platform-plans"],
    queryFn: async () => {
      const { data } = await supabase.from("platform_plans").select("*").order("valor_mensal");
      return data || [];
    },
  });

  const handleSave = async () => {
    if (!form.nome || !form.valor_mensal) { toast.error("Nome e valor são obrigatórios"); return; }

    const recursos = form.recursos_selecionados.map(key => {
      const recurso = ALL_RESOURCES.find(r => r.key === key);
      return recurso ? recurso.label : key;
    });

    const { error } = await supabase.from("platform_plans").insert({
      nome: form.nome,
      descricao: form.descricao || null,
      valor_mensal: parseFloat(form.valor_mensal),
      max_pacientes: form.max_pacientes ? parseInt(form.max_pacientes) : null,
      max_profissionais: form.max_profissionais ? parseInt(form.max_profissionais) : null,
      max_clinicas: parseInt(form.max_clinicas) || 1,
      cor: form.cor,
      destaque: form.destaque,
      recursos_disponiveis: recursos,
      validade_dias: form.validade_dias ? parseInt(form.validade_dias) : null,
    });

    if (error) { toast.error("Erro", { description: error.message }); return; }

    toast.success("Plano criado! ✅");
    setForm({ nome: "", descricao: "", valor_mensal: "", max_pacientes: "", max_profissionais: "", max_clinicas: "1", cor: "#3b82f6", destaque: false, recursos_selecionados: [], validade_dias: "" });
    setDialogOpen(false);
    queryClient.invalidateQueries({ queryKey: ["platform-plans"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Planos da Plataforma</h2>
        <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Novo Plano</Button>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {plans.map((plan: any) => (
          <Card key={plan.id} className={`relative ${plan.destaque ? "ring-2 ring-primary" : ""}`}>
            {plan.destaque && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-primary text-primary-foreground">Mais Popular</Badge>
              </div>
            )}
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: plan.cor }} />
                <CardTitle className="text-lg">{plan.nome}</CardTitle>
              </div>
              <CardDescription>{plan.descricao}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold mb-3">
                R$ {Number(plan.valor_mensal).toFixed(2)}<span className="text-sm font-normal text-muted-foreground">/mês</span>
              </p>
              <div className="space-y-1 text-sm">
                <p>📋 {plan.max_pacientes ? `Até ${plan.max_pacientes} pacientes` : "Pacientes ilimitados"}</p>
                <p>👥 {plan.max_profissionais ? `Até ${plan.max_profissionais} profissionais` : "Profissionais ilimitados"}</p>
                <p>🏢 {plan.max_clinicas ? `Até ${plan.max_clinicas} unidade(s)` : "Unidades ilimitadas"}</p>
                {plan.validade_dias && <p>⏱️ Validade: {plan.validade_dias} dias</p>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Plano</DialogTitle>
            <DialogDescription>Configure os recursos e limites do plano</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div><Label>Nome *</Label><Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Profissional" /></div>
            <div><Label>Descrição</Label><Textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} /></div>
            <div><Label>Valor mensal (R$) *</Label><Input type="number" value={form.valor_mensal} onChange={e => setForm(f => ({ ...f, valor_mensal: e.target.value }))} /></div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div><Label>Máx. Pacientes</Label><Input type="number" value={form.max_pacientes} onChange={e => setForm(f => ({ ...f, max_pacientes: e.target.value }))} placeholder="∞" /></div>
              <div><Label>Máx. Profissionais</Label><Input type="number" value={form.max_profissionais} onChange={e => setForm(f => ({ ...f, max_profissionais: e.target.value }))} placeholder="∞" /></div>
              <div><Label>Máx. Unidades</Label><Input type="number" value={form.max_clinicas} onChange={e => setForm(f => ({ ...f, max_clinicas: e.target.value }))} /></div>
              <div><Label>Validade (dias)</Label><Input type="number" value={form.validade_dias} onChange={e => setForm(f => ({ ...f, validade_dias: e.target.value }))} placeholder="∞" /></div>
            </div>
            <div><Label>Cor</Label><Input type="color" value={form.cor} onChange={e => setForm(f => ({ ...f, cor: e.target.value }))} className="h-10 w-20" /></div>
            
            <hr />
            <div>
              <Label className="text-base font-semibold">Recursos Disponíveis no Plano</Label>
              <p className="text-xs text-muted-foreground mb-3">Selecione os recursos que estarão disponíveis neste plano. Deixe em branco para liberar todos.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto border rounded-lg p-3">
                {ALL_RESOURCES.map((recurso) => (
                  <div key={recurso.key} className="flex items-start space-x-2">
                    <Checkbox
                      id={`recurso-${recurso.key}`}
                      checked={form.recursos_selecionados.includes(recurso.key)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setForm(f => ({ ...f, recursos_selecionados: [...f.recursos_selecionados, recurso.key] }));
                        } else {
                          setForm(f => ({ ...f, recursos_selecionados: f.recursos_selecionados.filter(k => k !== recurso.key) }));
                        }
                      }}
                    />
                    <div className="grid gap-1 leading-none">
                      <label htmlFor={`recurso-${recurso.key}`} className="text-sm font-medium cursor-pointer">
                        {recurso.label}
                      </label>
                      <p className="text-xs text-muted-foreground">{recurso.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <Button onClick={handleSave}>Criar Plano</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Payments Tab ───────────────────────────────────────────
function PaymentsTab() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSub, setSelectedSub] = useState<string | null>(null);
  const [payForm, setPayForm] = useState({ mes_referencia: "", valor: "", forma_pagamento: "", observacoes: "" });

  const { data: payments = [] } = useQuery({
    queryKey: ["subscription-payments"],
    queryFn: async () => {
      const { data } = await supabase.from("subscription_payments")
        .select("*, clinic_subscriptions(clinic_id, clinicas(nome), platform_plans(nome))")
        .order("mes_referencia", { ascending: false });
      return data || [];
    },
  });

  const { data: subs = [] } = useQuery({
    queryKey: ["master-subscriptions"],
    queryFn: async () => {
      const { data } = await supabase.from("clinic_subscriptions")
        .select("*, clinicas(nome), platform_plans(nome, valor_mensal)");
      return data || [];
    },
  });

  const handleRegisterPayment = async () => {
    if (!selectedSub || !payForm.mes_referencia || !payForm.valor) {
      toast.error("Preencha todos os campos obrigatórios"); return;
    }

    const { error } = await supabase.from("subscription_payments").insert({
      subscription_id: selectedSub,
      mes_referencia: payForm.mes_referencia + "-01",
      valor: parseFloat(payForm.valor),
      status: "pago",
      data_pagamento: new Date().toISOString(),
      forma_pagamento: payForm.forma_pagamento || null,
      observacoes: payForm.observacoes || null,
    });

    if (error) { toast.error("Erro", { description: error.message }); return; }

    toast.success("Pagamento registrado! ✅");
    setPayForm({ mes_referencia: "", valor: "", forma_pagamento: "", observacoes: "" });
    setDialogOpen(false);
    queryClient.invalidateQueries({ queryKey: ["subscription-payments"] });
  };

  const overdue = subs.filter((s: any) => {
    if (!s.data_vencimento) return false;
    return new Date(s.data_vencimento) < new Date() && s.status === "ativa";
  });

  return (
    <div className="space-y-4">
      {overdue.length > 0 && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div>
              <p className="font-medium text-destructive">{overdue.length} clínica(s) com pagamento atrasado</p>
              <p className="text-xs text-muted-foreground">
                {overdue.map((s: any) => s.clinicas?.nome).join(", ")}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Pagamentos de Assinaturas</h2>
        <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Registrar Pagamento</Button>
      </div>

      <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Clínica</TableHead>
            <TableHead>Plano</TableHead>
            <TableHead>Mês Ref.</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Data Pgto</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((p: any) => (
            <TableRow key={p.id}>
              <TableCell>{p.clinic_subscriptions?.clinicas?.nome}</TableCell>
              <TableCell>{p.clinic_subscriptions?.platform_plans?.nome}</TableCell>
              <TableCell>{p.mes_referencia ? format(new Date(p.mes_referencia), "MMM/yyyy", { locale: ptBR }) : "-"}</TableCell>
              <TableCell>R$ {Number(p.valor).toFixed(2)}</TableCell>
              <TableCell><Badge variant={(STATUS_COLORS[p.status] as any) || "default"}>{p.status}</Badge></TableCell>
              <TableCell>{p.data_pagamento ? format(new Date(p.data_pagamento), "dd/MM/yyyy") : "-"}</TableCell>
            </TableRow>
          ))}
          {payments.length === 0 && (
            <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum pagamento registrado.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar Pagamento</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Clínica *</Label>
              <Select value={selectedSub || ""} onValueChange={v => {
                setSelectedSub(v);
                const sub = subs.find((s: any) => s.id === v);
                if (sub) setPayForm(f => ({ ...f, valor: String(sub.platform_plans?.valor_mensal || "") }));
              }}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {subs.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.clinicas?.nome} — {s.platform_plans?.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Mês Referência *</Label><Input type="month" value={payForm.mes_referencia} onChange={e => setPayForm(f => ({ ...f, mes_referencia: e.target.value }))} /></div>
            <div><Label>Valor (R$) *</Label><Input type="number" value={payForm.valor} onChange={e => setPayForm(f => ({ ...f, valor: e.target.value }))} /></div>
            <div><Label>Forma de Pagamento</Label><Input value={payForm.forma_pagamento} onChange={e => setPayForm(f => ({ ...f, forma_pagamento: e.target.value }))} placeholder="PIX, Boleto, etc." /></div>
            <div><Label>Observações</Label><Textarea value={payForm.observacoes} onChange={e => setPayForm(f => ({ ...f, observacoes: e.target.value }))} /></div>
            <Button onClick={handleRegisterPayment}>Registrar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Groups Tab ─────────────────────────────────────────────
function GroupsTab() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ nome: "", descricao: "" });

  const { data: groups = [] } = useQuery({
    queryKey: ["clinic-groups"],
    queryFn: async () => {
      const { data } = await supabase.from("clinic_groups").select("*").order("nome");
      return data || [];
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: ["clinic-group-members"],
    queryFn: async () => {
      const { data } = await supabase.from("clinic_group_members").select("*, clinicas(nome)");
      return data || [];
    },
  });

  const { data: clinics = [] } = useQuery({
    queryKey: ["master-clinics"],
    queryFn: async () => {
      const { data } = await supabase.from("clinicas").select("id, nome").eq("ativo", true).order("nome");
      return data || [];
    },
  });

  const handleCreate = async () => {
    if (!form.nome) return;
    const { error } = await supabase.from("clinic_groups").insert({
      nome: form.nome, descricao: form.descricao || null, created_by: user?.id,
    });
    if (error) { toast.error("Erro", { description: error.message }); return; }
    toast.success("Grupo criado! ✅");
    setForm({ nome: "", descricao: "" });
    setDialogOpen(false);
    queryClient.invalidateQueries({ queryKey: ["clinic-groups"] });
  };

  const toggleMember = async (groupId: string, clinicId: string) => {
    const existing = members.find((m: any) => m.group_id === groupId && m.clinic_id === clinicId);
    if (existing) {
      await supabase.from("clinic_group_members").delete().eq("id", existing.id);
    } else {
      await supabase.from("clinic_group_members").insert({
        group_id: groupId, clinic_id: clinicId, cross_booking_enabled: true,
      });
    }
    queryClient.invalidateQueries({ queryKey: ["clinic-group-members"] });
  };

  const toggleCrossBooking = async (memberId: string, current: boolean) => {
    await supabase.from("clinic_group_members").update({ cross_booking_enabled: !current } as any).eq("id", memberId);
    queryClient.invalidateQueries({ queryKey: ["clinic-group-members"] });
  };

  const toggleGroupPermission = async (memberId: string, field: string, current: boolean) => {
    await supabase.from("clinic_group_members").update({ [field]: !current } as any).eq("id", memberId);
    queryClient.invalidateQueries({ queryKey: ["clinic-group-members"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Grupos de Clínicas</h2>
          <p className="text-sm text-muted-foreground">Interligue clínicas para agendamento cruzado entre pacientes</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Novo Grupo</Button>
      </div>

      {groups.map((g: any) => {
        const groupMembers = members.filter((m: any) => m.group_id === g.id);
        return (
          <Card key={g.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">{g.nome}</CardTitle>
              </div>
              {g.descricao && <CardDescription>{g.descricao}</CardDescription>}
            </CardHeader>
            <CardContent>
              <p className="text-xs font-medium text-muted-foreground mb-2">Clínicas no grupo:</p>
              <div className="space-y-2">
                {clinics.map((c: any) => {
                  const member = groupMembers.find((m: any) => m.clinic_id === c.id);
                  return (
                    <div key={c.id} className="flex items-center justify-between p-2 rounded border">
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant={member ? "default" : "outline"} onClick={() => toggleMember(g.id, c.id)}>
                          {member ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                        </Button>
                        <span className="text-sm">{c.nome}</span>
                      </div>
                      {member && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Agendamento cruzado</span>
                          <Button size="sm" variant={member.cross_booking_enabled ? "default" : "outline"} onClick={() => toggleCrossBooking(member.id, member.cross_booking_enabled)}>
                            {member.cross_booking_enabled ? "Ativado" : "Desativado"}
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Grupo</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Nome *</Label><Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} /></div>
            <div><Label>Descrição</Label><Textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} /></div>
            <Button onClick={handleCreate}>Criar Grupo</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Dashboard Tab ──────────────────────────────────────────
function MasterDashboardTab() {
  const { data: stats } = useQuery({
    queryKey: ["master-stats"],
    queryFn: async () => {
      const { data: clinics } = await supabase.from("clinicas").select("id").eq("ativo", true);
      const { data: subs } = await supabase.from("clinic_subscriptions").select("status, platform_plans(valor_mensal)");
      const ativas = (subs || []).filter((s: any) => s.status === "ativa");
      const mrr = ativas.reduce((sum: number, s: any) => sum + Number(s.platform_plans?.valor_mensal || 0), 0);
      const { data: payments } = await supabase.from("subscription_payments").select("status");
      const inadimplentes = (payments || []).filter((p: any) => p.status === "atrasado").length;

      return {
        totalClinics: clinics?.length || 0,
        activeSubs: ativas.length,
        mrr,
        inadimplentes,
      };
    },
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Building2 className="h-8 w-8 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-2xl font-bold">{stats?.totalClinics || 0}</p>
              <p className="text-xs text-muted-foreground">Clínicas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Package className="h-8 w-8 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-2xl font-bold">{stats?.activeSubs || 0}</p>
              <p className="text-xs text-muted-foreground">Assinaturas Ativas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-emerald-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-2xl font-bold truncate">R$ {(stats?.mrr || 0).toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">MRR</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-destructive shrink-0" />
            <div className="min-w-0">
              <p className="text-2xl font-bold">{stats?.inadimplentes || 0}</p>
              <p className="text-xs text-muted-foreground">Inadimplentes</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Upgrade Requests Tab ───────────────────────────────────
function UpgradeRequestsTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["plan-upgrade-requests"],
    queryFn: async () => {
      const { data } = await supabase.from("plan_upgrade_requests")
        .select("*, clinicas(nome), current_plan:platform_plans!plan_upgrade_requests_current_plan_id_fkey(nome), requested_plan:platform_plans!plan_upgrade_requests_requested_plan_id_fkey(nome, valor_mensal)")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const handleRequest = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "aprovado" | "rejeitado" }) => {
      const request = requests.find((r: any) => r.id === id);
      if (!request) throw new Error("Solicitação não encontrada");

      await supabase.from("plan_upgrade_requests")
        .update({ status: action, reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
        .eq("id", id);

      if (action === "aprovado" && request.clinic_id && request.requested_plan_id) {
        const { data: sub } = await supabase.from("clinic_subscriptions")
          .select("id").eq("clinic_id", request.clinic_id).maybeSingle();

        if (sub) {
          const { error: upErr } = await supabase.from("clinic_subscriptions")
            .update({ plan_id: request.requested_plan_id, updated_at: new Date().toISOString() })
            .eq("id", sub.id);
          if (upErr) throw upErr;
        } else {
          const venc = new Date();
          venc.setMonth(venc.getMonth() + 1);
          const { error: insErr } = await supabase.from("clinic_subscriptions").insert({
            clinic_id: request.clinic_id,
            plan_id: request.requested_plan_id,
            status: "ativa",
            data_vencimento: venc.toISOString().split("T")[0],
          });
          if (insErr) throw insErr;
        }
      }
    },
    onSuccess: () => {
      toast.success("Solicitação processada! ✅");
      queryClient.invalidateQueries({ queryKey: ["plan-upgrade-requests"] });
      queryClient.invalidateQueries({ queryKey: ["master-subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["master-clinics"] });
      queryClient.invalidateQueries({ queryKey: ["saas-status"] });
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const pendentes = requests.filter((r: any) => r.status === "pendente");
  const historico = requests.filter((r: any) => r.status !== "pendente");

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Solicitações de Upgrade</h2>

      {pendentes.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">Pendentes ({pendentes.length})</h3>
          {pendentes.map((r: any) => (
            <Card key={r.id} className="border-primary/30 bg-primary/5">
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{r.clinicas?.nome || "Clínica"}</p>
                  <p className="text-sm text-muted-foreground">
                    {r.current_plan?.nome || "Sem plano"} → <strong>{r.requested_plan?.nome}</strong> (R$ {Number(r.requested_plan?.valor_mensal || 0).toFixed(2)}/mês)
                  </p>
                  {r.motivo && <p className="text-xs text-muted-foreground mt-1">Motivo: {r.motivo}</p>}
                  <p className="text-xs text-muted-foreground">{format(new Date(r.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" onClick={() => handleRequest.mutate({ id: r.id, action: "aprovado" })} disabled={handleRequest.isPending}>
                    <Check className="h-4 w-4 mr-1" /> Aprovar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleRequest.mutate({ id: r.id, action: "rejeitado" })} disabled={handleRequest.isPending}>
                    <X className="h-4 w-4 mr-1" /> Rejeitar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {pendentes.length === 0 && !isLoading && (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhuma solicitação pendente.</CardContent></Card>
      )}

      {historico.length > 0 && (
        <div className="space-y-3 pt-4 border-t">
          <h3 className="text-sm font-semibold text-muted-foreground">Histórico</h3>
          {historico.slice(0, 20).map((r: any) => (
            <Card key={r.id}>
              <CardContent className="p-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{r.clinicas?.nome} — {r.current_plan?.nome || "—"} → {r.requested_plan?.nome}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(r.created_at), "dd/MM/yyyy", { locale: ptBR })}</p>
                </div>
                <Badge variant={r.status === "aprovado" ? "default" : "destructive"}>{r.status}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main ───────────────────────────────────────────────────
export default function MasterPanel() {
  const { isMaster } = useAuth();

  if (!isMaster) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Card>
          <CardContent className="p-8 text-center">
            <Crown className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Acesso Restrito</h2>
            <p className="text-muted-foreground">Esta área é exclusiva para o Gestor Master.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Crown className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Painel Master</h1>
          <p className="text-muted-foreground">Gerencie clínicas, planos e pagamentos da plataforma</p>
        </div>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList className="flex flex-wrap gap-1 h-auto p-1 w-full max-w-4xl">
          <TabsTrigger value="dashboard" className="text-xs sm:text-sm">Visão Geral</TabsTrigger>
          <TabsTrigger value="clinics" className="text-xs sm:text-sm">Clínicas</TabsTrigger>
          <TabsTrigger value="plans" className="text-xs sm:text-sm">Planos</TabsTrigger>
          <TabsTrigger value="upgrades" className="text-xs sm:text-sm">Upgrades</TabsTrigger>
          <TabsTrigger value="payments" className="text-xs sm:text-sm">Pagamentos</TabsTrigger>
          <TabsTrigger value="groups" className="text-xs sm:text-sm">Grupos</TabsTrigger>
          <TabsTrigger value="marketing" className="gap-1 text-xs sm:text-sm">
            <Rocket className="h-3 w-3" /> Marketing
          </TabsTrigger>
          <TabsTrigger value="manual" className="gap-1 text-xs sm:text-sm">
            <BookOpen className="h-3 w-3" /> Manual
          </TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard"><MasterDashboardTab /></TabsContent>
        <TabsContent value="clinics"><ClinicsTab /></TabsContent>
        <TabsContent value="plans"><PlansTab /></TabsContent>
        <TabsContent value="upgrades"><UpgradeRequestsTab /></TabsContent>
        <TabsContent value="payments"><PaymentsTab /></TabsContent>
        <TabsContent value="groups"><GroupsTab /></TabsContent>
        <TabsContent value="marketing"><MasterMarketingTab /></TabsContent>
        <TabsContent value="manual"><ManualTab /></TabsContent>
      </Tabs>
    </div>
  );
}
