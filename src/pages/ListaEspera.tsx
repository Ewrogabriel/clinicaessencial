import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Clock, ArrowRightLeft, UserPlus } from "lucide-react";
import WaitingListTab from "@/components/lista-espera/WaitingListTab";
import AddEntryDialog from "@/components/lista-espera/AddEntryDialog";
import { useClinic } from "@/hooks/useClinic";

const ListaEspera = () => {
  const { isAdmin, isGestor, isProfissional } = useAuth();
  const { activeClinicId } = useClinic();
  const canManage = isAdmin || isGestor || isProfissional;
  const [activeTab, setActiveTab] = useState("espera");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTipo, setDialogTipo] = useState<"espera" | "interesse_mudanca" | "interesse_novo">("espera");

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["lista-espera", activeClinicId],
    queryFn: async () => {
      let query = supabase.from("lista_espera")
        .select("*, pacientes(nome, telefone), matriculas(tipo_atendimento, status)");
      if (activeClinicId) query = query.eq("clinic_id", activeClinicId);
      const { data, error } = await query.order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const interesseMudanca = entries.filter((e: any) => e.tipo === "interesse_mudanca" && e.status === "aguardando");
  const interesseNovo = entries.filter((e: any) => e.tipo === "interesse_novo" && e.status === "aguardando");
  const espera = entries.filter((e: any) => (e.tipo === "espera" || !e.tipo) && e.status === "aguardando");

  const openDialog = (tipo: "espera" | "interesse_mudanca" | "interesse_novo") => {
    setDialogTipo(tipo);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-[Plus_Jakarta_Sans]">Lista de Espera & Interesses</h1>
          <p className="text-muted-foreground">
            {espera.length} aguardando vaga • {interesseMudanca.length} mudança de horário • {interesseNovo.length} novos interessados
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="espera" className="gap-1.5 text-xs">
            <Clock className="h-3.5 w-3.5" /> Espera
          </TabsTrigger>
          <TabsTrigger value="interesse_mudanca" className="gap-1.5 text-xs">
            <ArrowRightLeft className="h-3.5 w-3.5" /> Mudança
          </TabsTrigger>
          <TabsTrigger value="interesse_novo" className="gap-1.5 text-xs">
            <UserPlus className="h-3.5 w-3.5" /> Novos
          </TabsTrigger>
        </TabsList>

        <div className="mt-4">
          {canManage && (
            <div className="flex justify-end mb-4">
              <Button onClick={() => openDialog(activeTab as any)} className="gap-2">
                <Plus className="h-4 w-4" />
                {activeTab === "espera" ? "Adicionar à Espera" :
                 activeTab === "interesse_mudanca" ? "Registrar Mudança" :
                 "Registrar Novo Interesse"}
              </Button>
            </div>
          )}

          <Card>
            <CardContent className="p-0">
              <TabsContent value="espera" className="m-0">
                <WaitingListTab entries={entries} isLoading={isLoading} canManage={canManage} tipo="espera"
                  emptyMessage="Lista de espera vazia" emptySubMessage="Nenhum paciente aguardando vaga no momento." />
              </TabsContent>
              <TabsContent value="interesse_mudanca" className="m-0">
                <WaitingListTab entries={entries} isLoading={isLoading} canManage={canManage} tipo="interesse_mudanca"
                  emptyMessage="Nenhum interesse de mudança" emptySubMessage="Nenhum paciente quer mudar de horário no momento." />
              </TabsContent>
              <TabsContent value="interesse_novo" className="m-0">
                <WaitingListTab entries={entries} isLoading={isLoading} canManage={canManage} tipo="interesse_novo"
                  emptyMessage="Nenhum novo interessado" emptySubMessage="Nenhum paciente novo aguardando matrícula." />
              </TabsContent>
            </CardContent>
          </Card>
        </div>
      </Tabs>

      <AddEntryDialog open={dialogOpen} onOpenChange={setDialogOpen} tipo={dialogTipo} />
    </div>
  );
};

export default ListaEspera;
