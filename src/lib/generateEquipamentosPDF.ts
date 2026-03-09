import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

export const downloadEquipamentosPDF = (items: any[]) => {
  const doc = new jsPDF("landscape");

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Relatório de Equipamentos e Materiais", 14, 20);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 27);
  doc.text(`Total de itens: ${items.length}`, 14, 32);

  const totalValor = items.reduce((s, i) => s + (Number(i.valor) || 0) * (i.quantidade || 1), 0);
  doc.text(`Valor total do patrimônio: R$ ${totalValor.toFixed(2)}`, 14, 37);

  const body = items.map((i) => [
    i.nome,
    i.marca || "—",
    i.modelo || "—",
    i.e_consumo ? "Consumo" : i.tipo || "Equipamento",
    String(i.quantidade || 1),
    i.e_consumo ? `${i.estoque_atual ?? 0} / mín ${i.estoque_minimo ?? 0}` : "—",
    `R$ ${(Number(i.valor) || 0).toFixed(2)}`,
    `R$ ${((Number(i.valor) || 0) * (i.quantidade || 1)).toFixed(2)}`,
    i.status === "ativo" ? "Ativo" : i.status === "em_manutencao" ? "Manutenção" : "Inativo",
    i.data_proxima_revisao ? format(new Date(i.data_proxima_revisao), "dd/MM/yyyy") : "—",
  ]);

  autoTable(doc, {
    startY: 42,
    head: [["Nome", "Marca", "Modelo", "Tipo", "Qtd", "Estoque", "Valor Unit.", "Valor Total", "Status", "Próx. Revisão"]],
    body,
    theme: "striped",
    styles: { fontSize: 7 },
    headStyles: { fillColor: [59, 130, 246] },
    margin: { left: 14, right: 14 },
  });

  doc.save("relatorio_equipamentos.pdf");
};
