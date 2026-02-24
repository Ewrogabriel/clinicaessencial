import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Layers } from "lucide-react";

interface Modalidade {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  created_at: string;
}

const Modalidades = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [loading, setLoading] = useState(false);

  const { data: modalidades = [], isLoading } = useQuery({
    queryKey: ["modalidades"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("modalidades")
        .select("*")
        .order("nome");
      if (error) throw error;
      return data as Modalidade[];
    },
  });

  const openNew = () => {
    setEditingId(null);
    setNome("");
    setDescricao("");
    setAtivo(true);
    setDialogOpen(true);
  };

  const openEdit = (m: Modalidade) => {
    setEditingId(m.id);
    setNome(m.nome);
    setDescricao(m.descricao || "");
    setAtivo(m.ativo);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!user || !nome.trim()) return;
    setLoading(true);

    try {
      if (editingId) {
        const { error } = await (supabase as any)
          .from("modalidades")
          .update({ nome: nome.trim(), descricao: descricao || null, ativo })
          .eq("id", editingId);
        if (error) throw error;
        toast({ title: "Modalidade atualizada!" });
      } else {
        const { error } = await (supabase as any)
          .from("modalidades")
          .insert({ nome: nome.trim(), descricao: descricao || null, ativo, created_by: user.id });
        if (error) throw error;
        toast({ title: "Modalidade criada!" });
      }
      queryClient.invalidateQueries({ queryKey: ["modalidades"] });
      setDialogOpen(false);
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }

    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-[Plus_Jakarta_Sans]">Modalidades</h1>
          <p className="text-muted-foreground">Gerencie as modalidades de atendimento</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Modalidade
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground animate-pulse">Carregando...</p>
          ) : modalidades.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <Layers className="h-12 w-12 mb-4 opacity-40" />
              <p className="text-lg font-medium">Nenhuma modalidade cadastrada</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="hidden sm:table-cell">Descrição</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[80px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {modalidades.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.nome}</TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">
                      {m.descricao || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={m.ativo ? "default" : "outline"}>
                        {m.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(m)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Modalidade" : "Nova Modalidade"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Fisioterapia" />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descrição da modalidade" rows={3} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Ativo</Label>
              <Switch checked={ativo} onCheckedChange={setAtivo} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={loading || !nome.trim()}>
                {loading ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Modalidades;
