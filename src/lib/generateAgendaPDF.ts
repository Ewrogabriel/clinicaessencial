import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AgendamentoForPDF {
  data_horario: string;
  pacientes?: { nome: string } | null;
  paciente_telefone?: string;
}

function formatPatientName(nome: string): string {
  const parts = nome.trim().split(/\s+/);
  if (parts.length <= 1) return parts[0] || "";
  const firstName = parts[0];
  const initials = parts.slice(1).map((p) => p[0]?.toUpperCase() + ".").join(" ");
  return `${firstName} ${initials}`;
}

export function generateWeeklyPDF(
  agendamentos: AgendamentoForPDF[],
  currentDate: Date,
  pacientesMap: Record<string, string> // paciente_id -> telefone
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const title = `Agenda Semanal - ${format(weekStart, "dd/MM")} a ${format(weekEnd, "dd/MM/yyyy")}`;
  doc.setFontSize(14);
  doc.text(title, 14, 15);

  // Hours from 6 to 19
  const hours = Array.from({ length: 14 }, (_, i) => i + 6);

  const dayHeaders = ["Horário", ...days.map((d) => format(d, "EEE dd/MM", { locale: ptBR }))];

  const bodyRows = hours.map((hour) => {
    const hourLabel = `${String(hour).padStart(2, "0")}:00`;
    const cells = days.map((day) => {
      const dayAgs = agendamentos.filter((ag) => {
        const agDate = new Date(ag.data_horario);
        return isSameDay(agDate, day) && agDate.getHours() === hour;
      });

      if (dayAgs.length === 0) return "";

      return dayAgs
        .map((ag) => {
          const time = format(new Date(ag.data_horario), "HH:mm");
          const name = ag.pacientes?.nome ? formatPatientName(ag.pacientes.nome) : "—";
          const tel = ag.paciente_telefone || "";
          return `${time} ${name}${tel ? "\n" + tel : ""}`;
        })
        .join("\n\n");
    });

    return [hourLabel, ...cells];
  });

  autoTable(doc, {
    head: [dayHeaders],
    body: bodyRows,
    startY: 22,
    theme: "grid",
    styles: {
      fontSize: 7,
      cellPadding: 2,
      valign: "top",
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [34, 139, 115],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 8,
      halign: "center",
    },
    columnStyles: {
      0: { cellWidth: 18, halign: "center", fontStyle: "bold" },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index > 0 && data.cell.raw) {
        data.cell.styles.fillColor = [245, 250, 248];
      }
    },
  });

  doc.save(`agenda-semanal-${format(weekStart, "yyyy-MM-dd")}.pdf`);
}
