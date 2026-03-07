import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface PatientProductsSectionProps {
  produtosDisponiveis: any[];
  patientId: string | null;
  profileName: string | undefined;
}

export function PatientProductsSection({
  produtosDisponiveis,
  patientId,
  profileName,
}: PatientProductsSectionProps) {
  const queryClient = useQueryClient();
  const [selectedProduto, setSelectedProduto] = useState<any>(null);
  const [observacao, setObservacao] = useState("");
  const [isReservaDialogOpen, setIsReservaDialogOpen] = useState(false);

  const reservarProduto = useMutation({
    mutationFn: async () => {
      if (!patientId || !selectedProduto) throw new Error("Dados inválidos");
      
      const { data: reserva, error: reservaError } = await (supabase
        .from("reservas_produtos" as any) as any)
        .insert([{
          paciente_id: patientId,
          produto_id: selectedProduto.id,
          quantidade: 1,
          observacao: observacao || null,
          status: "pendente"
        }])
        .select()
        .single();
      
      if (reservaError) throw reservaError;

      const { error: avisoError } = await (supabase
        .from("avisos" as any) as any)
        .insert([{
          tipo: "reserva_produto",
          titulo: `Nova reserva de ${selectedProduto.nome}`,
          mensagem: `${profileName || "Paciente"} reservou ${selectedProduto.nome}${observacao ? ` - Observação: ${observacao}` : ""}`,
          reserva_id: reserva?.id,
          lido: false
        }]);
      
      if (avisoError) console.error("Erro ao criar aviso:", avisoError);
      
      return reserva;
    },
    onSuccess: () => {
      toast({ title: "Reserva realizada!", description: "Você receberá um contato para finalizar a compra." });
      setIsReservaDialogOpen(false);
      setSelectedProduto(null);
      setObservacao("");
      queryClient.invalidateQueries({ queryKey: ["produtos-disponiveis"] });
    },
    onError: (error) => {
      toast({ title: "Erro ao reservar", description: (error as any).message, variant: "destructive" });
    }
  });

  if (produtosDisponiveis.length === 0) {
    return null;
  }

  return (
    <>
      <Card className="border-blue-200 bg-blue-50/30">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            Produtos em Estoque
          </CardTitle>
          <CardDescription>Confira nossos produtos disponíveis para compra ou reserva</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {produtosDisponiveis.map((produto: any) => (
              <div key={produto.id} className="p-4 rounded-lg border border-blue-200 bg-white hover:border-blue-400 transition-colors">
                <div className="mb-3">
                  <h4 className="font-semibold text-sm mb-1 line-clamp-2">{produto.nome}</h4>
                  {produto.descricao && <p className="text-xs text-muted-foreground line-clamp-2">{produto.descricao}</p>}
                </div>
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-lg font-bold text-blue-600">
                    R$ {Number(produto.preco).toFixed(2)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {produto.estoque} em estoque
                  </span>
                </div>
                <Button
                  size="sm"
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  onClick={() => {
                    setSelectedProduto(produto);
                    setIsReservaDialogOpen(true);
                  }}
                >
                  Reservar Agora
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Reserva Produto Dialog */}
      {isReservaDialogOpen && selectedProduto && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Reservar {selectedProduto.nome}</CardTitle>
              <CardDescription>Preencha os dados para reservar este produto</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Preço</p>
                <p className="text-2xl font-bold text-blue-600">R$ {Number(selectedProduto.preco).toFixed(2)}</p>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Observação (opcional)</label>
                <textarea
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  placeholder="Adicione uma observação sobre sua reserva..."
                  rows={3}
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsReservaDialogOpen(false);
                    setSelectedProduto(null);
                    setObservacao("");
                  }}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  disabled={reservarProduto.isPending}
                  onClick={() => reservarProduto.mutate()}
                >
                  {reservarProduto.isPending ? "Reservando..." : "Confirmar Reserva"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                A clínica entrará em contato para finalizar a compra.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
