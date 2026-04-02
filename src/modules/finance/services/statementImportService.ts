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
  // Remove currency symbols and spaces
  let cleaned = raw.replace(/[R$\s]/g, "");
  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");

  if (hasComma && hasDot) {
    // Both present: the last-occurring separator is the decimal
    if (cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")) {
      // Brazilian format: 1.234,56 → 1234.56
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      // US format: 1,234.56 → 1234.56
      cleaned = cleaned.replace(/,/g, "");
    }
  } else if (hasComma) {
    // Comma only: treat comma as decimal separator (e.g. 123,50 or -150,00)
    cleaned = cleaned.replace(",", ".");
  }
  // else: dot only or no separator → parse as-is (e.g. 500.00)

  const val = parseFloat(cleaned);
  return isNaN(val) ? null : val;
}

function detectDelimiter(headerLine: string): "," | ";" {
  const semicolons = (headerLine.match(/;/g) ?? []).length;
  const commas = (headerLine.match(/,/g) ?? []).length;
  return semicolons > commas ? ";" : ",";
}

function parseCsvRows(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];
  const delimiter = detectDelimiter(lines[0]);
  return lines.map((line) => {
    const cols: string[] = [];
    let inQuote = false;
    let current = "";
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuote = !inQuote;
      } else if (ch === delimiter && !inQuote) {
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
  },
};
