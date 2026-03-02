import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, User, Calendar, DollarSign } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";

interface SearchResult {
  type: "paciente" | "agendamento" | "pagamento";
  id: string;
  title: string;
  subtitle: string;
  link: string;
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      const q = query.trim();
      const items: SearchResult[] = [];

      // Search patients
      const { data: pacientes } = await (supabase.from("pacientes") as any)
        .select("id, nome, cpf, telefone")
        .or(`nome.ilike.%${q}%,cpf.ilike.%${q}%,telefone.ilike.%${q}%`)
        .limit(5);
      pacientes?.forEach((p: any) => items.push({
        type: "paciente", id: p.id, title: p.nome,
        subtitle: [p.cpf, p.telefone].filter(Boolean).join(" • "),
        link: `/pacientes/${p.id}/detalhes`,
      }));

      // Search appointments
      const { data: agendamentos } = await (supabase.from("agendamentos") as any)
        .select("id, data_horario, tipo_atendimento, pacientes(nome)")
        .or(`tipo_atendimento.ilike.%${q}%`)
        .limit(5);
      agendamentos?.forEach((a: any) => {
        if (a.pacientes?.nome?.toLowerCase().includes(q.toLowerCase()) || a.tipo_atendimento?.toLowerCase().includes(q.toLowerCase())) {
          items.push({
            type: "agendamento", id: a.id,
            title: `${a.pacientes?.nome || "Paciente"} - ${a.tipo_atendimento}`,
            subtitle: format(new Date(a.data_horario), "dd/MM/yyyy HH:mm"),
            link: "/agenda",
          });
        }
      });

      // Search payments
      const { data: pagamentos } = await (supabase.from("pagamentos") as any)
        .select("id, valor, descricao, pacientes(nome)")
        .or(`descricao.ilike.%${q}%`)
        .limit(5);
      pagamentos?.forEach((p: any) => {
        if (p.pacientes?.nome?.toLowerCase().includes(q.toLowerCase()) || p.descricao?.toLowerCase().includes(q.toLowerCase())) {
          items.push({
            type: "pagamento", id: p.id,
            title: p.pacientes?.nome || "Pagamento",
            subtitle: `R$ ${Number(p.valor).toFixed(2)} - ${p.descricao || "Sem descrição"}`,
            link: "/financeiro",
          });
        }
      });

      setResults(items);
      setLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const icons = {
    paciente: <User className="h-4 w-4 text-primary" />,
    agendamento: <Calendar className="h-4 w-4 text-primary" />,
    pagamento: <DollarSign className="h-4 w-4 text-primary" />,
  };

  const labels = { paciente: "Paciente", agendamento: "Agendamento", pagamento: "Pagamento" };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-background text-sm text-muted-foreground hover:bg-accent transition-colors w-full max-w-sm"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Buscar pacientes, agenda...</span>
        <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[520px] p-0 gap-0">
          <div className="flex items-center border-b px-3">
            <Search className="h-4 w-4 text-muted-foreground mr-2" />
            <Input
              ref={inputRef}
              placeholder="Buscar por nome, CPF, telefone..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-12"
              autoFocus
            />
          </div>
          <div className="max-h-[300px] overflow-y-auto p-2">
            {loading && <p className="text-center py-4 text-sm text-muted-foreground animate-pulse">Buscando...</p>}
            {!loading && query.length >= 2 && results.length === 0 && (
              <p className="text-center py-4 text-sm text-muted-foreground">Nenhum resultado encontrado.</p>
            )}
            {results.map((r) => (
              <button
                key={`${r.type}-${r.id}`}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-accent text-left transition-colors"
                onClick={() => {
                  setOpen(false);
                  setQuery("");
                  navigate(r.link);
                }}
              >
                {icons[r.type]}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{r.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{r.subtitle}</p>
                </div>
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{labels[r.type]}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
