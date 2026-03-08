import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Megaphone, Plus, Trash2, Edit, ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ImageUpload } from "@/components/ui/image-upload";
import { useClinic } from "@/hooks/useClinic";

const AvisosAdmin = () => {
  const { user } = useAuth();
  const { activeClinicId } = useClinic();
  const queryClient = useQueryClient();
  const [titulo, setTitulo] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: avisos = [], isLoading } = useQuery({
    queryKey: ["admin-avisos", activeClinicId],
    queryFn: async () => {
      let query = supabase.from("avisos").select("*");
      if (activeClinicId) query = query.eq("clinic_id", activeClinicId);
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!titulo.trim() || !mensagem.trim()) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase.from("avisos").insert({
      titulo,
      mensagem,
      ativo: true,
      created_by: user.id,
      image_url: imageUrl || null,
      clinic_id: activeClinicId,
    } as any);

    if (error) {
       toast({ title: "Erro ao publicar aviso", description: error.message, variant: "destructive" });
    } else {
       toast({ title: "Aviso publicado no mural dos pacientes!" });
       setTitulo("");
       setMensagem("");
       setImageUrl("");
       queryClient.invalidateQueries({ queryKey: ["admin-avisos"] });
       queryClient.invalidateQueries({ queryKey: ["avisos-ativos"] });
    }
    setIsSubmitting(false);
  };

  const toggleAtivo = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase.from("avisos").update({ ativo: !currentStatus }).eq("id", id);
    if (!error) {
      toast({ title: currentStatus ? "Aviso ocultado" : "Aviso reativado" });
      queryClient.invalidateQueries({ queryKey: ["admin-avisos"] });
    }
  };

  const deleteAviso = async (id: string) => {
    if (!confirm("Tem certeza que deseja apagar este aviso permanentemente?")) return;
    const { error } = await supabase.from("avisos").delete().eq("id", id);
    if (!error) {
      toast({ title: "Aviso excluído" });
      queryClient.invalidateQueries({ queryKey: ["admin-avisos"] });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-[Plus_Jakarta_Sans] flex items-center gap-2">
          <Megaphone className="h-6 w-6 text-primary" /> Mural de Avisos
        </h1>
        <p className="text-muted-foreground">
          Gerencie os avisos que aparecem no portal de todos os pacientes.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Novo Aviso</CardTitle>
            <CardDescription>Escreva uma mensagem para exibir aos pacientes.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="titulo">Título</Label>
                <Input 
                  id="titulo" 
                  placeholder="Ex: Recesso de Carnaval" 
                  value={titulo} 
                  onChange={(e) => setTitulo(e.target.value)} 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mensagem">Mensagem</Label>
                <Textarea 
                  id="mensagem" 
                  className="min-h-[120px]"
                  placeholder="Escreva os detalhes do aviso aqui..."
                  value={mensagem} 
                  onChange={(e) => setMensagem(e.target.value)} 
                />
              </div>
              <div className="space-y-2">
                <Label>Imagem (opcional)</Label>
                <ImageUpload value={imageUrl} onChange={setImageUrl} folder="avisos" />
              </div>
              <Button type="submit" disabled={isSubmitting} className="w-full">
                <Plus className="h-4 w-4 mr-2" /> 
                {isSubmitting ? "Publicando..." : "Publicar Aviso"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
           {isLoading ? (
             <p className="text-muted-foreground animate-pulse px-2">Carregando avisos...</p>
           ) : avisos.length === 0 ? (
             <div className="bg-card border rounded-lg p-6 text-center text-muted-foreground">
               Nenhum aviso publicado ainda.
             </div>
           ) : (
             avisos.map((aviso) => (
               <Card key={aviso.id} className={aviso.ativo ? "border-l-4 border-l-primary" : "opacity-60"}>
                 <CardContent className="p-4">
                   <div className="flex justify-between items-start mb-2">
                     <h3 className="font-bold">{aviso.titulo}</h3>
                     <span className="text-xs text-muted-foreground">
                       {format(new Date(aviso.created_at), "dd/MM/yyyy HH:mm")}
                     </span>
                   </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap mb-3">
                      {aviso.mensagem}
                    </p>
                    {(aviso as any).image_url && (
                      <img src={(aviso as any).image_url} alt={aviso.titulo} className="rounded-lg max-h-48 object-cover mb-3" />
                    )}
                   <div className="flex items-center gap-2 justify-end">
                     <Button 
                       variant={aviso.ativo ? "outline" : "secondary"} 
                       size="sm"
                       onClick={() => toggleAtivo(aviso.id, aviso.ativo)}
                     >
                       {aviso.ativo ? "Ocultar" : "Mostrar"}
                     </Button>
                     <Button 
                       variant="destructive" 
                       size="icon" 
                       className="h-9 w-9"
                       onClick={() => deleteAviso(aviso.id)}
                     >
                       <Trash2 className="h-4 w-4" />
                     </Button>
                   </div>
                 </CardContent>
               </Card>
             ))
           )}
        </div>
      </div>
    </div>
  );
};

export default AvisosAdmin;
