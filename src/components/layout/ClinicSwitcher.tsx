import { useClinic } from "@/hooks/useClinic";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2 } from "lucide-react";

interface ClinicSwitcherProps {
  collapsed?: boolean;
}

export function ClinicSwitcher({ collapsed = false }: ClinicSwitcherProps) {
  const { clinics, activeClinicId, setActiveClinicId, isMultiClinic } = useClinic();

  if (!isMultiClinic) return null;

  if (collapsed) {
    return (
      <div className="px-2 py-2">
        <button
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground"
          title={clinics.find(c => c.id === activeClinicId)?.nome || "Clínica"}
        >
          <Building2 className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="px-3 py-2">
      <label className="text-[10px] uppercase font-semibold text-sidebar-foreground/50 tracking-wider mb-1 block">
        Unidade
      </label>
      <Select value={activeClinicId || ""} onValueChange={setActiveClinicId}>
        <SelectTrigger className="h-8 text-xs bg-sidebar-accent/50 border-sidebar-border">
          <Building2 className="h-3 w-3 mr-1.5 shrink-0" />
          <SelectValue placeholder="Selecionar clínica" />
        </SelectTrigger>
        <SelectContent>
          {clinics.map((clinic) => (
            <SelectItem key={clinic.id} value={clinic.id} className="text-xs">
              <div className="flex flex-col">
                <span>{clinic.nome}</span>
                {clinic.cidade && (
                  <span className="text-muted-foreground text-[10px]">
                    {clinic.cidade}{clinic.estado ? ` - ${clinic.estado}` : ""}
                  </span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
