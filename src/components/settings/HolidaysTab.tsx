import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Trash2, Calendar, Save } from "lucide-react";
import { toast } from "@/modules/shared/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Feriado {
  id: string;
  nome: string;
  data: string;
  tipo: 'feriado' | 'recesso';
}

export const HolidaysTab = ({ clinicId }: { clinicId: string }) => {
  const queryClient = useQueryClient();
  const [newHoliday, setNewHoliday] = useState({ nome: "", data: "", tipo: "feriado" });

  const { data: feriados = [], isLoading } = useQuery({
    queryKey: ["clinic-holidays", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recesso_clinica")
        .select("*")
        .eq("clinic_id", clinicId)
        .order("data_inicio");
      if (error) throw error;
      return (data || []).map((d: any) => ({
        id: d.id,
        nome: d.motivo,
        data: d.data_inicio,
        tipo: "feriado" // assuming fixed for now or add a column if needed
      }));
    },
    enabled: !!clinicId,
  });

  const saveMutation = useMutation({
    mutationFn: async (h: any) => {
      const { error } = await supabase.from("recesso_clinica").insert({
        clinic_id: clinicId,
        motivo: h.nome,
        data_inicio: h.data,
        data_fim: h.data,
        created_by: (await supabase.auth.getUser()).data.user?.id || ""
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clinic-holidays"] });
      setNewHoliday({ nome: "", data: "", tipo: "feriado" });
      toast({ title: "Evento adicionado!" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("recesso_clinica").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clinic-holidays"] });
      toast({ title: "Evento removido." });
    },
  });

  const fetchHolidaysAI = async () => {
    toast({ title: "🤖 Buscando feriados nacionais..." });
    try {
      const year = new Date().getFullYear();
      console.log(`Buscando feriados para o ano: ${year}`);
      
      const res = await fetch(`https://brasilapi.com.br/api/feriados/v1/${year}`);
      
      if (!res.ok) {
        throw new Error(`Erro na API: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      console.log("Dados recebidos da BrasilAPI:", data);
      
      if (Array.isArray(data) && data.length > 0) {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id || "";

        const toInsert = data.map((f: any) => ({
          clinic_id: clinicId,
          motivo: f.name,
          data_inicio: f.date,
          data_fim: f.date,
          created_by: userId
        }));

        console.log(`Tentando inserir ${toInsert.length} feriados no banco...`);
        const { error } = await supabase.from("recesso_clinica").insert(toInsert);
        
        if (error) {
          console.error("Erro Supabase ao inserir feriados:", error);
          throw error;
        }
        
        queryClient.invalidateQueries({ queryKey: ["clinic-holidays"] });
        toast({ title: "Feriados nacionais importados com sucesso!" });
      } else {
        console.warn("Nenhum feriado retornado pela API ou formato inválido.");
        toast({ title: "Nenhum feriado encontrado para este ano.", variant: "destructive" });
      }
    } catch (err: any) {
      console.error("Falha completa na importação de feriados:", err);
      toast({ 
        title: "Erro ao importar feriados", 
        description: err.message || "Verifique o console para mais detalhes.",
        variant: "destructive" 
      });
    }
  };

  if (isLoading) return <div>Carregando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Feriados e Recessos</h3>
        <Button onClick={fetchHolidaysAI} variant="outline" className="text-purple-600 border-purple-200 bg-purple-50">
          <Sparkles className="h-4 w-4 mr-2" /> Importar Feriados com IA
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-4 gap-4 items-end">
            <div className="col-span-2">
              <Label>Descrição</Label>
              <Input value={newHoliday.nome} onChange={(e) => setNewHoliday({ ...newHoliday, nome: e.target.value })} placeholder="Ex: Natal" />
            </div>
            <div>
              <Label>Data</Label>
              <Input type="date" value={newHoliday.data} onChange={(e) => setNewHoliday({ ...newHoliday, data: e.target.value })} />
            </div>
            <Button onClick={() => saveMutation.mutate(newHoliday)} disabled={!newHoliday.nome || !newHoliday.data}> Adicionar </Button>
          </div>
        </CardContent>
      </Card>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr className="text-left">
              <th className="p-3 font-medium">Evento</th>
              <th className="p-3 font-medium">Data</th>
              <th className="p-3 font-medium text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {feriados.length === 0 ? (
              <tr><td colSpan={3} className="p-8 text-center text-muted-foreground">Nenhum feriado cadastrado.</td></tr>
            ) : (
              feriados.map((h: any) => (
                <tr key={h.id} className="border-t">
                  <td className="p-3">{h.nome}</td>
                  <td className="p-3">{format(new Date(h.data), "dd/MM/yyyy", { locale: ptBR })}</td>
                  <td className="p-3 text-right">
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(h.id)} className="text-destructive h-8 w-8">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
