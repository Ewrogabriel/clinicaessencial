import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Globe, Instagram, Phone, Mail, MapPin, Eye, EyeOff, Tag, X, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/modules/shared/hooks/use-toast";

interface Convenio {
  id: string;
  nome: string;
  descricao: string | null;
  telefone: string | null;
  whatsapp: string | null;
  email: string | null;
  site: string | null;
  instagram: string | null;
  endereco: string | null;
  imagem_card_url: string | null;
  imagem_descricao_url: string | null;
  categoria: string | null;
  ativo: boolean;
  created_at: string;
}

const initialForm = {
  nome: "",
  descricao: "",
  telefone: "",
  whatsapp: "",
  email: "",
  site: "",
  instagram: "",
  endereco: "",
  imagem_card_url: "",
  imagem_descricao_url: "",
  categoria: "",
  ativo: true,
};

const Convenios = () => {
  const { user, isAdmin, isPatient } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);
  const [filterCategoria, setFilterCategoria] = useState("todas");
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [detailConvenio, setDetailConvenio] = useState<Convenio | null>(null);

  const { data: convenios = [], isLoading } = useQuery<Convenio[]>({
    queryKey: ["convenios"],
    queryFn: async () => {
      const query = supabase.from("convenios").select("*").order("nome");
      // Patients only see active partners
      const { data, error } = isPatient ? await query.eq("ativo", true) : await query;
      if (error) throw error;
      return (data || []) as Convenio[];
    },
  });

  const { data: categorias = [] } = useQuery({
    queryKey: ["categorias-parceiros"],
    queryFn: async () => {
      const { data } = await (supabase.from("categorias_parceiros" as any) as any)
        .select("*").order("nome");
      return data ?? [];
    },
  });

  const saveCatMutation = useMutation({
    mutationFn: async () => {
      if (!newCatName.trim()) throw new Error("Nome obrigatório");
      const { error } = await (supabase.from("categorias_parceiros" as any) as any)
        .insert({ nome: newCatName.trim(), created_by: user!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categorias-parceiros"] });
      setNewCatName("");
      toast({ title: "Categoria criada!" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteCatMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("categorias_parceiros" as any) as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categorias-parceiros"] });
      toast({ title: "Categoria removida" });
    },
  });

  const uploadImage = async (file: File, path: string) => {
    const ext = file.name.split(".").pop();
    const filePath = `${path}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("convenios").upload(filePath, file);
    if (error) throw error;
    const { data: urlData } = supabase.storage.from("convenios").getPublicUrl(filePath);
    return urlData.publicUrl;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.nome.trim()) throw new Error("Nome é obrigatório");

      const payload: any = {
        nome: form.nome.trim(),
        descricao: form.descricao || null,
        telefone: form.telefone || null,
        whatsapp: form.whatsapp || null,
        email: form.email || null,
        site: form.site || null,
        instagram: form.instagram || null,
        endereco: form.endereco || null,
        imagem_card_url: form.imagem_card_url || null,
        imagem_descricao_url: form.imagem_descricao_url || null,
        categoria: form.categoria || null,
        ativo: form.ativo,
      };

      if (editId) {
        const { error } = await supabase.from("convenios").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("convenios").insert({ ...payload, created_by: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["convenios"] });
      setFormOpen(false);
      resetForm();
      toast({ title: editId ? "Parceiro atualizado!" : "Parceiro cadastrado!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("convenios").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["convenios"] });
      toast({ title: "Parceiro removido" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const resetForm = () => {
    setForm(initialForm);
    setEditId(null);
  };

  const openEdit = (c: Convenio) => {
    setEditId(c.id);
    setForm({
      nome: c.nome,
      descricao: c.descricao || "",
      telefone: c.telefone || "",
      whatsapp: c.whatsapp || "",
      email: c.email || "",
      site: c.site || "",
      instagram: c.instagram || "",
      endereco: c.endereco || "",
      imagem_card_url: c.imagem_card_url || "",
      imagem_descricao_url: c.imagem_descricao_url || "",
      categoria: (c as any).categoria || "",
      ativo: c.ativo,
    });
    setFormOpen(true);
  };

  const handleCardImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadImage(file, "cards");
      setForm((f) => ({ ...f, imagem_card_url: url }));
      toast({ title: "Imagem do card enviada!" });
    } catch {
      toast({ title: "Erro ao enviar imagem", variant: "destructive" });
    }
  };

  const handleDescImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadImage(file, "descricoes");
      setForm((f) => ({ ...f, imagem_descricao_url: url }));
      toast({ title: "Imagem de descrição enviada!" });
    } catch {
      toast({ title: "Erro ao enviar imagem", variant: "destructive" });
    }
  };

  const filteredConvenios = filterCategoria === "todas"
    ? convenios
    : convenios.filter(c => (c as any).categoria === filterCategoria);

  // Unique categories from existing partners
  const categoriasFromPartners = [...new Set(convenios.map(c => (c as any).categoria).filter(Boolean))];
  const allCategorias = [...new Set([...categorias.map((c: any) => c.nome), ...categoriasFromPartners])].sort();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Parceiros</h1>
            <p className="text-muted-foreground">Gerencie empresas parceiras</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isPatient && (
            <>
              <Button variant="outline" size="sm" onClick={() => setCatDialogOpen(true)} className="gap-1">
                <Tag className="h-4 w-4" /> Categorias
              </Button>
              <Button onClick={() => { resetForm(); setFormOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" /> Novo Parceiro
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Category filter */}
      {allCategorias.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={filterCategoria === "todas" ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setFilterCategoria("todas")}
          >
            Todas
          </Badge>
          {allCategorias.map((cat) => (
            <Badge
              key={cat}
              variant={filterCategoria === cat ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setFilterCategoria(cat as string)}
            >
              {cat as string}
            </Badge>
          ))}
        </div>
      )}

      {/* Patient card grid view */}
      {isPatient ? (
        <div>
          {isLoading ? (
            <div className="flex justify-center py-12 text-muted-foreground">Carregando...</div>
          ) : filteredConvenios.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-muted-foreground">
              <Globe className="h-12 w-12 mb-4 opacity-40" />
              <p className="text-lg font-medium">Nenhum parceiro disponível</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredConvenios.map((c) => (
                <button
                  key={c.id}
                  className="text-left rounded-xl border bg-card hover:shadow-md hover:border-primary/40 transition-all overflow-hidden"
                  onClick={() => setDetailConvenio(c)}
                >
                  {c.imagem_card_url ? (
                    <img src={c.imagem_card_url} alt={c.nome} className="w-full h-36 object-cover" />
                  ) : (
                    <div className="w-full h-36 bg-muted flex items-center justify-center">
                      <Globe className="h-10 w-10 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="p-4 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold truncate">{c.nome}</p>
                      {(c as any).categoria && (
                        <Badge variant="secondary" className="shrink-0 text-xs">{(c as any).categoria}</Badge>
                      )}
                    </div>
                    {c.descricao && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{c.descricao}</p>
                    )}
                    <div className="flex items-center gap-3 pt-1 text-muted-foreground">
                      {c.whatsapp && <Phone className="h-3.5 w-3.5" />}
                      {c.email && <Mail className="h-3.5 w-3.5" />}
                      {c.instagram && <Instagram className="h-3.5 w-3.5" />}
                      {c.site && <Globe className="h-3.5 w-3.5" />}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12 text-muted-foreground">Carregando...</div>
          ) : filteredConvenios.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-muted-foreground">
              <Globe className="h-12 w-12 mb-4 opacity-40" />
              <p className="text-lg font-medium">Nenhum parceiro encontrado</p>
              {!isPatient && (
                <Button className="mt-4" onClick={() => { resetForm(); setFormOpen(true); }}>
                  <Plus className="h-4 w-4 mr-2" /> Cadastrar primeiro parceiro
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Imagem</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Status</TableHead>
                  {!isPatient && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredConvenios.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      {c.imagem_card_url ? (
                        <img src={c.imagem_card_url} alt={c.nome} className="h-10 w-10 rounded-md object-cover" />
                      ) : (
                        <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center">
                          <Globe className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{c.nome}</p>
                      {c.descricao && <p className="text-xs text-muted-foreground line-clamp-1">{c.descricao}</p>}
                    </TableCell>
                    <TableCell>
                      {(c as any).categoria ? (
                        <Badge variant="secondary">{(c as any).categoria}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {c.whatsapp && <Phone className="h-3 w-3" />}
                        {c.email && <Mail className="h-3 w-3" />}
                        {c.instagram && <Instagram className="h-3 w-3" />}
                        {c.site && <Globe className="h-3 w-3" />}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.ativo ? "default" : "outline"}>
                        {c.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    {!isPatient && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEdit(c)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remover parceiro?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Essa ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteMutation.mutate(c.id)}>
                                  Remover
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      )}

      {/* Patient partner detail dialog */}
      <Dialog open={!!detailConvenio} onOpenChange={(open) => !open && setDetailConvenio(null)}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          {detailConvenio && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {detailConvenio.imagem_card_url ? (
                    <img src={detailConvenio.imagem_card_url} alt={detailConvenio.nome} className="h-8 w-8 rounded-md object-cover" />
                  ) : (
                    <Globe className="h-5 w-5 text-muted-foreground" />
                  )}
                  {detailConvenio.nome}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {detailConvenio.imagem_descricao_url && (
                  <img
                    src={detailConvenio.imagem_descricao_url}
                    alt={detailConvenio.nome}
                    className="w-full rounded-lg object-cover max-h-48"
                  />
                )}
                {(detailConvenio as any).categoria && (
                  <Badge variant="secondary">{(detailConvenio as any).categoria}</Badge>
                )}
                {detailConvenio.descricao && (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{detailConvenio.descricao}</p>
                )}
                <div className="grid grid-cols-1 gap-2 text-sm">
                  {detailConvenio.whatsapp && (
                    <a
                      href={`https://wa.me/${detailConvenio.whatsapp.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-green-700 hover:underline"
                    >
                      <Phone className="h-4 w-4" />
                      {detailConvenio.whatsapp}
                    </a>
                  )}
                  {detailConvenio.telefone && !detailConvenio.whatsapp && (
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      {detailConvenio.telefone}
                    </span>
                  )}
                  {detailConvenio.email && (
                    <a href={`mailto:${detailConvenio.email}`} className="flex items-center gap-2 text-primary hover:underline">
                      <Mail className="h-4 w-4" />
                      {detailConvenio.email}
                    </a>
                  )}
                  {detailConvenio.instagram && (
                    <a
                      href={`https://instagram.com/${detailConvenio.instagram.replace("@", "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-pink-600 hover:underline"
                    >
                      <Instagram className="h-4 w-4" />
                      {detailConvenio.instagram}
                    </a>
                  )}
                  {detailConvenio.site && (
                    <a
                      href={detailConvenio.site.startsWith("http") ? detailConvenio.site : `https://${detailConvenio.site}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-blue-600 hover:underline"
                    >
                      <Globe className="h-4 w-4" />
                      {detailConvenio.site}
                    </a>
                  )}
                  {detailConvenio.endereco && (
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      {detailConvenio.endereco}
                    </span>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar Parceiro" : "Novo Parceiro"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nome *</Label>
                <Input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} placeholder="Nome da empresa parceira" />
              </div>
              <div>
                <Label>Categoria</Label>
                <Select value={form.categoria || "sem-categoria"} onValueChange={(v) => setForm((f) => ({ ...f, categoria: v === "sem-categoria" ? "" : v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sem-categoria">Sem categoria</SelectItem>
                    {allCategorias.map((cat) => (
                      <SelectItem key={cat as string} value={cat as string}>{cat as string}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} placeholder="Descreva a parceria..." rows={3} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Telefone</Label>
                <Input value={form.telefone} onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))} placeholder="(00) 0000-0000" />
              </div>
              <div>
                <Label>WhatsApp</Label>
                <Input value={form.whatsapp} onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))} placeholder="5500000000000" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="contato@empresa.com" />
              </div>
              <div>
                <Label>Site</Label>
                <Input value={form.site} onChange={(e) => setForm((f) => ({ ...f, site: e.target.value }))} placeholder="https://www.empresa.com" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Instagram</Label>
                <Input value={form.instagram} onChange={(e) => setForm((f) => ({ ...f, instagram: e.target.value }))} placeholder="@empresa" />
              </div>
              <div>
                <Label>Endereço</Label>
                <Input value={form.endereco} onChange={(e) => setForm((f) => ({ ...f, endereco: e.target.value }))} placeholder="Rua, número, cidade" />
              </div>
            </div>

            {/* Image uploads */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Imagem do Card</Label>
                {form.imagem_card_url && (
                  <img src={form.imagem_card_url} alt="Card" className="h-24 w-full rounded-md object-cover" />
                )}
                <Input type="file" accept="image/*" onChange={handleCardImageUpload} />
              </div>
              <div className="space-y-2">
                <Label>Imagem da Descrição</Label>
                {form.imagem_descricao_url && (
                  <img src={form.imagem_descricao_url} alt="Desc" className="h-24 w-full rounded-md object-cover" />
                )}
                <Input type="file" accept="image/*" onChange={handleDescImageUpload} />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch checked={form.ativo} onCheckedChange={(v) => setForm((f) => ({ ...f, ativo: v }))} />
              <Label>Ativo</Label>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setFormOpen(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Category Management Dialog */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" /> Gerenciar Categorias
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="Nova categoria..."
                onKeyDown={(e) => e.key === "Enter" && saveCatMutation.mutate()}
              />
              <Button onClick={() => saveCatMutation.mutate()} disabled={saveCatMutation.isPending || !newCatName.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {categorias.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma categoria cadastrada</p>
              ) : (
                categorias.map((cat: any) => (
                  <div key={cat.id} className="flex items-center justify-between p-2 rounded-md border">
                    <span className="text-sm font-medium">{cat.nome}</span>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteCatMutation.mutate(cat.id)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Convenios;
