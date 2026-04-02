import { useState } from "react";
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
