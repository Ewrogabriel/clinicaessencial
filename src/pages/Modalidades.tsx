import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { useModalidades, useCreateModalidade, useUpdateModalidade, useDeleteModalidade } from "@/modules/appointments/hooks/useModalidades";
import { toast } from "@/modules/shared/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Layers, Trash2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Modalidade } from "@/types/entities";

const Modalidades = () => {
  const { user } = useAuth();
  const { activeClinicId } = useClinic();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: modalidades = [], isLoading } = useModalidades();
  const createMutation = useCreateModalidade();
  const updateMutation = useUpdateModalidade();
  const deleteMutation = useDeleteModalidade();

  const openNew = () => {
    setEditingId(null); setNome(""); setDescricao(""); setAtivo(true); setDialogOpen(true);
  };

  const openEdit = (m: Modalidade) => {
    setEditingId(m.id); setNome(m.nome); setDescricao(m.descricao || ""); setAtivo(m.ativo); setDialogOpen(true);
  };

  const handleSave = () => {
    if (!user || !nome.trim()) return;
    if (editingId) {
      updateMutation.mutate({ id: editingId, nome, descricao, ativo }, { onSuccess: () => setDialogOpen(false) });
    } else {
      createMutation.mutate({ nome, descricao, ativo, userId: user.id, clinicId: activeClinicId }, { onSuccess: () => setDialogOpen(false) });
    }
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteMutation.mutate(deleteId, { onSuccess: () => setDeleteId(null) });
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

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
                    <TableCell className="hidden sm:table-cell text-muted-foreground">{m.descricao || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={m.ativo ? "default" : "outline"}>{m.ativo ? "Ativo" : "Inativo"}</Badge>
                    </TableCell>
                    <TableCell className="w-[120px]">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(m)} title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(m.id)} title="Excluir">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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
              <Button onClick={handleSave} disabled={isSaving || !nome.trim()}>
                {isSaving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir modalidade?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita. A modalidade será removida permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Modalidades;
