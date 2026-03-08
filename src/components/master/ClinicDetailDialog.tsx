import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, Save, Users, Package, Percent } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { maskCNPJ, maskPhone, maskCEP } from "@/lib/masks";

interface ClinicDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinic: any;
}

export function ClinicDetailDialog({ open, onOpenChange, clinic }: ClinicDetailDialogProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<any>({});
  const [discountForm, setDiscountForm] = useState({ plan_id: "", percentual: "" });

  useEffect(() => {
    if (clinic) {
      setForm({
        nome: clinic.nome || "",
        cnpj: clinic.cnpj || "",
        endereco: clinic.endereco || "",
        numero: clinic.numero || "",
        bairro: clinic.bairro || "",
        cidade: clinic.cidade || "",
        estado: clinic.estado || "",
        cep: clinic.cep || "",
        telefone: clinic.telefone || "",
        whatsapp: clinic.whatsapp || "",
        email: clinic.email || "",
        instagram: clinic.instagram || "",
        ativo: clinic.ativo ?? true,
      });
    }
  }, [clinic]);

  const { data: subscription } = useQuery({
    queryKey: ["clinic-subscription", clinic?.id],
    queryFn: async () => {
      const { data } = await (supabase.from("clinic_subscriptions") as any)
        .select("*, platform_plans(id, nome, valor_mensal, cor, descricao, max_pacientes, max_profissionais)")
        .eq("clinic_id", clinic.id)
        .maybeSingle();
      return data;
    },
    enabled: !!clinic?.id,
  });

  const { data: plans = [] } = useQuery({
    queryKey: ["platform-plans"],
    queryFn: async () => {
      const { data } = await (supabase.from("platform_plans") as any).select("*").eq("ativo", true).order("valor_mensal");
      return data || [];
    },
  });

  const { data: clinicUsers = [] } = useQuery({
    queryKey: ["clinic-users-master", clinic?.id],
    queryFn: async () => {
      if (!clinic?.id) return [];
      const { data } = await (supabase.from("clinic_users") as any)
        .select("id, user_id, role, created_at")
        .eq("clinic_id", clinic.id);

      // Fetch profile names
      const userIds = (data || []).map((u: any) => u.user_id);
      if (userIds.length === 0) return [];
      const { data: profiles } = await supabase.from("profiles").select("user_id, nome, email").in("user_id", userIds);
      return (data || []).map((u: any) => ({
        ...u,
        profile: profiles?.find((p: any) => p.user_id === u.user_id),
      }));
    },
    enabled: !!clinic?.id,
  });

  const { data: discounts = [] } = useQuery({
    queryKey: ["clinic-plan-discounts", clinic?.id],
    queryFn: async () => {
      if (!clinic?.id || !subscription?.plan_id) return [];
      // Get plan-level discounts (descontos_pacientes linked to preco_plano)
      const { data } = await (supabase.from("descontos_pacientes") as any)
        .select("*, pacientes(nome)")
        .eq("ativo", true);
      return data || [];
    },
    enabled: !!clinic?.id && !!subscription?.plan_id,
  });

  const updateClinic = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.from("clinicas") as any)
        .update({
          nome: form.nome,
          cnpj: form.cnpj || null,
          endereco: form.endereco || null,
          numero: form.numero || null,
          bairro: form.bairro || null,
          cidade: form.cidade || null,
          estado: form.estado || null,
          cep: form.cep || null,
          telefone: form.telefone || null,
          whatsapp: form.whatsapp || null,
          email: form.email || null,
          instagram: form.instagram || null,
          ativo: form.ativo,
        })
        .eq("id", clinic.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["master-clinics"] });
      toast({ title: "Clínica atualizada! ✅" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const changePlan = useMutation({
    mutationFn: async (planId: string) => {
      if (subscription) {
        const { error } = await (supabase.from("clinic_subscriptions") as any)
          .update({ plan_id: planId })
          .eq("id", subscription.id);
        if (error) throw error;
      } else {
        const venc = new Date();
        venc.setMonth(venc.getMonth() + 1);
        const { error } = await (supabase.from("clinic_subscriptions") as any).insert({
          clinic_id: clinic.id,
          plan_id: planId,
          data_vencimento: venc.toISOString().split("T")[0],
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clinic-subscription", clinic?.id] });
      queryClient.invalidateQueries({ queryKey: ["master-subscriptions"] });
      toast({ title: "Plano atualizado! ✅" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const updateSubDiscount = useMutation({
    mutationFn: async (discount: number) => {
      if (!subscription) throw new Error("Sem assinatura ativa");
      const { error } = await (supabase.from("clinic_subscriptions") as any)
        .update({ desconto_percentual: discount })
        .eq("id", subscription.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clinic-subscription", clinic?.id] });
      toast({ title: "Desconto aplicado! ✅" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  if (!clinic) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            {clinic.nome}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="dados">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="dados">Dados</TabsTrigger>
            <TabsTrigger value="plano">Plano</TabsTrigger>
            <TabsTrigger value="desconto">Descontos</TabsTrigger>
            <TabsTrigger value="equipe">Equipe</TabsTrigger>
          </TabsList>

          {/* Dados Tab */}
          <TabsContent value="dados" className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Nome *</Label>
                <Input value={form.nome || ""} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              </div>
              <div>
                <Label>CNPJ</Label>
                <Input value={form.cnpj || ""} onChange={(e) => setForm({ ...form, cnpj: maskCNPJ(e.target.value) })} />
              </div>
              <div>
                <Label>CEP</Label>
                <Input value={form.cep || ""} onChange={(e) => setForm({ ...form, cep: maskCEP(e.target.value) })} />
              </div>
              <div className="col-span-2">
                <Label>Endereço</Label>
                <Input value={form.endereco || ""} onChange={(e) => setForm({ ...form, endereco: e.target.value })} />
              </div>
              <div>
                <Label>Número</Label>
                <Input value={form.numero || ""} onChange={(e) => setForm({ ...form, numero: e.target.value })} />
              </div>
              <div>
                <Label>Bairro</Label>
                <Input value={form.bairro || ""} onChange={(e) => setForm({ ...form, bairro: e.target.value })} />
              </div>
              <div>
                <Label>Cidade</Label>
                <Input value={form.cidade || ""} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
              </div>
              <div>
                <Label>Estado</Label>
                <Input value={form.estado || ""} onChange={(e) => setForm({ ...form, estado: e.target.value })} maxLength={2} />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={form.telefone || ""} onChange={(e) => setForm({ ...form, telefone: maskPhone(e.target.value) })} />
              </div>
              <div>
                <Label>WhatsApp</Label>
                <Input value={form.whatsapp || ""} onChange={(e) => setForm({ ...form, whatsapp: maskPhone(e.target.value) })} />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label>Instagram</Label>
                <Input value={form.instagram || ""} onChange={(e) => setForm({ ...form, instagram: e.target.value })} placeholder="@clinica" />
              </div>
              <div className="col-span-2 flex items-center gap-3">
                <Switch checked={form.ativo ?? true} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
                <Label>Clínica ativa</Label>
              </div>
            </div>
            <Button onClick={() => updateClinic.mutate()} disabled={updateClinic.isPending || !form.nome?.trim()}>
              <Save className="h-4 w-4 mr-2" />
              {updateClinic.isPending ? "Salvando..." : "Salvar Dados"}
            </Button>
          </TabsContent>

          {/* Plano Tab */}
          <TabsContent value="plano" className="space-y-4">
            {subscription ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="h-4 w-4 text-primary" />
                    Plano Atual: {subscription.platform_plans?.nome}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-2xl font-bold">
                    R$ {Number(subscription.platform_plans?.valor_mensal || 0).toFixed(2)}<span className="text-sm font-normal text-muted-foreground">/mês</span>
                  </p>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>📋 {subscription.platform_plans?.max_pacientes ? `Até ${subscription.platform_plans.max_pacientes} pacientes` : "Pacientes ilimitados"}</p>
                    <p>👥 {subscription.platform_plans?.max_profissionais ? `Até ${subscription.platform_plans.max_profissionais} profissionais` : "Profissionais ilimitados"}</p>
                  </div>
                  <Badge variant={subscription.status === "ativa" ? "default" : "destructive"}>{subscription.status}</Badge>
                </CardContent>
              </Card>
            ) : (
              <p className="text-muted-foreground text-center py-4">Nenhum plano vinculado</p>
            )}

            <div>
              <Label>Alterar Plano</Label>
              <Select onValueChange={(v) => changePlan.mutate(v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar novo plano..." /></SelectTrigger>
                <SelectContent>
                  {plans.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome} — R$ {Number(p.valor_mensal).toFixed(2)}/mês
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          {/* Descontos Tab */}
          <TabsContent value="desconto" className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Percent className="h-4 w-4 text-primary" />
                  Desconto no Plano
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {subscription ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Plano atual: <strong>{subscription.platform_plans?.nome}</strong> — R$ {Number(subscription.platform_plans?.valor_mensal || 0).toFixed(2)}/mês
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <Label>Desconto (%)</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          placeholder="0"
                          value={discountForm.percentual}
                          onChange={(e) => setDiscountForm({ ...discountForm, percentual: e.target.value })}
                        />
                      </div>
                      <div className="flex-1">
                        <Label>Valor com desconto</Label>
                        <p className="text-lg font-bold mt-1">
                          R$ {(Number(subscription.platform_plans?.valor_mensal || 0) * (1 - (parseFloat(discountForm.percentual) || 0) / 100)).toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={() => updateSubDiscount.mutate(parseFloat(discountForm.percentual) || 0)}
                      disabled={updateSubDiscount.isPending}
                    >
                      Aplicar Desconto
                    </Button>
                  </>
                ) : (
                  <p className="text-muted-foreground text-center py-4">Vincule um plano primeiro para aplicar descontos.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Equipe Tab */}
          <TabsContent value="equipe" className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Profissional</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Cargo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clinicUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-6 text-muted-foreground">Nenhum membro vinculado</TableCell>
                  </TableRow>
                ) : (
                  clinicUsers.map((cu: any) => (
                    <TableRow key={cu.id}>
                      <TableCell className="font-medium">{cu.profile?.nome || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{cu.profile?.email || "—"}</TableCell>
                      <TableCell><Badge variant="outline">{cu.role}</Badge></TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
