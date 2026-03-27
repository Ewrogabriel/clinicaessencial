import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/modules/clinic/hooks/useClinic";

interface PatientOption {
  id: string;
  nome: string;
  cpf?: string | null;
}

export interface PatientComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  patients?: PatientOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function PatientCombobox({
  value,
  onValueChange,
  patients: externalPatients,
  placeholder = "Buscar paciente...",
  className,
  disabled,
}: PatientComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { activeClinicId } = useClinic();

  const { data: fetchedPatients } = useQuery({
    queryKey: ["combobox-patients", activeClinicId],
    queryFn: async () => {
      if (activeClinicId) {
        const { data: cp } = await supabase.from("clinic_pacientes").select("paciente_id").eq("clinic_id", activeClinicId);
        const ids = (cp || []).map(c => c.paciente_id);
        if (!ids.length) return [];
        const { data } = await supabase.from("pacientes").select("id, nome, cpf").in("id", ids).order("nome");
        return data || [];
      }
      const { data } = await supabase.from("pacientes").select("id, nome, cpf").order("nome");
      return data || [];
    },
    enabled: !externalPatients,
  });

  const patients = externalPatients || fetchedPatients || [];

  const filtered = useMemo(() => {
    if (!search.trim()) return patients.slice(0, 50);
    const q = search.toLowerCase();
    return patients.filter(
      (p) =>
        p.nome.toLowerCase().includes(q) ||
        (p.cpf && p.cpf.includes(q))
    ).slice(0, 50);
  }, [patients, search]);

  const selected = patients.find((p) => p.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", !value && "text-muted-foreground", className)}
        >
          <span className="truncate">{selected?.nome || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            placeholder="Digitar nome ou CPF..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-0 shadow-none focus-visible:ring-0 h-9"
          />
        </div>
        <div className="max-h-[200px] overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Nenhum paciente encontrado</p>
          ) : (
            filtered.map((p) => (
              <button
                key={p.id}
                className={cn(
                  "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground",
                  value === p.id && "bg-accent"
                )}
                onClick={() => {
                  onValueChange(p.id === value ? "" : p.id);
                  setOpen(false);
                  setSearch("");
                }}
              >
                <Check className={cn("h-4 w-4", value === p.id ? "opacity-100" : "opacity-0")} />
                <span className="truncate">{p.nome}</span>
                {p.cpf && <span className="text-xs text-muted-foreground ml-auto">{p.cpf}</span>}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
