import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, ShoppingCart, Trash2, Edit2, Package, History, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ImageUpload } from "@/components/ui/image-upload";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

const Produtos = () => {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saleOpen, setSaleOpen] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const [mesRef, setMesRef] = useState(format(new Date(), "yyyy-MM"));

  const [formData, setFormData] = useState({ nome: "", descricao: "", preco: "", estoque: "", foto_url: "" });
  const [saleData, setSaleData] = useState({ produto_id: "", paciente_id: "", quantidade: "1", data_venda: format(new Date(), "yyyy-MM-dd"), observacoes: "" });
  const [stockData, setStockData] = useState({ produto_id: "", quantidade: "", data_entrada: format(new Date(), "yyyy-MM-dd"), observacoes: "" });

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("produtos").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: pacientes = [] } = useQuery({
    queryKey: ["pacientes-select"],
    queryFn: async () => {
      const { data } = await supabase.from("pacientes").select("id, nome").eq("status", "ativo").order("nome");
      return data || [];
    },
  });

  const { data: vendas = [] } = useQuery({
    queryKey: ["vendas-produtos", mesRef],
    queryFn: async () => {
      const start = `${mesRef}-01`;
      const endDate = new Date(start);
      endDate.setMonth(endDate.getMonth() + 1);
      endDate.setDate(0);
      const end = format(endDate, "yyyy-MM-dd");
      const { data, error } = await supabase.from("vendas_produtos")
        .select("*, produtos(nome), pacientes(nome)")
        .gte("data_venda", start)
        .lte("data_venda", end)
        .order("data_venda", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: entradas = [] } = useQuery({
    queryKey: ["entradas-estoque"],
    queryFn: async () => {
      const { data, error } = await supabase.from("entradas_estoque")
        .select("*, produtos(nome)")
        .order("data_entrada", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  const saveProduto = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      const payload = {
        nome: formData.nome,
        descricao: formData.descricao || null,
        preco: parseFloat(formData.preco) || 0,
        estoque: parseInt(formData.estoque) || 0,
        foto_url: formData.foto_url || null,
      };
      if (editingId) {
        const { error } = await supabase.from("produtos").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("produtos").insert({ ...payload, created_by: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      setFormOpen(false);
      resetForm();
      toast({ title: editingId ? "Produto atualizado!" : "Produto criado!" });
    },
    onError: (error) => toast({ title: "Erro", description: String(error), variant: "destructive" }),
  });

  const deleteProduto = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("produtos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      toast({ title: "Produto deletado!" });
    },
  });

  const saveVenda = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      const produto = produtos.find((p: any) => p.id === saleData.produto_id);
      if (!produto) throw new Error("Produto não encontrado");
      const qty = parseInt(saleData.quantidade) || 1;
      const valorUnit = Number(produto.preco);
      const { error } = await supabase.from("vendas_produtos").insert({
        produto_id: saleData.produto_id,
        paciente_id: saleData.paciente_id || null,
        quantidade: qty,
        valor_unitario: valorUnit,
        valor_total: valorUnit * qty,
        data_venda: saleData.data_venda,
        observacoes: saleData.observacoes || null,
        created_by: user.id,
      });
      if (error) throw error;
      // Update stock
      await supabase.from("produtos").update({ estoque: Math.max(0, produto.estoque - qty) }).eq("id", produto.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      queryClient.invalidateQueries({ queryKey: ["vendas-produtos"] });
      setSaleOpen(false);
      setSaleData({ produto_id: "", paciente_id: "", quantidade: "1", data_venda: format(new Date(), "yyyy-MM-dd"), observacoes: "" });
      toast({ title: "Venda registrada!" });
    },
    onError: (error) => toast({ title: "Erro", description: String(error), variant: "destructive" }),
  });

  const saveEntrada = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      const produto = produtos.find((p: any) => p.id === stockData.produto_id);
      if (!produto) throw new Error("Produto não encontrado");
      const qty = parseInt(stockData.quantidade) || 0;
      const { error } = await supabase.from("entradas_estoque").insert({
        produto_id: stockData.produto_id,
        quantidade: qty,
        data_entrada: stockData.data_entrada,
        observacoes: stockData.observacoes || null,
        created_by: user.id,
      });
      if (error) throw error;
      await supabase.from("produtos").update({ estoque: produto.estoque + qty }).eq("id", produto.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      queryClient.invalidateQueries({ queryKey: ["entradas-estoque"] });
      setStockOpen(false);
      setStockData({ produto_id: "", quantidade: "", data_entrada: format(new Date(), "yyyy-MM-dd"), observacoes: "" });
      toast({ title: "Entrada de estoque registrada!" });
    },
    onError: (error) => toast({ title: "Erro", description: String(error), variant: "destructive" }),
  });

  const resetForm = () => { setFormData({ nome: "", descricao: "", preco: "", estoque: "", foto_url: "" }); setEditingId(null); };

  const openEdit = (produto: any) => {
    setEditingId(produto.id);
    setFormData({ nome: produto.nome || "", descricao: produto.descricao || "", preco: String(produto.preco ?? ""), estoque: String(produto.estoque ?? ""), foto_url: produto.foto_url || "" });
    setFormOpen(true);
  };

  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(new Date(), i);
    return { value: format(d, "yyyy-MM"), label: format(d, "MMMM yyyy", { locale: ptBR }) };
  });

  const totalVendasMes = vendas.reduce((sum: number, v: any) => sum + Number(v.valor_total), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Produtos</h1>
          <p className="text-muted-foreground">Catálogo, vendas e controle de estoque</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button onClick={() => { resetForm(); setFormOpen(true); }} className="gap-2">
              <Plus className="h-4 w-4" /> Novo Produto
            </Button>
            <Button variant="outline" onClick={() => setSaleOpen(true)} className="gap-2">
              <ShoppingCart className="h-4 w-4" /> Registrar Venda
            </Button>
            <Button variant="outline" onClick={() => setStockOpen(true)} className="gap-2">
              <Package className="h-4 w-4" /> Entrada Estoque
            </Button>
          </div>
        )}
      </div>

      {/* Grid de Produtos (para clientes) */}
      {!isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {produtos.map((produto: any) => (
            <Card key={produto.id} className="overflow-hidden">
              {produto.foto_url && (
                <div className="w-full h-48 bg-muted flex items-center justify-center overflow-hidden">
                  <img src={produto.foto_url} alt={produto.nome} className="h-full w-full object-cover" />
                </div>
              )}
              <CardContent className="pt-4 space-y-3">
                <div>
                  <h3 className="font-bold text-lg">{produto.nome}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">{produto.descricao}</p>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">R$ {parseFloat(produto.preco).toFixed(2)}</span>
                  <Badge variant="outline">{produto.estoque} em estoque</Badge>
                </div>
                <Button className="w-full" disabled={produto.estoque === 0}>
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  {produto.estoque === 0 ? "Sem estoque" : "Comprar"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Admin Tabs */}
      {isAdmin && (
        <Tabs defaultValue="catalogo">
          <TabsList>
            <TabsTrigger value="catalogo">Catálogo</TabsTrigger>
            <TabsTrigger value="vendas">Vendas</TabsTrigger>
            <TabsTrigger value="estoque">Entradas de Estoque</TabsTrigger>
          </TabsList>

          <TabsContent value="catalogo">
            <Card>
              <CardHeader><CardTitle>Lista de Produtos</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Preço</TableHead>
                      <TableHead>Estoque</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {produtos.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum produto cadastrado</TableCell></TableRow>
                    ) : produtos.map((produto: any) => (
                      <TableRow key={produto.id}>
                        <TableCell className="font-medium">{produto.nome}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-muted-foreground">{produto.descricao || "—"}</TableCell>
                        <TableCell>R$ {parseFloat(produto.preco).toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant={produto.estoque === 0 ? "destructive" : produto.estoque < 5 ? "secondary" : "outline"}>
                            {produto.estoque}
                          </Badge>
                        </TableCell>
                        <TableCell className="space-x-2">
                          <Button size="sm" variant="outline" onClick={() => openEdit(produto)} className="gap-1"><Edit2 className="h-3 w-3" /> Editar</Button>
                          <Button size="sm" variant="destructive" onClick={() => deleteProduto.mutate(produto.id)} disabled={deleteProduto.isPending} className="gap-1"><Trash2 className="h-3 w-3" /> Deletar</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vendas">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Select value={mesRef} onValueChange={setMesRef}>
                  <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {monthOptions.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Badge variant="outline" className="text-base px-4 py-2">
                  Total: R$ {totalVendasMes.toFixed(2)}
                </Badge>
              </div>
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead>Paciente</TableHead>
                        <TableHead>Qtd</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Obs</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vendas.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma venda no período</TableCell></TableRow>
                      ) : vendas.map((v: any) => (
                        <TableRow key={v.id}>
                          <TableCell>{format(new Date(v.data_venda), "dd/MM/yyyy")}</TableCell>
                          <TableCell className="font-medium">{v.produtos?.nome}</TableCell>
                          <TableCell>{v.pacientes?.nome || "—"}</TableCell>
                          <TableCell>{v.quantidade}</TableCell>
                          <TableCell>R$ {Number(v.valor_total).toFixed(2)}</TableCell>
                          <TableCell className="text-muted-foreground max-w-[150px] truncate">{v.observacoes || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="estoque">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Quantidade</TableHead>
                      <TableHead>Observações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entradas.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhuma entrada registrada</TableCell></TableRow>
                    ) : entradas.map((e: any) => (
                      <TableRow key={e.id}>
                        <TableCell>{format(new Date(e.data_entrada), "dd/MM/yyyy")}</TableCell>
                        <TableCell className="font-medium">{e.produtos?.nome}</TableCell>
                        <TableCell><Badge variant="outline">+{e.quantidade}</Badge></TableCell>
                        <TableCell className="text-muted-foreground">{e.observacoes || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Product Form Dialog */}
      <Dialog open={formOpen} onOpenChange={(open) => { setFormOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle>{editingId ? "Editar Produto" : "Novo Produto"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome *</Label><Input value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} /></div>
            <div><Label>Descrição</Label><Textarea value={formData.descricao} onChange={(e) => setFormData({ ...formData, descricao: e.target.value })} rows={3} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Preço (R$) *</Label><Input type="number" step="0.01" value={formData.preco} onChange={(e) => setFormData({ ...formData, preco: e.target.value })} /></div>
              <div><Label>Estoque *</Label><Input type="number" value={formData.estoque} onChange={(e) => setFormData({ ...formData, estoque: e.target.value })} /></div>
            </div>
            <div><Label>Foto</Label><ImageUpload value={formData.foto_url} onChange={(url) => setFormData({ ...formData, foto_url: url })} folder="produtos" /></div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
              <Button onClick={() => saveProduto.mutate()} disabled={!formData.nome || !formData.preco || saveProduto.isPending}>
                {saveProduto.isPending ? "Salvando..." : editingId ? "Atualizar" : "Criar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sale Dialog */}
      <Dialog open={saleOpen} onOpenChange={setSaleOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle>Registrar Venda</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Produto *</Label>
              <Select value={saleData.produto_id} onValueChange={(v) => setSaleData({ ...saleData, produto_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
                <SelectContent>
                  {produtos.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.nome} (R$ {Number(p.preco).toFixed(2)} · Estoque: {p.estoque})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Paciente</Label>
              <Select value={saleData.paciente_id} onValueChange={(v) => setSaleData({ ...saleData, paciente_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
                <SelectContent>
                  {pacientes.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Quantidade</Label><Input type="number" min="1" value={saleData.quantidade} onChange={(e) => setSaleData({ ...saleData, quantidade: e.target.value })} /></div>
              <div><Label>Data da Venda</Label><Input type="date" value={saleData.data_venda} onChange={(e) => setSaleData({ ...saleData, data_venda: e.target.value })} /></div>
            </div>
            <div><Label>Observações</Label><Input value={saleData.observacoes} onChange={(e) => setSaleData({ ...saleData, observacoes: e.target.value })} /></div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setSaleOpen(false)}>Cancelar</Button>
              <Button onClick={() => saveVenda.mutate()} disabled={!saleData.produto_id || saveVenda.isPending}>
                {saveVenda.isPending ? "Salvando..." : "Registrar Venda"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Stock Entry Dialog */}
      <Dialog open={stockOpen} onOpenChange={setStockOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle>Entrada de Estoque</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Produto *</Label>
              <Select value={stockData.produto_id} onValueChange={(v) => setStockData({ ...stockData, produto_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
                <SelectContent>
                  {produtos.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.nome} (Estoque atual: {p.estoque})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Quantidade *</Label><Input type="number" min="1" value={stockData.quantidade} onChange={(e) => setStockData({ ...stockData, quantidade: e.target.value })} /></div>
              <div><Label>Data de Entrada</Label><Input type="date" value={stockData.data_entrada} onChange={(e) => setStockData({ ...stockData, data_entrada: e.target.value })} /></div>
            </div>
            <div><Label>Observações</Label><Input value={stockData.observacoes} onChange={(e) => setStockData({ ...stockData, observacoes: e.target.value })} placeholder="Ex: Lote 123, fornecedor X" /></div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setStockOpen(false)}>Cancelar</Button>
              <Button onClick={() => saveEntrada.mutate()} disabled={!stockData.produto_id || !stockData.quantidade || saveEntrada.isPending}>
                {saveEntrada.isPending ? "Salvando..." : "Registrar Entrada"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Produtos;
