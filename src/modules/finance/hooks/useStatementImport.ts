import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { statementImportService } from "../services/statementImportService";
import type {
  BankStatementTransaction,
  ImportValidationResult,
  ImportResult,
} from "../types";

export type ImportStep = "idle" | "parsing" | "preview" | "importing" | "done";

export function useStatementImport() {
  const { activeClinicId } = useClinic();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<ImportStep>("idle");
  const [parsedData, setParsedData] = useState<BankStatementTransaction[]>([]);
  const [validation, setValidation] = useState<ImportValidationResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parseFile = async (file: File) => {
    setStep("parsing");
    setError(null);
    try {
      const raw = await statementImportService.parseFile(file);
      const result = statementImportService.validateTransactions(raw);
      setParsedData(raw);
      setValidation(result);
      setStep("preview");
    } catch (e) {
      setError((e as Error).message ?? "Erro ao processar arquivo.");
      setStep("idle");
    }
  };

  const importTransactions = async (accountId: string) => {
    if (!activeClinicId || !validation) return;
    setStep("importing");
    setError(null);
    try {
      const result = await statementImportService.saveBankTransactions(
        activeClinicId,
        accountId,
        validation.valid
      );
      setImportResult(result);
      setStep("done");
      queryClient.invalidateQueries({ queryKey: ["reconciliation-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["reconciliation-stats"] });
    } catch (e) {
      setError((e as Error).message ?? "Erro ao importar transações.");
      setStep("preview");
    }
  };

  const reset = () => {
    setStep("idle");
    setParsedData([]);
    setValidation(null);
    setImportResult(null);
    setError(null);
  };

  return {
    step,
    parsedData,
    validation,
    importResult,
    error,
    parseFile,
    importTransactions,
    reset,
  };
}
