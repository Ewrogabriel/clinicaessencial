export function PaymentTableHeader() {
  return (
    <div className="hidden md:grid grid-cols-[140px_1fr_80px_120px_110px_160px_32px] gap-2 px-4 py-2 bg-muted/40 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wider">
      <div>Data</div>
      <div>Descrição</div>
      <div>Tipo</div>
      <div>Forma Pgto</div>
      <div className="text-right">Valor</div>
      <div>Conciliação</div>
      <div></div>
    </div>
  );
}
