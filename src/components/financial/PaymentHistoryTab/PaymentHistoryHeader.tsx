interface PaymentHistoryHeaderProps {
  pacienteNome: string;
}

export function PaymentHistoryHeader({ pacienteNome }: PaymentHistoryHeaderProps) {
  return (
    <div>
      <h2 className="text-lg font-semibold">Histórico de Pagamentos</h2>
      <p className="text-sm text-muted-foreground">{pacienteNome}</p>
    </div>
  );
}
