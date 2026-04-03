// ─── Payment helper utilities ─────────────────────────────────────────────────

export const labelOrigem: Record<string, string> = {
  plano: "Plano / Pacote",
  mensalidade: "Mensalidade",
  matricula: "Matrícula",
  sessao: "Sessão Avulsa",
  sessao_avulsa: "Sessão Avulsa",
  manual: "Pagamento Manual",
  reembolso: "Reembolso",
  ajuste: "Ajuste",
  credito: "Crédito",
  investimento: "Investimento",
};

export const labelStatus: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  pago: { label: "Pago", variant: "default" },
  pendente: { label: "Pendente", variant: "secondary" },
  vencido: { label: "Atrasado", variant: "destructive" },
  atrasado: { label: "Atrasado", variant: "destructive" },
  nao_iniciado: { label: "Não Pago", variant: "secondary" },
  cancelado: { label: "Cancelado", variant: "outline" },
  reembolsado: { label: "Reembolsado", variant: "outline" },
  aberto: { label: "Em Aberto", variant: "secondary" },
  parcialmente_pago: { label: "Parcial", variant: "secondary" },
};

export function getMovimentacaoTipo(
  valor: number,
  status: string
): { tipo: string; cor: string } {
  if (status === "reembolsado" || valor < 0)
    return { tipo: "Crédito", cor: "text-green-600" };
  return { tipo: "Débito", cor: "text-red-600" };
}

export function getStatusConfig(status: string) {
  return labelStatus[status] ?? { label: status, variant: "secondary" as const };
}
