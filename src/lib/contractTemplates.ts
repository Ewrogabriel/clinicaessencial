/**
 * Sistema de templates de contrato com placeholders.
 * Lê da tabela contrato_templates (se houver template ativo do tipo correspondente),
 * caso contrário retorna null para que o componente use o fallback hardcoded.
 *
 * Placeholders suportados (case-sensitive):
 *  {{clinic.nome}} {{clinic.cnpj}} {{clinic.endereco}} {{clinic.cidade}} {{clinic.estado}}
 *  {{clinic.telefone}} {{clinic.instagram}}
 *  {{paciente.nome}} {{paciente.cpf}} {{paciente.rg}}
 *  {{plano.nome}} {{plano.modalidade}} {{plano.frequencia_semanal}}
 *  {{contrato.valor}} {{contrato.taxa_matricula}} {{contrato.forma_pagamento}}
 *  {{contrato.dia_vencimento}} {{contrato.vigencia_meses}} {{contrato.cidade_foro}} {{contrato.estado_foro}}
 *  {{contrato.multa_atraso_pct}} {{contrato.juros_mensal_pct}}
 *  {{contrato.prazo_cancelamento_h}} {{contrato.prazo_reposicao_dias}}
 *  {{profissional.nome}} {{profissional.cpf}} {{profissional.conselho}} {{profissional.registro}}
 *  {{profissional.commission_rate}} {{profissional.dia_pagamento_comissao}}
 *  {{profissional.raio_nao_concorrencia}} {{profissional.multa_nao_captacao}} {{profissional.multa_uso_marca}}
 *  {{profissional.aviso_previo_dias}}
 *  {{data.hoje}}
 */

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export type ContractContext = {
  clinic?: any;
  paciente?: any;
  plano?: any;
  profissional?: any;
  clinicSettings?: any;
  valorFinal?: number;
  taxaMatricula?: number;
  formaPagamento?: string;
};

export function renderContractTemplate(template: string, ctx: ContractContext): string {
  const c = ctx.clinic || ctx.clinicSettings || {};
  const cs = ctx.clinicSettings || {};
  const p = ctx.paciente || {};
  const pl = ctx.plano || {};
  const pr = ctx.profissional || {};
  const enderecoFull = [c.endereco || cs.endereco, (c.numero || cs.numero) ? `nº ${c.numero || cs.numero}` : "", c.bairro || cs.bairro, (c.cidade || cs.cidade) ? `${c.cidade || cs.cidade}/${c.estado || cs.estado}` : ""].filter(Boolean).join(", ");

  const map: Record<string, string> = {
    "clinic.nome": c.nome || cs.nome || "",
    "clinic.cnpj": c.cnpj || cs.cnpj || "",
    "clinic.endereco": enderecoFull,
    "clinic.cidade": c.cidade || cs.cidade || "",
    "clinic.estado": c.estado || cs.estado || "",
    "clinic.telefone": c.telefone || cs.telefone || "",
    "clinic.instagram": c.instagram || cs.instagram || "",

    "paciente.nome": p.nome || "___________________",
    "paciente.cpf": p.cpf || "___________",
    "paciente.rg": p.rg || "___________",

    "plano.nome": pl.nome || "a definir",
    "plano.modalidade": pl.modalidade || "atendimento",
    "plano.frequencia_semanal": String(pl.frequencia_semanal ?? 1),

    "contrato.valor": (ctx.valorFinal ?? 0).toFixed(2),
    "contrato.taxa_matricula": (ctx.taxaMatricula ?? 0).toFixed(2),
    "contrato.forma_pagamento": ctx.formaPagamento || "Pix",
    "contrato.dia_vencimento": String(p.contract_dia_vencimento ?? cs.pref_contract_dia_vencimento ?? 10),
    "contrato.vigencia_meses": String(p.contract_vigencia_meses ?? cs.pref_contract_vigencia_meses ?? 6),
    "contrato.cidade_foro": p.contract_cidade_foro ?? cs.pref_contract_cidade_foro ?? cs.cidade ?? "",
    "contrato.estado_foro": p.contract_estado_foro ?? cs.pref_contract_estado_foro ?? cs.estado ?? "",
    "contrato.multa_atraso_pct": String(p.contract_multa_atraso_pct ?? cs.pref_contract_multa_atraso_pct ?? 2),
    "contrato.juros_mensal_pct": String(p.contract_juros_mensal_pct ?? cs.pref_contract_juros_mensal_pct ?? 1),
    "contrato.prazo_cancelamento_h": String(p.contract_prazo_cancelamento_h ?? cs.pref_contract_prazo_cancelamento_h ?? 3),
    "contrato.prazo_reposicao_dias": String(p.contract_prazo_reposicao_dias ?? cs.pref_contract_prazo_reposicao_dias ?? 30),

    "profissional.nome": pr.nome || "___________________",
    "profissional.cpf": pr.cpf || "___________",
    "profissional.conselho": pr.conselho_profissional || "Conselho",
    "profissional.registro": pr.registro_profissional || pr.registro_conselho || "_______",
    "profissional.commission_rate": String(pr.commission_rate ?? "___"),
    "profissional.dia_pagamento_comissao": String(pr.contract_dia_pagamento_comissao ?? cs.pref_contract_dia_pagamento_comissao ?? 10),
    "profissional.raio_nao_concorrencia": String(pr.contract_raio_nao_concorrencia_km ?? cs.pref_contract_raio_nao_concorrencia_km ?? 5),
    "profissional.multa_nao_captacao": String(pr.contract_multa_nao_captacao_fator ?? cs.pref_contract_multa_nao_captacao_fator ?? 10),
    "profissional.multa_uso_marca": Number(pr.contract_multa_uso_marca_valor ?? cs.pref_contract_multa_uso_marca_valor ?? 5000).toFixed(2),
    "profissional.aviso_previo_dias": String(pr.contract_prazo_aviso_previo_dias ?? cs.pref_contract_prazo_aviso_previo_dias ?? 30),

    "data.hoje": format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }),
  };

  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key) => map[key] ?? `{{${key}}}`);
}

export const PLACEHOLDER_HELP = [
  { group: "Clínica", items: ["clinic.nome", "clinic.cnpj", "clinic.endereco", "clinic.cidade", "clinic.estado", "clinic.telefone", "clinic.instagram"] },
  { group: "Paciente", items: ["paciente.nome", "paciente.cpf", "paciente.rg"] },
  { group: "Plano", items: ["plano.nome", "plano.modalidade", "plano.frequencia_semanal"] },
  { group: "Contrato", items: ["contrato.valor", "contrato.taxa_matricula", "contrato.forma_pagamento", "contrato.dia_vencimento", "contrato.vigencia_meses", "contrato.cidade_foro", "contrato.estado_foro", "contrato.multa_atraso_pct", "contrato.juros_mensal_pct", "contrato.prazo_cancelamento_h", "contrato.prazo_reposicao_dias"] },
  { group: "Profissional", items: ["profissional.nome", "profissional.cpf", "profissional.conselho", "profissional.registro", "profissional.commission_rate", "profissional.dia_pagamento_comissao", "profissional.raio_nao_concorrencia", "profissional.multa_nao_captacao", "profissional.multa_uso_marca", "profissional.aviso_previo_dias"] },
  { group: "Data", items: ["data.hoje"] },
];

export const TIPOS_CONTRATO = [
  { value: "paciente", label: "Contrato do Paciente" },
  { value: "profissional", label: "Contrato do Profissional" },
  { value: "termo_saude", label: "Termo de Saúde" },
  { value: "politica_interna", label: "Política Interna" },
] as const;
