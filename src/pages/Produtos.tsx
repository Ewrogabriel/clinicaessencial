import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, ShoppingCart, Trash2, Edit2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";

const Produtos = () => {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    nome: "",
    descricao: "",
    preco: "",
    estoque: "",
    foto_url: "",
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("produtos").select("*").order("created_at", { ascending: false });
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
    onError: (error) => {
      toast({ title: "Erro ao salvar produto", description: String(error), variant: "destructive" });
    },
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

  const resetForm = () => {
    setFormData({ nome: "", descricao: "", preco: "", estoque: "", foto_url: "" });
    setEditingId(null);
  };

  const openEdit = (produto: any) => {
    setEditingId(produto.id);
    setFormData({
      nome: produto.nome || "",
      descricao: produto.descricao || "",
      preco: String(produto.preco ?? ""),
      estoque: String(produto.estoque ?? ""),
      foto_url: produto.foto_url || "",
    });
    setFormOpen(true);
  };

  const openCreate = () => {
    resetForm();
    setFormOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Produtos</h1>
          <p className="text-muted-foreground">Catálogo de produtos para venda e reserva</p>
        </div>
        {isAdmin && (
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Produto
          </Button>
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

      {/* Tabela para Admin */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Lista de Produtos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
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
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Nenhum produto cadastrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    produtos.map((produto: any) => (
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
                          <Button size="sm" variant="outline" onClick={() => openEdit(produto)} className="gap-1">
                            <Edit2 className="h-3 w-3" /> Editar
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => deleteProduto.mutate(produto.id)} disabled={deleteProduto.isPending} className="gap-1">
                            <Trash2 className="h-3 w-3" /> Deletar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={formOpen} onOpenChange={(open) => { setFormOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Produto" : "Novo Produto"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} placeholder="Ex: Garrafa térmica" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={formData.descricao} onChange={(e) => setFormData({ ...formData, descricao: e.target.value })} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Preço (R$) *</Label>
                <Input type="number" step="0.01" value={formData.preco} onChange={(e) => setFormData({ ...formData, preco: e.target.value })} />
              </div>
              <div>
                <Label>Estoque *</Label>
                <Input type="number" value={formData.estoque} onChange={(e) => setFormData({ ...formData, estoque: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>URL da Imagem</Label>
              <Input value={formData.foto_url} onChange={(e) => setFormData({ ...formData, foto_url: e.target.value })} placeholder="https://..." />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
              <Button onClick={() => saveProduto.mutate()} disabled={!formData.nome || !formData.preco || saveProduto.isPending}>
                {saveProduto.isPending ? "Salvando..." : editingId ? "Atualizar" : "Criar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Produtos;
