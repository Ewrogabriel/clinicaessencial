import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, Plus, Edit2, Trash2, QrCode } from "lucide-react";
import { toast } from "@/modules/shared/hooks/use-toast";

const FormasPagamento = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pixDialogOpen, setPixDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedFormaId, setSelectedFormaId] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: "", descricao: "", tipo: "pix" });
  const [pixForm, setPixForm] = useState({ chave_pix: "", tipo_chave: "cpf", nome_beneficiario: "" });

  const { data: formasPagamento = [], refetch } = useQuery({
    queryKey: ["formas-pagamento"],
    queryFn: async () => {
      const { data } = await (supabase
        .from("formas_pagamento" as any) as any)
        .select("*")
        .order("ordem");
      return data ?? [];
    },
  });

  const { data: configPix = [] } = useQuery({
    queryKey: ["config-pix"],
    queryFn: async () => {
      const { data } = await (supabase
        .from("config_pix" as any) as any)
        .select("*");
      return data ?? [];
    },
  });

  const saveForma = useMutation({
    mutationFn: async () => {
      if (!form.nome || !form.tipo) throw new Error("Preencha os campos obrigatórios");

      if (editingId) {
        const { error } = await (supabase
          .from("formas_pagamento" as any) as any)
          .update(form)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await (supabase
          .from("formas_pagamento" as any) as any)
          .insert([form]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editingId ? "Forma atualizada!" : "Forma criada!" });
      setDialogOpen(false);
      setEditingId(null);
      setForm({ nome: "", descricao: "", tipo: "pix" });
      refetch();
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  });

  const savePix = useMutation({
    mutationFn: async () => {
      if (!selectedFormaId || !pixForm.chave_pix || !pixForm.nome_beneficiario) {
        throw new Error("Preencha os campos obrigatórios");
      }

      // Delete existing if updating
      if (configPix.find((p: any) => p.forma_pagamento_id === selectedFormaId)) {
        await (supabase
          .from("config_pix" as any) as any)
          .delete()
          .eq("forma_pagamento_id", selectedFormaId);
      }

      const { error } = await (supabase
        .from("config_pix" as any) as any)
        .insert([{
          forma_pagamento_id: selectedFormaId,
          ...pixForm
        }]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Configuração PIX salva!" });
      setPixDialogOpen(false);
      setSelectedFormaId(null);
      setPixForm({ chave_pix: "", tipo_chave: "cpf", nome_beneficiario: "" });
      refetch();
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  });

  const deleteForma = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("formas_pagamento" as any) as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Forma removida!" });
      refetch();
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  });

  const handleEdit = (forma: any) => {
    setEditingId(forma.id);
    setForm({ nome: forma.nome, descricao: forma.descricao, tipo: forma.tipo });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-[Plus_Jakarta_Sans]">Formas de Pagamento</h1>
          <p className="text-muted-foreground">Configure as opções de pagamento disponíveis para seus clientes</p>
        </div>
        <Button onClick={() => { setEditingId(null); setForm({ nome: "", descricao: "", tipo: "pix" }); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Nova Forma
        </Button>
      </div>

      {/* Formas de Pagamento */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Formas Ativas
          </CardTitle>
          <CardDescription>Clique em PIX para configurar dados</CardDescription>
        </CardHeader>
        <CardContent>
          {formasPagamento.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma forma de pagamento configurada.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {formasPagamento.map((forma: any) => {
                const pixConfig = configPix.find(p => p.forma_pagamento_id === forma.id);
                return (
                  <div key={forma.id} className="p-4 rounded-lg border">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold">{forma.nome}</h4>
                        <p className="text-xs text-muted-foreground capitalize">{forma.tipo}</p>
                      </div>
                      {forma.ativo && <div className="w-2 h-2 bg-green-500 rounded-full mt-1"></div>}
                    </div>

                    {forma.descricao && <p className="text-sm text-muted-foreground mb-3">{forma.descricao}</p>}

                    {forma.tipo === "pix" && (
                      <div className="mb-3 p-2 rounded bg-blue-50 text-sm">
                        {pixConfig ? (
                          <div>
                            <p className="font-medium text-xs">PIX Configurado</p>
                            <p className="text-xs text-muted-foreground">{pixConfig.chave_pix}</p>
                          </div>
                        ) : (
                          <p className="text-xs text-blue-600">PIX não configurado</p>
                        )}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(forma)}
                        className="flex-1"
                      >
                        <Edit2 className="h-3 w-3 mr-1" /> Editar
                      </Button>

                      {forma.tipo === "pix" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setSelectedFormaId(forma.id); setPixDialogOpen(true); }}
                        >
                          <QrCode className="h-3 w-3" />
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteForma.mutate(forma.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog - Nova/Editar Forma */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar" : "Nova"} Forma de Pagamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: PIX, Cartão de Crédito"
              />
            </div>

            <div>
              <Label>Tipo *</Label>
              <Select value={form.tipo} onValueChange={(val) => setForm({ ...form, tipo: val })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="cartao">Cartão de Crédito</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Descrição</Label>
              <Input
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                placeholder="Descrição da forma de pagamento"
              />
            </div>

            <Button
              onClick={() => saveForma.mutate()}
              disabled={saveForma.isPending}
              className="w-full"
            >
              {saveForma.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog - Configurar PIX */}
      <Dialog open={pixDialogOpen} onOpenChange={setPixDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar PIX</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tipo de Chave *</Label>
              <Select value={pixForm.tipo_chave} onValueChange={(val) => setPixForm({ ...pixForm, tipo_chave: val })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cpf">CPF</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="telefone">Telefone</SelectItem>
                  <SelectItem value="aleatorio">Chave Aleatória</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Chave PIX *</Label>
              <Input
                value={pixForm.chave_pix}
                onChange={(e) => setPixForm({ ...pixForm, chave_pix: e.target.value })}
                placeholder="Digite a chave PIX"
              />
            </div>

            <div>
              <Label>Nome do Beneficiário *</Label>
              <Input
                value={pixForm.nome_beneficiario}
                onChange={(e) => setPixForm({ ...pixForm, nome_beneficiario: e.target.value })}
                placeholder="Nome do titular da chave"
              />
            </div>

            <Button
              onClick={() => savePix.mutate()}
              disabled={savePix.isPending}
              className="w-full"
            >
              {savePix.isPending ? "Salvando..." : "Salvar Configuração"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FormasPagamento;
