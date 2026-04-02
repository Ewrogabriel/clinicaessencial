import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Eye, XCircle } from "lucide-react";

interface ClinicRow {
  id: string;
  nome: string;
  cnpj: string | null;
  ativo: boolean;
  status?: string;
  plan_nome?: string;
  total_patients?: number;
  [key: string]: unknown;
}

interface ClinicTableProps {
  clinics: ClinicRow[];
  onActivate: (id: string) => void;
  onDeactivate: (id: string) => void;
  onViewDetails: (clinic: ClinicRow) => void;
  isLoading?: boolean;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ativa: "default",
  trial: "outline",
  suspensa: "secondary",
  cancelada: "destructive",
};

export function ClinicTable({
  clinics,
  onActivate,
  onDeactivate,
  onViewDetails,
  isLoading,
}: ClinicTableProps) {
  if (isLoading) {
    return (
      <div className="py-12 text-center text-muted-foreground text-sm">
        Carregando clínicas…
      </div>
    );
  }

  if (clinics.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground text-sm">
        Nenhuma clínica encontrada.
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>CNPJ</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Plano</TableHead>
            <TableHead className="text-right">Pacientes</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clinics.map((clinic) => {
            const statusKey = clinic.status ?? (clinic.ativo ? "ativa" : "suspensa");
            return (
              <TableRow key={clinic.id}>
                <TableCell className="font-medium">{clinic.nome}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {clinic.cnpj ?? "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[statusKey] ?? "secondary"}>
                    {statusKey}
                  </Badge>
                </TableCell>
                <TableCell>
                  {clinic.plan_nome ? (
                    <Badge variant="outline">{clinic.plan_nome}</Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">Sem plano</span>
                  )}
                </TableCell>
                <TableCell className="text-right text-sm">
                  {clinic.total_patients ?? "—"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Ver detalhes"
                      onClick={() => onViewDetails(clinic)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {clinic.ativo ? (
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Desativar"
                        onClick={() => onDeactivate(clinic.id)}
                      >
                        <XCircle className="h-4 w-4 text-destructive" />
                      </Button>
                    ) : (
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Ativar"
                        onClick={() => onActivate(clinic.id)}
                      >
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
