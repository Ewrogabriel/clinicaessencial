import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp } from "lucide-react";

interface PatientProdutosTabProps {
  produtosDisponiveis: any[];
  onReservar: (produto: any) => void;
}

export const PatientProdutosTab = ({ produtosDisponiveis, onReservar }: PatientProdutosTabProps) => {
  return (
    <div className="space-y-4">
      {produtosDisponiveis.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <p className="text-sm">Nenhum produto disponível no momento.</p>
          </CardContent>
        </Card>
      ) : (
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
                <div key={produto.id} className="p-4 rounded-lg border border-blue-200 bg-background hover:border-blue-400 transition-colors">
                  <div className="mb-3">
                    <h4 className="font-semibold text-sm mb-1 line-clamp-2">{produto.nome}</h4>
                    {produto.descricao && <p className="text-xs text-muted-foreground line-clamp-2">{produto.descricao}</p>}
                  </div>
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="text-lg font-bold text-blue-600">R$ {Number(produto.preco).toFixed(2)}</span>
                    <span className="text-xs text-muted-foreground">{produto.estoque} em estoque</span>
                  </div>
                  <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700"
                    onClick={() => onReservar(produto)}>
                    Reservar Agora
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
