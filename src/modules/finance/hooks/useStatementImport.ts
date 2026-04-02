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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import {
  statementImportService,
  ParsedTransaction,
  ImportResult,
} from "../services/statementImportService";

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
      // Refresh reconciliation data
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
  const [preview, setPreview] = useState<ParsedTransaction[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["reconciliation-transactions", activeClinicId] });
    queryClient.invalidateQueries({ queryKey: ["reconciliation-stats", activeClinicId] });
  };

  const parseFile = (file: File): Promise<ParsedTransaction[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const ext = file.name.split(".").pop()?.toLowerCase();
        try {
          let parsed: ParsedTransaction[] = [];
          if (ext === "ofx" || ext === "qfx") {
            parsed = statementImportService.parseOFX(content);
          } else {
            parsed = statementImportService.parseCSV(content);
          }
          resolve(parsed);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error("Falha ao ler arquivo."));
      reader.readAsText(file, "utf-8");
    });
  };

  const loadPreview = async (file: File) => {
    setParseError(null);
    setPreview([]);
    try {
      const parsed = await parseFile(file);
      setPreview(parsed);
      return parsed;
    } catch {
      setParseError("Não foi possível analisar o arquivo. Verifique o formato.");
      return [];
    }
  };

  const importMutation = useMutation<
    ImportResult,
    Error,
    { transactions: ParsedTransaction[]; bankAccountId: string }
  >({
    mutationFn: ({ transactions, bankAccountId }) =>
      statementImportService.saveBankTransactions(
        transactions,
        bankAccountId,
        activeClinicId
      ),
    onSuccess: () => {
      invalidate();
      setPreview([]);
    },
  });

  const resetPreview = () => {
    setPreview([]);
    setParseError(null);
  };

  return {
    preview,
    parseError,
    loadPreview,
    importTransactions: importMutation.mutateAsync,
    isImporting: importMutation.isPending,
    importResult: importMutation.data,
    resetPreview,
  };
}
