import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, X, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Patient {
  id: string;
  nome: string;
  cpf?: string | null;
}

interface PatientSelectorProps {
  patients: Patient[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

export function PatientSelector({ patients, selectedIds, onChange, disabled }: PatientSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return patients.filter(
      (p) =>
        p.nome.toLowerCase().includes(q) ||
        (p.cpf && p.cpf.replace(/\D/g, "").includes(q.replace(/\D/g, "")))
    );
  }, [patients, search]);

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((s) => s !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const selectAll = () => onChange(patients.map((p) => p.id));
  const clearAll = () => onChange([]);

  const selectedPatients = patients.filter((p) => selectedIds.includes(p.id));

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            disabled={disabled}
            className="w-full justify-between h-auto min-h-10 py-2"
          >
            <span className="text-sm text-muted-foreground">
              {selectedIds.length === 0
                ? "Selecionar pacientes..."
                : `${selectedIds.length} paciente(s) selecionado(s)`}
            </span>
            <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[360px] p-0" align="start">
          <div className="p-2 border-b">
            <Input
              placeholder="Buscar por nome ou CPF..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8"
            />
          </div>
          <div className="flex gap-1 p-2 border-b">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={selectAll}>
              <Users className="h-3 w-3 mr-1" /> Selecionar Todos
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearAll}>
              <X className="h-3 w-3 mr-1" /> Limpar Todos
            </Button>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-4">Nenhum paciente encontrado.</p>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p.id)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent transition-colors"
                >
                  <Check
                    className={cn("h-4 w-4 shrink-0", selectedIds.includes(p.id) ? "opacity-100" : "opacity-0")}
                  />
                  <span className="truncate">{p.nome}</span>
                  {p.cpf && <span className="ml-auto text-xs text-muted-foreground shrink-0">{p.cpf}</span>}
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>

      {selectedPatients.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedPatients.map((p) => (
            <Badge key={p.id} variant="secondary" className="gap-1 pr-1">
              {p.nome}
              <button
                type="button"
                onClick={() => toggle(p.id)}
                disabled={disabled}
                className="rounded-full hover:bg-muted-foreground/20 p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
