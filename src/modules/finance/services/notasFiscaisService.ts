import { supabase } from "@/integrations/supabase/client";

export type NotaFiscalStatus = "ativo" | "conflito" | "nao_identificado" | "erro";

export interface NotaFiscal {
  id: string;
  clinic_id: string | null;
  paciente_id: string | null;
  nome_arquivo: string;
  arquivo_path: string;
  mes_referencia: string;
  data_upload: string;
  status: string;
  hash_arquivo: string | null;
  tamanho_bytes: number | null;
  public_token: string | null;
  public_token_expires_at: string | null;
  enviado_em: string | null;
  enviado_via: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PacienteMatchCandidate {
  id: string;
  nome: string;
  cpf: string | null;
}

export interface BatchImportItem {
  file: File;
  matchedPacienteId: string | null;
  matchStatus: "matched" | "conflict" | "not_found";
  candidates: PacienteMatchCandidate[];
  hash: string;
  duplicate: boolean;
}

const BUCKET = "notas-fiscais";

/** Normaliza string para comparação (remove acentos, lowercase, sem caracteres especiais) */
function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Sanitiza nome de arquivo para storage */
function sanitizeFileName(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  const base = lastDot > 0 ? fileName.slice(0, lastDot) : fileName;
  const ext = lastDot > 0 ? fileName.slice(lastDot) : "";
  const cleanBase =
    base
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "") || "nota";
  const cleanExt = ext ? "." + ext.slice(1).toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  return cleanBase + cleanExt;
}

