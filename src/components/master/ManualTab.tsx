import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  BookOpen, Sparkles, Image, Plus, Save, Trash2, ArrowUp, ArrowDown,
  FileText, Loader2, Download, Eye,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";

interface ManualSection {
  id: string;
  titulo: string;
  conteudo: string;
  ordem: number;
  imagem_url: string | null;
  created_at: string;
  updated_at: string;
}

export function ManualTab() {
  const queryClient = useQueryClient();
  const [editingSection, setEditingSection] = useState<ManualSection | null>(null);
  const [editForm, setEditForm] = useState({ titulo: "", conteudo: "", imagem_url: "" });
  const [generatingAll, setGeneratingAll] = useState(false);
  const [generatingImage, setGeneratingImage] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newForm, setNewForm] = useState({ titulo: "", conteudo: "" });

  const { data: sections = [], isLoading } = useQuery({
    queryKey: ["manual-sections"],
    queryFn: async () => {
      const { data } = await (supabase.from("manual_sections") as any)
        .select("*")
        .order("ordem");
      return (data || []) as ManualSection[];
    },
  });

  const handleGenerateAll = async () => {
    setGeneratingAll(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-manual", {
        body: { section: "all", action: "generate_text" },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const content = data.content as string;

      // Parse markdown into sections by ## headers
      const parts = content.split(/^## /m).filter(Boolean);
      const parsed = parts.map((part, i) => {
        const lines = part.split("\n");
        const titulo = lines[0].trim();
        const conteudo = lines.slice(1).join("\n").trim();
        return { titulo, conteudo, ordem: i + 1 };
      });

      // Delete existing and insert new
      await (supabase.from("manual_sections") as any).delete().neq("id", "00000000-0000-0000-0000-000000000000");

      for (const sec of parsed) {
        await (supabase.from("manual_sections") as any).insert({
          titulo: sec.titulo,
          conteudo: sec.conteudo,
          ordem: sec.ordem,
        });
      }

      toast({ title: "Manual gerado com sucesso! 📖", description: `${parsed.length} seções criadas.` });
      queryClient.invalidateQueries({ queryKey: ["manual-sections"] });
    } catch (e: any) {
      toast({ title: "Erro ao gerar manual", description: e.message, variant: "destructive" });
    } finally {
      setGeneratingAll(false);
    }
  };

  const handleGenerateImage = async (section: ManualSection) => {
    setGeneratingImage(section.id);
    try {
      const { data, error } = await supabase.functions.invoke("generate-manual", {
        body: { section: section.titulo, action: "generate_image" },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      await (supabase.from("manual_sections") as any)
        .update({ imagem_url: data.imageUrl })
        .eq("id", section.id);

      toast({ title: "Imagem gerada! 🎨" });
      queryClient.invalidateQueries({ queryKey: ["manual-sections"] });
    } catch (e: any) {
      toast({ title: "Erro ao gerar imagem", description: e.message, variant: "destructive" });
    } finally {
      setGeneratingImage(null);
    }
  };

  const handleSave = async () => {
    if (!editingSection) return;
    const { error } = await (supabase.from("manual_sections") as any)
      .update({
        titulo: editForm.titulo,
        conteudo: editForm.conteudo,
        imagem_url: editForm.imagem_url || null,
      })
      .eq("id", editingSection.id);

    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Seção atualizada! ✅" });
    setEditingSection(null);
    queryClient.invalidateQueries({ queryKey: ["manual-sections"] });
  };

  const handleDelete = async (id: string) => {
    await (supabase.from("manual_sections") as any).delete().eq("id", id);
    toast({ title: "Seção removida" });
    queryClient.invalidateQueries({ queryKey: ["manual-sections"] });
  };

  const handleAddSection = async () => {
    if (!newForm.titulo) { toast({ title: "Título obrigatório", variant: "destructive" }); return; }
    const maxOrdem = sections.reduce((max, s) => Math.max(max, s.ordem), 0);
    const { error } = await (supabase.from("manual_sections") as any).insert({
      titulo: newForm.titulo,
      conteudo: newForm.conteudo,
      ordem: maxOrdem + 1,
    });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Seção adicionada! ✅" });
    setNewForm({ titulo: "", conteudo: "" });
    setAddDialogOpen(false);
    queryClient.invalidateQueries({ queryKey: ["manual-sections"] });
  };

  const handleReorder = async (id: string, direction: "up" | "down") => {
    const idx = sections.findIndex(s => s.id === id);
    if ((direction === "up" && idx === 0) || (direction === "down" && idx === sections.length - 1)) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    await (supabase.from("manual_sections") as any).update({ ordem: sections[swapIdx].ordem }).eq("id", sections[idx].id);
    await (supabase.from("manual_sections") as any).update({ ordem: sections[idx].ordem }).eq("id", sections[swapIdx].id);
    queryClient.invalidateQueries({ queryKey: ["manual-sections"] });
  };

  const openEdit = (section: ManualSection) => {
    setEditingSection(section);
    setEditForm({ titulo: section.titulo, conteudo: section.conteudo, imagem_url: section.imagem_url || "" });
  };

  const exportMarkdown = () => {
    const md = sections.map(s => {
      let text = `## ${s.titulo}\n\n${s.conteudo}`;
      if (s.imagem_url) text += `\n\n![${s.titulo}](${s.imagem_url})`;
      return text;
    }).join("\n\n---\n\n");

    const fullMd = `# Manual do Sistema — Essencial Clínicas\n\n${md}`;
    const blob = new Blob([fullMd], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "manual-essencial-clinicas.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" /> Manual do Sistema
          </h2>
          <p className="text-sm text-muted-foreground">Documentação completa gerada com IA</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar Seção
          </Button>
          {sections.length > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
                <Eye className="h-4 w-4 mr-1" /> Visualizar
              </Button>
              <Button variant="outline" size="sm" onClick={exportMarkdown}>
                <Download className="h-4 w-4 mr-1" /> Exportar MD
              </Button>
            </>
          )}
          <Button size="sm" onClick={handleGenerateAll} disabled={generatingAll} className="gap-1">
            {generatingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {generatingAll ? "Gerando..." : "Gerar Manual com IA"}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : sections.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma seção no manual</h3>
            <p className="text-muted-foreground mb-4">
              Clique em "Gerar Manual com IA" para criar automaticamente toda a documentação do sistema.
            </p>
            <Button onClick={handleGenerateAll} disabled={generatingAll}>
              {generatingAll ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Gerar Manual Completo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sections.map((section, idx) => (
            <Card key={section.id} className="group">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="secondary" className="shrink-0">{idx + 1}</Badge>
                    <CardTitle className="text-base truncate">{section.titulo}</CardTitle>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleReorder(section.id, "up")} disabled={idx === 0}>
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleReorder(section.id, "down")} disabled={idx === sections.length - 1}>
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleGenerateImage(section)} disabled={generatingImage === section.id}>
                      {generatingImage === section.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Image className="h-3 w-3" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(section)}>
                      <FileText className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(section.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {section.conteudo.replace(/[#*_`]/g, "").slice(0, 200)}...
                </p>
                {section.imagem_url && (
                  <img src={section.imagem_url} alt={section.titulo} className="mt-3 rounded-lg border max-h-40 object-cover" />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingSection} onOpenChange={() => setEditingSection(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Editar Seção</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh]">
            <div className="grid gap-4 p-1">
              <div><Label>Título</Label><Input value={editForm.titulo} onChange={e => setEditForm(f => ({ ...f, titulo: e.target.value }))} /></div>
              <div><Label>Conteúdo (Markdown)</Label><Textarea value={editForm.conteudo} onChange={e => setEditForm(f => ({ ...f, conteudo: e.target.value }))} className="min-h-[300px] font-mono text-sm" /></div>
              <div><Label>URL da Imagem</Label><Input value={editForm.imagem_url} onChange={e => setEditForm(f => ({ ...f, imagem_url: e.target.value }))} placeholder="https://..." /></div>
              <Button onClick={handleSave}><Save className="h-4 w-4 mr-2" /> Salvar</Button>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Add Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar Seção</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div><Label>Título *</Label><Input value={newForm.titulo} onChange={e => setNewForm(f => ({ ...f, titulo: e.target.value }))} /></div>
            <div><Label>Conteúdo</Label><Textarea value={newForm.conteudo} onChange={e => setNewForm(f => ({ ...f, conteudo: e.target.value }))} className="min-h-[150px]" /></div>
            <Button onClick={handleAddSection}>Adicionar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" /> Manual do Sistema — Essencial Clínicas
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[75vh]">
            <div className="prose prose-sm max-w-none dark:prose-invert p-2">
              {sections.map((s, i) => (
                <div key={s.id}>
                  {i > 0 && <Separator className="my-6" />}
                  <ReactMarkdown>{`## ${s.titulo}\n\n${s.conteudo}`}</ReactMarkdown>
                  {s.imagem_url && (
                    <img src={s.imagem_url} alt={s.titulo} className="rounded-lg border my-4 max-w-full" />
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
