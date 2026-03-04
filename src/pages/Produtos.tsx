import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, ShoppingCart, Trash2, Edit2, Image as ImageIcon } from "lucide-react";
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";

const Produtos = () => {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterCategoria, setFilterCategoria] = useState("");

  const [formData, setFormData] = useState({
    nome: "",
    descricao: "",
    preco: "",
    quantidade_estoque: "",
    categoria: "geral",
    imagem_url: "",
    permite_reserva: true,
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos", filterCategoria],
    queryFn: async () => {
      let query = supabase.from("produtos").select("*");
      
      if (filterCategoria) {
        query = query.eq("categoria", filterCategoria);
      }

      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: categorias = [] } = useQuery({
    queryKey: ["categorias-produtos"],
    queryFn: async () => {
      const cats = ["Acessórios", "Suplementos", "Roupas", "Bebidas", "Geral"];
      return cats;
    },
  });

  const createProduto = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      
      const { data, error } = await supabase
        .from("produtos")
        .insert({
          nome: formData.nome,
          descricao: formData.descricao,
          preco: parseFloat(formData.preco),
          quantidade_estoque: parseInt(formData.quantidade_estoque),
          categoria: formData.categoria,
          imagem_url: formData.imagem_url || null,
          permite_reserva: formData.permite_reserva,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      setFormOpen(false);
      resetForm();
      toast({ title: "Produto criado com sucesso!" });
    },
    onError: (error) => {
      toast({ title: "Erro ao criar produto", description: String(error), variant: "destructive" });
    },
  });

  const deleteProduto = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("produtos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      toast({ title: "Produto deletado com sucesso!" });
    },
  });

  const resetForm = () => {
    setFormData({
      nome: "",
      descricao: "",
      preco: "",
      quantidade_estoque: "",
      categoria: "geral",
      imagem_url: "",
      permite_reserva: true,
    });
    setEditingId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Produtos</h1>
          <p className="text-muted-foreground">Catálogo de produtos para venda e reserva</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setFormOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Produto
          </Button>
        )}
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Categoria</Label>
              <Select value={filterCategoria} onValueChange={setFilterCategoria}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas</SelectItem>
                  {categorias.map((cat: string) => (
                    <SelectItem key={cat} value={cat.toLowerCase()}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grid de Produtos (para clientes) */}
      {!isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {produtos.map((produto: any) => (
            <Card key={produto.id} className="overflow-hidden">
              {produto.imagem_url && (
                <div className="w-full h-48 bg-muted flex items-center justify-center overflow-hidden">
                  <img
                    src={produto.imagem_url}
                    alt={produto.nome}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              <CardContent className="pt-4 space-y-3">
                <div>
                  <h3 className="font-bold text-lg">{produto.nome}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {produto.descricao}
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">R$ {parseFloat(produto.preco).toFixed(2)}</span>
                  <Badge variant="outline">
                    {produto.quantidade_estoque} em estoque
                  </Badge>
                </div>

                <div className="flex gap-2">
                  <Button className="flex-1" disabled={produto.quantidade_estoque === 0}>
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Comprar
                  </Button>
                  {produto.permite_reserva && (
                    <Button variant="outline" className="flex-1">
                      Reservar
                    </Button>
                  )}
                </div>
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
                    <TableHead>Categoria</TableHead>
                    <TableHead>Preço</TableHead>
                    <TableHead>Estoque</TableHead>
                    <TableHead>Reserva?</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {produtos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nenhum produto cadastrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    produtos.map((produto: any) => (
                      <TableRow key={produto.id}>
                        <TableCell className="font-medium">{produto.nome}</TableCell>
                        <TableCell className="capitalize">{produto.categoria}</TableCell>
                        <TableCell>R$ {parseFloat(produto.preco).toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              produto.quantidade_estoque === 0
                                ? "destructive"
                                : produto.quantidade_estoque < 5
                                ? "secondary"
                                : "outline"
                            }
                          >
                            {produto.quantidade_estoque}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {produto.permite_reserva ? "Sim" : "Não"}
                        </TableCell>
                        <TableCell className="space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingId(produto.id);
                              setFormOpen(true);
                            }}
                            className="gap-1"
                          >
                            <Edit2 className="h-3 w-3" />
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => deleteProduto.mutate(produto.id)}
                            disabled={deleteProduto.isPending}
                            className="gap-1"
                          >
                            <Trash2 className="h-3 w-3" />
                            Deletar
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

      {/* Dialog de Novo Produto */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>
              {editingId ? "Editar Produto" : "Novo Produto"}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-4 space-y-4">
            <div>
              <Label>Nome do Produto *</Label>
              <Input
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Ex: Garrafa térmica"
              />
            </div>

            <div>
              <Label>Descrição</Label>
              <Textarea
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Descrição do produto..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Categoria</Label>
                <Select
                  value={formData.categoria}
                  onValueChange={(value) => setFormData({ ...formData, categoria: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categorias.map((cat: string) => (
                      <SelectItem key={cat} value={cat.toLowerCase()}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Preço (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.preco}
                  onChange={(e) => setFormData({ ...formData, preco: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <Label>Quantidade em Estoque *</Label>
              <Input
                type="number"
                value={formData.quantidade_estoque}
                onChange={(e) => setFormData({ ...formData, quantidade_estoque: e.target.value })}
                placeholder="0"
              />
            </div>

            <div>
              <Label>URL da Imagem</Label>
              <Input
                value={formData.imagem_url}
                onChange={(e) => setFormData({ ...formData, imagem_url: e.target.value })}
                placeholder="https://..."
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="permite_reserva"
                checked={formData.permite_reserva}
                onChange={(e) => setFormData({ ...formData, permite_reserva: e.target.checked })}
                className="rounded border"
              />
              <Label htmlFor="permite_reserva" className="cursor-pointer">
                Permitir reserva de produtos
              </Label>
            </div>
          </div>

          <div className="shrink-0 flex justify-end gap-3 pt-4 border-t mt-4">
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => createProduto.mutate()}
              disabled={!formData.nome || !formData.preco || !formData.quantidade_estoque || createProduto.isPending}
            >
              {createProduto.isPending ? "Salvando..." : "Salvar Produto"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Produtos;
