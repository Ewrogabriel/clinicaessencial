import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Trash2, Plus } from "lucide-react";
import { toast } from "@/modules/shared/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

/** Parse a YYYY-MM-DD string as local date (avoids UTC offset shifting the day) */
const parseLocalDate = (dateStr: string) => {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
};

export const HolidaysTab = ({ clinicId }: { clinicId: string }) => {
  const queryClient = useQueryClient();
  const [newEvent, setNewEvent] = useState({ nome: "", data_inicio: "", data_fim: "" });

  const { data: eventos = [], isLoading } = useQuery({
    queryKey: ["clinic-holidays", clinicId],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("recesso_clinica") as any)
        .select("*")
        .eq("clinic_id", clinicId)
        .order("data_inicio");
      if (error) throw error;
      return data || [];
    },
    enabled: !!clinicId,
  });

  const saveMutation = useMutation({
    mutationFn: async (h: typeof newEvent) => {
      if (!clinicId) throw new Error("Selecione uma clínica antes de salvar.");
      const { error } = await (supabase.from("recesso_clinica" as any) as any).insert({
        clinic_id: clinicId,
        descricao: h.nome,
        data_inicio: h.data_inicio,
        data_fim: h.data_fim || h.data_inicio,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clinic-holidays"] });
      setNewEvent({ nome: "", data_inicio: "", data_fim: "" });
      toast({ title: "Evento adicionado!" });
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
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
    if (!clinicId) {
      toast({ title: "Selecione uma clínica primeiro", variant: "destructive" });
      return;
    }
    toast({ title: "🤖 Buscando feriados nacionais..." });
    try {
      const year = new Date().getFullYear();
      const res = await fetch(`https://brasilapi.com.br/api/feriados/v1/${year}`);
      if (!res.ok) throw new Error(`Erro na API: ${res.status}`);

      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const toInsert = data.map((f: any) => ({
          clinic_id: clinicId,
          descricao: f.name,
          data_inicio: f.date,
          data_fim: f.date,
        }));

        const { error } = await (supabase.from("recesso_clinica" as any) as any).insert(toInsert);
        if (error) throw error;

        queryClient.invalidateQueries({ queryKey: ["clinic-holidays"] });
        toast({ title: `${toInsert.length} feriados nacionais importados!` });
      } else {
        toast({ title: "Nenhum feriado encontrado.", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Erro ao importar feriados", description: err.message, variant: "destructive" });
    }
  };

  if (isLoading) return <div className="p-4 text-muted-foreground">Carregando...</div>;

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
          <p className="text-sm text-muted-foreground font-medium">Adicionar Feriado ou Recesso</p>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div className="sm:col-span-2">
              <Label>Descrição *</Label>
              <Input
                value={newEvent.nome}
                onChange={(e) => setNewEvent({ ...newEvent, nome: e.target.value })}
                placeholder="Ex: Recesso de Fim de Ano"
              />
            </div>
            <div>
              <Label>Data Início *</Label>
              <Input
                type="date"
                value={newEvent.data_inicio}
                onChange={(e) => setNewEvent({ ...newEvent, data_inicio: e.target.value, data_fim: e.target.value })}
              />
            </div>
            <div>
              <Label>Data Fim (recesso)</Label>
              <Input
                type="date"
                value={newEvent.data_fim}
                min={newEvent.data_inicio}
                onChange={(e) => setNewEvent({ ...newEvent, data_fim: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => saveMutation.mutate(newEvent)}
              disabled={!newEvent.nome || !newEvent.data_inicio || saveMutation.isPending}
              className="gap-2"
            >
              <Plus className="h-4 w-4" /> Adicionar
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr className="text-left">
              <th className="p-3 font-medium">Evento</th>
              <th className="p-3 font-medium">Data Início</th>
              <th className="p-3 font-medium">Data Fim</th>
              <th className="p-3 font-medium text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {eventos.length === 0 ? (
              <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Nenhum evento cadastrado.</td></tr>
            ) : (
              eventos.map((h: any) => (
                <tr key={h.id} className="border-t">
                  <td className="p-3 font-medium">
                    {h.descricao}
                    {h.data_inicio !== h.data_fim && (
                      <Badge variant="outline" className="ml-2 text-xs">Recesso</Badge>
                    )}
                  </td>
                  <td className="p-3">
                    {h.data_inicio ? format(parseLocalDate(h.data_inicio), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                  </td>
                  <td className="p-3">
                    {h.data_fim && h.data_fim !== h.data_inicio
                      ? format(parseLocalDate(h.data_fim), "dd/MM/yyyy", { locale: ptBR })
                      : "—"}
                  </td>
                  <td className="p-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(h.id)}
                      className="text-destructive h-8 w-8"
                    >
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
