import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronsUpDown, Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/modules/shared/hooks/use-toast";

interface CouncilComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function CouncilCombobox({ value, onValueChange, placeholder = "Selecione o conselho...", className }: CouncilComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [newSigla, setNewSigla] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const queryClient = useQueryClient();

  const { data: councils = [] } = useQuery({
    queryKey: ["conselhos-profissionais"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conselhos_profissionais")
        .select("id, sigla, nome")
        .order("sigla");
      if (error) throw error;
      return data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async ({ sigla, nome }: { sigla: string; nome: string }) => {
      const { error } = await supabase
        .from("conselhos_profissionais")
        .insert({ sigla: sigla.toUpperCase(), nome, created_by: (await supabase.auth.getUser()).data.user?.id || "" } as any);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["conselhos-profissionais"] });
      onValueChange(vars.sigla.toUpperCase());
      setShowCreate(false);
      setNewName("");
      setNewSigla("");
      toast({ title: "Conselho cadastrado!" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return councils;
    const q = search.toLowerCase();
    return councils.filter(
      (c: any) => c.sigla.toLowerCase().includes(q) || c.nome.toLowerCase().includes(q)
    );
  }, [search, councils]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", !value && "text-muted-foreground", className)}
        >
          <span className="truncate">{value || placeholder}</span>
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
      <PopoverContent className="w-[350px] p-0" align="start">
        <div className="flex items-center gap-2 p-2 border-b">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            placeholder="Buscar conselho..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border-0 p-0 h-8 focus-visible:ring-0 shadow-none"
          />
        </div>
        <ScrollArea className="max-h-[250px]">
          <div className="p-1">
            {filtered.map((c: any) => (
              <button
                key={c.id}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors",
                  value === c.sigla && "bg-accent text-accent-foreground font-medium"
                )}
                onClick={() => { onValueChange(c.sigla); setOpen(false); setSearch(""); }}
              >
                <span className="font-semibold mr-2">{c.sigla}</span>
                <span className="text-muted-foreground">- {c.nome}</span>
              </button>
            ))}
            {filtered.length === 0 && !showCreate && (
              <div className="p-3 text-center text-sm text-muted-foreground">
                Nenhum conselho encontrado.
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Create new council */}
        <div className="border-t p-2">
          {!showCreate ? (
            <Button
              variant="ghost"
              size="sm"
              className="w-full gap-2 text-xs"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="h-3 w-3" /> Cadastrar novo conselho
            </Button>
          ) : (
            <div className="space-y-2">
              <Input
                placeholder="Sigla (ex: CRM)"
                value={newSigla}
                onChange={e => setNewSigla(e.target.value.toUpperCase())}
                className="h-8 text-sm"
              />
              <Input
                placeholder="Nome completo (ex: Conselho Regional de Medicina)"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="h-8 text-sm"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="h-7 text-xs flex-1"
                  disabled={!newSigla.trim() || !newName.trim() || createMutation.isPending}
                  onClick={() => createMutation.mutate({ sigla: newSigla.trim(), nome: newName.trim() })}
                >
                  Salvar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => { setShowCreate(false); setNewSigla(""); setNewName(""); }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
