import { supabase } from "@/integrations/supabase/client";
import { handleError } from "@/modules/shared/utils/errorHandler";
import type {
  BankStatementTransaction,
  ImportValidationResult,
  ImportResult,
} from "../types";

// ──────────────────────────────────────────────
// CSV Parser
// ──────────────────────────────────────────────

function parseDate(raw: string): string | null {
  // Accepts DD/MM/YYYY or YYYY-MM-DD
  if (!raw) return null;
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  const brMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  return null;
}

function parseValue(raw: string): number | null {
  if (!raw) return null;
  // Remove BRL formatting: "R$ 1.234,56" → 1234.56
  const cleaned = raw
    .replace(/[R$\s]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const val = parseFloat(cleaned);
  return isNaN(val) ? null : val;
}

function parseCsvRows(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  return lines.map((line) => {
    const cols: string[] = [];
    let inQuote = false;
    let current = "";
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuote = !inQuote;
      } else if ((ch === "," || ch === ";") && !inQuote) {
        cols.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    cols.push(current.trim());
    return cols;
  });
}

function detectCsvColumns(headers: string[]): {
  date: number;
  desc: number;
  value: number;
  doc?: number;
  balance?: number;
} | null {
  const h = headers.map((s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
  const find = (...terms: string[]) =>
    h.findIndex((col) => terms.some((t) => col.includes(t)));

  const date = find("data", "date");
  const desc = find("descricao", "descri", "historico", "memo", "nome", "description");
  const value = find("valor", "value", "amount", "credito", "debito");
  if (date === -1 || desc === -1 || value === -1) return null;

  return {
    date,
    desc,
    value,
    doc: find("documento", "doc", "id") > -1 ? find("documento", "doc", "id") : undefined,
    balance: find("saldo", "balance") > -1 ? find("saldo", "balance") : undefined,
  };
}

async function parseCSV(file: File): Promise<BankStatementTransaction[]> {
  const text = await file.text();
  const rows = parseCsvRows(text);
  if (rows.length < 2) return [];

  const cols = detectCsvColumns(rows[0]);
  if (!cols) throw new Error("Formato de CSV não reconhecido. Verifique se o arquivo contém colunas de data, descrição e valor.");

  const txs: BankStatementTransaction[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const date = parseDate(row[cols.date] ?? "");
    const valor = parseValue(row[cols.value] ?? "");
    const descricao = row[cols.desc] ?? "";

    if (!date || valor === null || !descricao) continue;

    txs.push({
      data_transacao: date,
      descricao,
      valor,
      tipo: valor >= 0 ? "credito" : "debito",
      documento: cols.doc !== undefined ? (row[cols.doc] ?? undefined) : undefined,
      saldo: cols.balance !== undefined ? (parseValue(row[cols.balance] ?? "") ?? undefined) : undefined,
      dados_originais: Object.fromEntries(
        rows[0].map((h, idx) => [h, row[idx]])
      ) as Record<string, unknown>,
    });
  }
  return txs;
}

// ──────────────────────────────────────────────
// OFX Parser (basic)
// ──────────────────────────────────────────────

async function parseOFX(file: File): Promise<BankStatementTransaction[]> {
  const text = await file.text();
  const txRegex =
    /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  const results: BankStatementTransaction[] = [];

  let match: RegExpExecArray | null;
  while ((match = txRegex.exec(text)) !== null) {
    const block = match[1];
    const get = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}>([^<\\n]+)`, "i"));
      return m ? m[1].trim() : "";
    };

    const dtPosted = get("DTPOSTED");
    const trnamt = get("TRNAMT");
    const memo = get("MEMO") || get("NAME") || "";
    const checkNum = get("CHECKNUM") || get("FITID") || "";

    const rawDate = dtPosted.slice(0, 8); // YYYYMMDD
    const date =
      rawDate.length === 8
        ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
        : null;
    const valor = parseFloat(trnamt.replace(",", "."));

    if (!date || isNaN(valor) || !memo) continue;

    results.push({
      data_transacao: date,
      descricao: memo,
      valor,
      tipo: valor >= 0 ? "credito" : "debito",
      documento: checkNum || undefined,
      dados_originais: { dtPosted, trnamt, memo, checkNum },
    });
  }

  return results;
}

// ──────────────────────────────────────────────
// Validation
// ──────────────────────────────────────────────

function validateTransactions(
  transactions: BankStatementTransaction[]
): ImportValidationResult {
  const valid: BankStatementTransaction[] = [];
  const invalid: ImportValidationResult["invalid"] = [];

  transactions.forEach((tx, idx) => {
    const rowNum = idx + 2; // row 1 is headers
    if (!tx.data_transacao) {
      invalid.push({ row: rowNum, reason: "Data inválida", raw: tx });
    } else if (tx.valor === undefined || tx.valor === null || isNaN(tx.valor)) {
      invalid.push({ row: rowNum, reason: "Valor inválido", raw: tx });
    } else if (!tx.descricao?.trim()) {
      invalid.push({ row: rowNum, reason: "Descrição vazia", raw: tx });
    } else {
      valid.push(tx);
    }
  });

  return { valid, invalid, total: transactions.length };
}

// ──────────────────────────────────────────────
// Save to Supabase
// ──────────────────────────────────────────────

async function saveBankTransactions(
  clinicId: string,
  accountId: string,
  transactions: BankStatementTransaction[]
): Promise<ImportResult> {
  const batchId = crypto.randomUUID();

  const rows = transactions.map((tx) => ({
    clinic_id: clinicId,
    bank_account_id: accountId,
    data_transacao: tx.data_transacao,
    descricao: tx.descricao,
    valor: tx.valor,
    tipo: tx.tipo ?? (tx.valor >= 0 ? "credito" : "debito"),
    documento: tx.documento ?? null,
    saldo: tx.saldo ?? null,
    dados_originais: tx.dados_originais ?? null,
    import_batch_id: batchId,
    status: "pendente",
  }));

  try {
    const { error } = await (supabase as any)
      .from("bank_transactions")
      .insert(rows);
    if (error) throw error;

    return { imported: rows.length, skipped: 0, batchId };
  } catch (error) {
    handleError(error, "Erro ao salvar transações importadas.");
    throw error;
  }
}

export const statementImportService = {
  parseCSV,
  parseOFX,
  validateTransactions,
  saveBankTransactions,

  async parseFile(file: File): Promise<BankStatementTransaction[]> {
    const name = file.name.toLowerCase();
    if (name.endsWith(".csv")) return parseCSV(file);
    if (name.endsWith(".ofx") || name.endsWith(".qfx")) return parseOFX(file);
    // For Excel we do a best-effort CSV parse (user can export as CSV first)
    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      throw new Error(
        "Para arquivos Excel, por favor exporte como CSV e importe novamente."
      );
    }
    throw new Error("Formato não suportado. Use CSV ou OFX.");

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
