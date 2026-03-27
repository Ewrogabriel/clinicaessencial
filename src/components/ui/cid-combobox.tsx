import { useState, useEffect, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronsUpDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Common CID-10 codes used in rehabilitation/clinical settings
const CID_LIST = [
  { code: "F32", desc: "Episódio depressivo" },
  { code: "F32.0", desc: "Episódio depressivo leve" },
  { code: "F32.1", desc: "Episódio depressivo moderado" },
  { code: "F32.2", desc: "Episódio depressivo grave sem sintomas psicóticos" },
  { code: "F33", desc: "Transtorno depressivo recorrente" },
  { code: "F41", desc: "Outros transtornos ansiosos" },
  { code: "F41.0", desc: "Transtorno de pânico" },
  { code: "F41.1", desc: "Ansiedade generalizada" },
  { code: "F41.2", desc: "Transtorno misto ansioso e depressivo" },
  { code: "F43.1", desc: "Estado de estresse pós-traumático" },
  { code: "F84.0", desc: "Autismo infantil" },
  { code: "F90", desc: "Transtornos hipercinéticos (TDAH)" },
  { code: "G43", desc: "Enxaqueca" },
  { code: "G43.0", desc: "Enxaqueca sem aura" },
  { code: "G43.1", desc: "Enxaqueca com aura" },
  { code: "G44.2", desc: "Cefaleia tensional" },
  { code: "G54.1", desc: "Transtornos do plexo lombossacral" },
  { code: "G56.0", desc: "Síndrome do túnel do carpo" },
  { code: "M15", desc: "Poliartrose" },
  { code: "M16", desc: "Coxartrose (artrose do quadril)" },
  { code: "M17", desc: "Gonartrose (artrose do joelho)" },
  { code: "M19", desc: "Outras artroses" },
  { code: "M23", desc: "Transtornos internos do joelho" },
  { code: "M25.5", desc: "Dor articular" },
  { code: "M43.1", desc: "Espondilolistese" },
  { code: "M47", desc: "Espondilose" },
  { code: "M50", desc: "Transtornos dos discos cervicais" },
  { code: "M51", desc: "Outros transtornos de discos intervertebrais" },
  { code: "M51.1", desc: "Transtornos de discos lombares com radiculopatia" },
  { code: "M54", desc: "Dorsalgia" },
  { code: "M54.2", desc: "Cervicalgia" },
  { code: "M54.3", desc: "Ciática" },
  { code: "M54.4", desc: "Lumbago com ciática" },
  { code: "M54.5", desc: "Dor lombar baixa (lombalgia)" },
  { code: "M62.8", desc: "Outros transtornos musculares especificados" },
  { code: "M65", desc: "Sinovite e tenossinovite" },
  { code: "M65.4", desc: "Tenossinovite estilóide radial (De Quervain)" },
  { code: "M67.4", desc: "Ganglion" },
  { code: "M70", desc: "Transtornos dos tecidos moles relacionados com o uso" },
  { code: "M72.2", desc: "Fibromatose da fáscia plantar (Fasceíte plantar)" },
  { code: "M75", desc: "Lesões do ombro" },
  { code: "M75.0", desc: "Capsulite adesiva do ombro" },
  { code: "M75.1", desc: "Síndrome do manguito rotador" },
  { code: "M75.3", desc: "Tendinite calcificante do ombro" },
  { code: "M76.6", desc: "Tendinite do tendão de Aquiles" },
  { code: "M77.0", desc: "Epicondilite medial" },
  { code: "M77.1", desc: "Epicondilite lateral (Cotovelo de tenista)" },
  { code: "M79.1", desc: "Mialgia" },
  { code: "M79.3", desc: "Paniculite não especificada" },
  { code: "M79.7", desc: "Fibromialgia" },
  { code: "R52", desc: "Dor não classificada em outra parte" },
  { code: "S13", desc: "Luxação, entorse e distensão cervical" },
  { code: "S33", desc: "Luxação, entorse e distensão da coluna lombar" },
  { code: "S43", desc: "Luxação, entorse e distensão do ombro" },
  { code: "S63", desc: "Luxação, entorse e distensão do punho e mão" },
  { code: "S83", desc: "Luxação, entorse e distensão do joelho" },
  { code: "S93", desc: "Luxação, entorse e distensão do tornozelo" },
  { code: "T14", desc: "Traumatismo de região não especificada" },
  { code: "Z50.1", desc: "Reabilitação por procedimentos" },
  { code: "Z54", desc: "Convalescença" },
  { code: "Z96.6", desc: "Presença de implante ortopédico articular" },
  { code: "I10", desc: "Hipertensão essencial (primária)" },
  { code: "E11", desc: "Diabetes mellitus tipo 2" },
  { code: "E66", desc: "Obesidade" },
  { code: "J06", desc: "Infecções agudas das vias aéreas superiores" },
  { code: "J18", desc: "Pneumonia por microrganismo não especificado" },
  { code: "J45", desc: "Asma" },
  { code: "K21", desc: "Doença de refluxo gastroesofágico" },
  { code: "N39.0", desc: "Infecção do trato urinário" },
  { code: "G40", desc: "Epilepsia" },
  { code: "G20", desc: "Doença de Parkinson" },
  { code: "I63", desc: "Infarto cerebral (AVC isquêmico)" },
  { code: "I64", desc: "Acidente vascular cerebral não especificado" },
  { code: "G35", desc: "Esclerose múltipla" },
  { code: "G80", desc: "Paralisia cerebral" },
  { code: "Q66", desc: "Deformidades congênitas do pé" },
  { code: "M41", desc: "Escoliose" },
  { code: "M40", desc: "Cifose e lordose" },
  { code: "M80", desc: "Osteoporose com fratura patológica" },
  { code: "M81", desc: "Osteoporose sem fratura patológica" },
  { code: "S42", desc: "Fratura do ombro e do braço" },
  { code: "S52", desc: "Fratura do antebraço" },
  { code: "S72", desc: "Fratura do fêmur" },
  { code: "S82", desc: "Fratura da perna, incluindo tornozelo" },
  { code: "S92", desc: "Fratura do pé" },
  { code: "S32", desc: "Fratura da coluna lombar e da pelve" },
  { code: "S22", desc: "Fratura de costela, esterno e coluna torácica" },
  { code: "S12", desc: "Fratura de vértebra cervical" },
];

interface CidComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function CidCombobox({ value, onValueChange, placeholder = "Selecione o CID-10...", className }: CidComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return CID_LIST;
    const q = search.toLowerCase();
    return CID_LIST.filter(
      c => c.code.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q)
    );
  }, [search]);

  const selectedLabel = useMemo(() => {
    if (!value) return null;
    const found = CID_LIST.find(c => c.code === value);
    return found ? `${found.code} - ${found.desc}` : value;
  }, [value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", !value && "text-muted-foreground", className)}
        >
          <span className="truncate">{selectedLabel || placeholder}</span>
          <div className="flex items-center gap-1 ml-2 shrink-0">
            {value && (
              <X
                className="h-3 w-3 opacity-50 hover:opacity-100"
                onClick={(e) => { e.stopPropagation(); onValueChange(""); }}
              />
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <div className="flex items-center gap-2 p-2 border-b">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            placeholder="Buscar por código ou descrição..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border-0 p-0 h-8 focus-visible:ring-0 shadow-none"
          />
        </div>
        <ScrollArea className="h-[300px]">
          {filtered.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Nenhum CID encontrado.
              <div className="mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { onValueChange(search.toUpperCase()); setOpen(false); setSearch(""); }}
                >
                  Usar "{search.toUpperCase()}" como código
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-1">
              {filtered.map(c => (
                <button
                  key={c.code}
                  className={cn(
                    "w-full text-left px-3 py-2 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors",
                    value === c.code && "bg-accent text-accent-foreground font-medium"
                  )}
                  onClick={() => { onValueChange(c.code); setOpen(false); setSearch(""); }}
                >
                  <span className="font-mono font-semibold text-xs mr-2">{c.code}</span>
                  <span>{c.desc}</span>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
