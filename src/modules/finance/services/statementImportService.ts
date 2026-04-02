import { supabase } from "@/integrations/supabase/client";
import { handleError } from "@/modules/shared/utils/errorHandler";

export interface ParsedTransaction {
  data_transacao: string;
  descricao: string;
  valor: number;
  documento?: string;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: number;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if ((ch === "," || ch === ";") && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function normalizeDate(raw: string): string | null {
  // Accept dd/mm/yyyy or yyyy-mm-dd
  const ddmm = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (ddmm) return `${ddmm[3]}-${ddmm[2]}-${ddmm[1]}`;
  const iso = raw.match(/^\d{4}-\d{2}-\d{2}$/);
  if (iso) return raw;
  return null;
}

function normalizeValue(raw: string): number | null {
  // Remove currency symbols and spaces
  let cleaned = raw.replace(/[R$\s]/g, "");
  // Detect format: if ends with ,XX (2 digits after comma), treat comma as decimal
  if (/,\d{2}$/.test(cleaned)) {
    // Brazilian format: 1.234,56 → remove dots, replace comma with dot
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else {
    // US/ISO format: 1,234.56 → remove commas
    cleaned = cleaned.replace(/,/g, "");
  }
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

export const statementImportService = {
  /**
   * Parse a CSV/text file into transactions.
   * Expected columns (flexible order detection):
   * data, descricao/historico/memo, valor/debito/credito, documento/doc
   */
  parseCSV(content: string): ParsedTransaction[] {
    const lines = content.split(/\r?\n/).filter((l) => l.trim() !== "");
    if (lines.length < 2) return [];

    const header = parseCSVLine(lines[0]).map((h) => h.toLowerCase().replace(/['"]/g, "").trim());

    const colData = header.findIndex((h) => h.includes("data") || h.includes("date"));
    const colDesc = header.findIndex(
      (h) =>
        h.includes("descri") ||
        h.includes("histori") ||
        h.includes("memo") ||
        h.includes("lançamento") ||
        h.includes("lancamento")
    );
    const colValor = header.findIndex(
      (h) =>
        h.includes("valor") ||
        h.includes("value") ||
        h.includes("amount") ||
        h.includes("débito") ||
        h.includes("debito") ||
        h.includes("crédito") ||
        h.includes("credito")
    );
    const colDoc = header.findIndex(
      (h) => h.includes("doc") || h.includes("nsu") || h.includes("num")
    );

    if (colData === -1 || colDesc === -1 || colValor === -1) return [];

    const transactions: ParsedTransaction[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      const rawDate = cols[colData]?.replace(/['"]/g, "").trim();
      const rawDesc = cols[colDesc]?.replace(/['"]/g, "").trim();
      const rawValor = cols[colValor]?.replace(/['"]/g, "").trim();
      const rawDoc = colDoc >= 0 ? cols[colDoc]?.replace(/['"]/g, "").trim() : undefined;

      const date = normalizeDate(rawDate ?? "");
      const valor = normalizeValue(rawValor ?? "");

      if (!date || valor === null || !rawDesc) continue;

      transactions.push({
        data_transacao: date,
        descricao: rawDesc,
        valor,
        documento: rawDoc || undefined,
      });
    }

    return transactions;
  },

  /**
   * Parse an OFX file into transactions.
   */
  parseOFX(content: string): ParsedTransaction[] {
    const transactions: ParsedTransaction[] = [];
    const stmtTrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
    let match: RegExpExecArray | null;

    const getTag = (block: string, tag: string): string | null => {
      const re = new RegExp(`<${tag}>([^<]+)`, "i");
      const m = block.match(re);
      return m ? m[1].trim() : null;
    };

    while ((match = stmtTrnRegex.exec(content)) !== null) {
      const block = match[1];
      const dtposted = getTag(block, "DTPOSTED");
      const trnamt = getTag(block, "TRNAMT");
      const memo = getTag(block, "MEMO") || getTag(block, "NAME") || "";
      const checknum = getTag(block, "CHECKNUM") || getTag(block, "FITID") || undefined;

      if (!dtposted || !trnamt) continue;

      // OFX date: YYYYMMDD or YYYYMMDDHHMMSS
      const year = dtposted.substring(0, 4);
      const month = dtposted.substring(4, 6);
      const day = dtposted.substring(6, 8);
      const date = `${year}-${month}-${day}`;

      const valor = parseFloat(trnamt.replace(",", "."));
      if (isNaN(valor)) continue;

      transactions.push({
        data_transacao: date,
        descricao: memo,
        valor,
        documento: checknum,
      });
    }

    return transactions;
  },

  /**
   * Save parsed transactions to bank_transactions table.
   */
  async saveBankTransactions(
    transactions: ParsedTransaction[],
    bankAccountId: string,
    clinicId: string | null
  ): Promise<ImportResult> {
    let imported = 0;
    let skipped = 0;
    let errors = 0;

    const batchId = crypto.randomUUID();

    for (const tx of transactions) {
      try {
        const { error } = await (supabase as any)
          .from("bank_transactions")
          .insert({
            data_transacao: tx.data_transacao,
            descricao: tx.descricao,
            valor: tx.valor,
            documento: tx.documento || null,
            status: "pendente",
            tipo: tx.valor >= 0 ? "credito" : "debito",
            bank_account_id: bankAccountId,
            clinic_id: clinicId,
            import_batch_id: batchId,
          });

        if (error) {
          // Duplicate check (unique constraint violation)
          if (error.code === "23505") {
            skipped++;
          } else {
            errors++;
          }
        } else {
          imported++;
        }
      } catch {
        errors++;
      }
    }

    return { imported, skipped, errors };
  },

  /**
   * Import CSV file content and save to DB.
   */
  async importCSV(
    content: string,
    bankAccountId: string,
    clinicId: string | null
  ): Promise<ImportResult> {
    try {
      const transactions = statementImportService.parseCSV(content);
      if (transactions.length === 0) {
        return { imported: 0, skipped: 0, errors: 0 };
      }
      return statementImportService.saveBankTransactions(transactions, bankAccountId, clinicId);
    } catch (error) {
      handleError(error, "Erro ao importar CSV.");
      throw error;
    }
  },

  /**
   * Import OFX file content and save to DB.
   */
  async importOFX(
    content: string,
    bankAccountId: string,
    clinicId: string | null
  ): Promise<ImportResult> {
    try {
      const transactions = statementImportService.parseOFX(content);
      if (transactions.length === 0) {
        return { imported: 0, skipped: 0, errors: 0 };
      }
      return statementImportService.saveBankTransactions(transactions, bankAccountId, clinicId);
    } catch (error) {
      handleError(error, "Erro ao importar OFX.");
      throw error;
    }
  },
};