/** Calcula SHA-256 do arquivo (hex) */
async function sha256(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Tenta identificar pacientes pelo nome do arquivo (nome OU CPF) */
function findCandidates(
  fileName: string,
  pacientes: PacienteMatchCandidate[]
): PacienteMatchCandidate[] {
  // 1. tentar CPF
  const digits = fileName.replace(/\D/g, "");
  if (digits.length >= 11) {
    for (let i = 0; i <= digits.length - 11; i++) {
      const cpf = digits.slice(i, i + 11);
      const m = pacientes.filter(
        (p) => (p.cpf || "").replace(/\D/g, "") === cpf
      );
      if (m.length > 0) return m;
    }
  }

  // 2. tentar nome
  const baseName = fileName.replace(/\.[^.]+$/, "");
  const norm = normalize(baseName);
  if (!norm) return [];
  const tokens = norm.split(" ").filter((t) => t.length >= 3);
  if (tokens.length === 0) return [];

  // pacientes cujo nome contém pelo menos 2 tokens (ou todos se < 2)
  const required = Math.min(2, tokens.length);
  return pacientes.filter((p) => {
    const pn = normalize(p.nome);
    const matches = tokens.filter((t) => pn.includes(t)).length;
    return matches >= required;
  });
}

function genToken(): string {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const notasFiscaisService = {
  async listByPaciente(pacienteId: string): Promise<NotaFiscal[]> {
    const { data, error } = await supabase
      .from("notas_fiscais" as any)
      .select("*")
      .eq("paciente_id", pacienteId)
      .order("mes_referencia", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []) as any;
  },

  async listByClinic(clinicId: string, mes?: string): Promise<NotaFiscal[]> {
    let q = supabase
      .from("notas_fiscais" as any)
      .select("*")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false });
    if (mes) q = q.eq("mes_referencia", mes);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as any;
  },

  async getSignedUrl(path: string, expiresIn = 60): Promise<string> {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, expiresIn);
    if (error || !data?.signedUrl) throw error || new Error("URL não gerada");
    return data.signedUrl;
  },

  async uploadSingle(params: {
    clinicId: string;
    pacienteId: string;
    file: File;
    mesReferencia: string;
    uploadedBy: string;
  }): Promise<NotaFiscal> {
    const { clinicId, pacienteId, file, mesReferencia, uploadedBy } = params;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      throw new Error("Apenas arquivos PDF são permitidos.");
    }
    const hash = await sha256(file);

    // Dedup: mesma clinica + mesmo hash
    const { data: existing } = await supabase
      .from("notas_fiscais" as any)
      .select("id")
      .eq("clinic_id", clinicId)
      .eq("hash_arquivo", hash)
      .maybeSingle();
    if (existing) {
      throw new Error("Esta nota fiscal já foi importada anteriormente.");
    }

    const safeName = sanitizeFileName(file.name);
    const path = `${clinicId}/${pacienteId}/${Date.now()}_${safeName}`;

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: "application/pdf" });
    if (upErr) throw new Error(`Erro no upload: ${upErr.message}`);

    const { data, error } = await supabase
      .from("notas_fiscais" as any)
      .insert({
        clinic_id: clinicId,
        paciente_id: pacienteId,
        nome_arquivo: file.name,
        arquivo_path: path,
        mes_referencia: mesReferencia,
        uploaded_by: uploadedBy,
        hash_arquivo: hash,
        tamanho_bytes: file.size,
        status: "ativo",
      })
      .select()
      .single();
    if (error) {
      await supabase.storage.from(BUCKET).remove([path]);
      throw error;
    }
    return data as any;
  },

  async prepareBatch(
    files: File[],
    pacientes: PacienteMatchCandidate[],
    clinicId: string
  ): Promise<BatchImportItem[]> {
    const items: BatchImportItem[] = [];
    // hashes existentes
    const hashes = await Promise.all(files.map((f) => sha256(f)));
    const { data: existing } = await supabase
      .from("notas_fiscais" as any)
      .select("hash_arquivo")
      .eq("clinic_id", clinicId)
      .in("hash_arquivo", hashes);
    const existingHashes = new Set(
      ((existing as any) || []).map((e: any) => e.hash_arquivo)
    );

    files.forEach((file, i) => {
      const candidates = findCandidates(file.name, pacientes);
      let matchStatus: BatchImportItem["matchStatus"] = "not_found";
      let matchedPacienteId: string | null = null;
      if (candidates.length === 1) {
        matchStatus = "matched";
        matchedPacienteId = candidates[0].id;
      } else if (candidates.length > 1) {
        matchStatus = "conflict";
      }
      items.push({
        file,
        matchedPacienteId,
        matchStatus,
        candidates,
        hash: hashes[i],
        duplicate: existingHashes.has(hashes[i]),
      });
    });
    return items;
  },

  async commitBatch(params: {
    clinicId: string;
    mesReferencia: string;
    uploadedBy: string;
    items: BatchImportItem[];
  }): Promise<{ success: number; failed: number; errors: string[] }> {
    const { clinicId, mesReferencia, uploadedBy, items } = params;
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const it of items) {
      if (!it.matchedPacienteId || it.duplicate) {
        failed++;
        continue;
      }
      try {
        const safeName = sanitizeFileName(it.file.name);
        const path = `${clinicId}/${it.matchedPacienteId}/${Date.now()}_${safeName}`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, it.file, { contentType: "application/pdf" });
        if (upErr) throw upErr;

        const { error } = await supabase.from("notas_fiscais" as any).insert({
          clinic_id: clinicId,
          paciente_id: it.matchedPacienteId,
          nome_arquivo: it.file.name,
          arquivo_path: path,
          mes_referencia: mesReferencia,
          uploaded_by: uploadedBy,
          hash_arquivo: it.hash,
          tamanho_bytes: it.file.size,
          status: "ativo",
        });
        if (error) {
          await supabase.storage.from(BUCKET).remove([path]);
          throw error;
        }
        success++;
      } catch (e: any) {
        failed++;
        errors.push(`${it.file.name}: ${e.message || "erro"}`);
      }
    }
    return { success, failed, errors };
  },

  async generatePublicLink(notaId: string, daysValid = 7): Promise<string> {
    const token = genToken();
    const expires = new Date(Date.now() + daysValid * 24 * 3600 * 1000).toISOString();
    const { error } = await supabase
      .from("notas_fiscais" as any)
      .update({ public_token: token, public_token_expires_at: expires })
      .eq("id", notaId);
    if (error) throw error;
    return `${window.location.origin}/nota-fiscal/${token}`;
  },

  async markSent(notaId: string, via: "whatsapp" | "link"): Promise<void> {
    await supabase
      .from("notas_fiscais" as any)
      .update({ enviado_em: new Date().toISOString(), enviado_via: via })
      .eq("id", notaId);
  },

  async deleteNota(nota: NotaFiscal): Promise<void> {
    if (nota.arquivo_path) {
      await supabase.storage.from(BUCKET).remove([nota.arquivo_path]);
    }
    const { error } = await supabase
      .from("notas_fiscais" as any)
      .delete()
      .eq("id", nota.id);
    if (error) throw error;
  },

  async getByPublicToken(token: string): Promise<any> {
    const { data, error } = await (supabase as any).rpc("get_nota_fiscal_by_token", {
      p_token: token,
    });
    if (error) throw error;
    return data;
  },
};
