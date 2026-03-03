import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AgendamentoForPDF {
  data_horario: string;
  profissional_id?: string;
  pacientes?: { nome: string } | null;
  profiles?: { nome: string } | null;
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
  pacientesMap: Record<string, string>,
  professionalName?: string // if filtering by professional
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  let title = `Agenda Semanal - ${format(weekStart, "dd/MM")} a ${format(weekEnd, "dd/MM/yyyy")}`;
  if (professionalName) {
    title += ` — ${professionalName}`;
  }
  doc.setFontSize(14);
  doc.text(title, 14, 15);

  // Determine hour range from actual agendamentos
  const agHours = agendamentos.map(ag => new Date(ag.data_horario).getHours());
  const minHour = agHours.length > 0 ? Math.min(...agHours, 6) : 6;
  const maxHour = agHours.length > 0 ? Math.max(...agHours, 8) + 1 : 20;
  const hours = Array.from({ length: maxHour - minHour }, (_, i) => i + minHour);
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
          const name = ag.pacientes?.nome ? formatPatientName(ag.pacientes.nome) : "—";
          const tel = ag.paciente_telefone || "";
          const prof = !professionalName && ag.profiles?.nome ? `[${formatPatientName(ag.profiles.nome)}]` : "";
          return `${name}${prof ? " " + prof : ""}${tel ? "\n" + tel : ""}`;
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

  const fileName = professionalName
    ? `agenda-semanal-${professionalName.replace(/\s+/g, "_")}-${format(weekStart, "yyyy-MM-dd")}.pdf`
    : `agenda-semanal-${format(weekStart, "yyyy-MM-dd")}.pdf`;
  doc.save(fileName);
}
