import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  TrendingUp,
  Plus,
  Link2,
  Unlink,
  Pencil,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Calendar,
  Building2,
  Percent,
} from "lucide-react";
import { formatBRL } from "@/modules/finance/utils/reconciliationHelpers";
import {
  useInvestmentDetection,
  useInvestmentReconciliation,
  useLinkedInvestment,
} from "@/modules/finance/hooks/useInvestmentReconciliation";
import { CreateInvestmentDialog } from "./CreateInvestmentDialog";
import { LinkInvestmentDialog } from "./LinkInvestmentDialog";
import { InvestmentBadge } from "./InvestmentBadge";
import type { BankTransactionRow } from "@/modules/finance/services/bankTransactionService";
import type { InvestmentMovementType } from "@/modules/finance/services/investmentDetectionService";
import type { CreateInvestmentFromTransactionDTO } from "@/modules/finance/services/investmentReconciliationService";
import { format } from "date-fns";

interface InvestmentLinkSectionProps {
  transaction: BankTransactionRow;
  clinicId: string;
}

export function InvestmentLinkSection({
  transaction,
  clinicId,
}: InvestmentLinkSectionProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [showLink, setShowLink] = useState(false);

  const { detection } = useInvestmentDetection(transaction);
  const { link, unlink, createFromTransaction, isLinking, isUnlinking, isCreating } =
    useInvestmentReconciliation();

  const { data: linkedInvestment, isLoading: isLoadingLinked } =
    useLinkedInvestment(transaction.investimento_id ?? null);

  const isLinked = !!transaction.investimento_id;
  const isBusy = isLinking || isUnlinking || isCreating;

  const handleCreate = async (dto: CreateInvestmentFromTransactionDTO) => {
    await createFromTransaction({ transactionId: transaction.id, dto });
    setShowCreate(false);
  };

  const handleLink = async (
    investimentoId: string,
    movementType: InvestmentMovementType
  ) => {
    await link({ transactionId: transaction.id, investimentoId, movementType });
    setShowLink(false);
  };

  const handleUnlink = async () => {
    await unlink(transaction.id);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-blue-600" />
        <span className="text-sm font-semibold">Integração com Investimentos</span>
        {isLinked && transaction.movement_type && (
          <InvestmentBadge movementType={transaction.movement_type} small />
        )}
      </div>

      <Separator />

      {/* Auto-detection suggestion */}
      {!isLinked && detection?.isLikelyInvestment && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-amber-800">
              💡 Parece uma transação de investimento
            </p>
            <p className="text-amber-700 text-xs mt-0.5">{detection.reason}</p>
            {detection.suggestedType.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {detection.suggestedType.slice(0, 3).map((t) => (
                  <Badge
                    key={t}
                    variant="outline"
                    className="text-xs border-amber-300 text-amber-700"
                  >
                    {t}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Linked state */}
      {isLinked ? (
        <div className="space-y-2">
          {isLoadingLinked ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando investimento...
            </div>
          ) : linkedInvestment ? (
            <div className="rounded-md border border-green-200 bg-green-50 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-800">
                    Vinculado a investimento
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className={
                    linkedInvestment.status === "ativo"
                      ? "border-green-400 text-green-700 text-xs"
                      : "border-gray-400 text-gray-600 text-xs"
                  }
                >
                  {linkedInvestment.status}
                </Badge>
              </div>

              <div className="text-sm space-y-1 text-green-700">
                <p className="font-medium text-green-900">{linkedInvestment.nome}</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                  <span className="text-muted-foreground">Tipo:</span>
                  <span>{linkedInvestment.tipo}</span>
                  {linkedInvestment.instituicao && (
                    <>
                      <span className="text-muted-foreground">Instituição:</span>
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {linkedInvestment.instituicao}
                      </span>
                    </>
                  )}
                  <span className="text-muted-foreground">Valor aplicado:</span>
                  <span>{formatBRL(Number(linkedInvestment.valor_aplicado))}</span>
                  {linkedInvestment.taxa_contratada && (
                    <>
                      <span className="text-muted-foreground">Taxa:</span>
                      <span className="flex items-center gap-1">
                        <Percent className="h-3 w-3" />
                        {linkedInvestment.taxa_contratada}%{" "}
                        {linkedInvestment.indexador
                          ? `(${linkedInvestment.percentual_indexador}% ${linkedInvestment.indexador})`
                          : ""}
                      </span>
                    </>
                  )}
                  {linkedInvestment.data_vencimento && (
                    <>
                      <span className="text-muted-foreground">Vencimento:</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(linkedInvestment.data_vencimento), "dd/MM/yyyy")}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Vinculado a investimento
              </div>
            </div>
          )}

          {/* Actions when linked */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleUnlink}
              disabled={isBusy}
              className="text-red-600 hover:text-red-700 hover:border-red-300"
            >
              {isUnlinking ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Unlink className="h-3 w-3 mr-1" />
              )}
              Desvincular
            </Button>
          </div>
        </div>
      ) : (
        /* Not linked state */
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Não vinculado a nenhum investimento
          </p>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreate(true)}
              disabled={isBusy}
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Criar Nova Aplicação
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowLink(true)}
              disabled={isBusy}
              className="gap-1.5"
            >
              <Link2 className="h-3.5 w-3.5" />
              Vincular Existente
            </Button>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <CreateInvestmentDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        transaction={transaction}
        onConfirm={handleCreate}
        isLoading={isCreating}
      />

      <LinkInvestmentDialog
        open={showLink}
        onOpenChange={setShowLink}
        clinicId={clinicId}
        transactionValue={transaction.valor}
        defaultMovementType={
          (detection?.movementType as InvestmentMovementType) ?? "aplicacao"
        }
        onConfirm={handleLink}
        isLoading={isLinking}
      />
    </div>
  );
}
