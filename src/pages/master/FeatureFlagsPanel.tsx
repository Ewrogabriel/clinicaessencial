import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Flag, Plus, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  FeatureFlagToggle,
  FeatureFlagData,
} from "@/components/master/FeatureFlagToggle";
import { supabase } from "@/integrations/supabase/client";
import { getFeatureFlags, updateFeatureFlag } from "@/modules/master/services/masterService";
import { toast } from "sonner";

const CATEGORIES = ["billing", "teleconsultation", "gamification", "reports", "integrations", "misc"];

export default function FeatureFlagsPanel() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    descricao: "",
    categoria: "misc",
    plano_minimo: "",
    ativo: false,
  });

  const { data: flags = [], isLoading } = useQuery<FeatureFlagData[]>({
    queryKey: ["feature-flags"],
    queryFn: () => getFeatureFlags(),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      updateFeatureFlag(id, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feature-flags"] });
    },
    onError: (e: Error) =>
      toast({ title: "Erro ao atualizar flag", description: e.message, variant: "destructive" }),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.from as any)("feature_flags").insert({
        nome: form.nome,
        descricao: form.descricao || null,
        categoria: form.categoria,
        plano_minimo: form.plano_minimo || null,
        ativo: form.ativo,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Feature flag criada ✅" });
      setDialogOpen(false);
      setForm({ nome: "", descricao: "", categoria: "misc", plano_minimo: "", ativo: false });
      queryClient.invalidateQueries({ queryKey: ["feature-flags"] });
    },
    onError: (e: Error) =>
      toast({ title: "Erro ao criar flag", description: e.message, variant: "destructive" }),
  });

  const grouped = useMemo(() => {
    const lower = search.toLowerCase();
    const filtered = flags.filter(
      (f) =>
        !search ||
        f.nome.toLowerCase().includes(lower) ||
        (f.descricao ?? "").toLowerCase().includes(lower),
    );

    return CATEGORIES.reduce<Record<string, FeatureFlagData[]>>((acc, cat) => {
      const items = filtered.filter((f) => (f.categoria ?? "misc") === cat);
      if (items.length > 0) acc[cat] = items;
      return acc;
    }, {});
  }, [flags, search]);

  const ungrouped = useMemo(() => {
    const lower = search.toLowerCase();
    return flags.filter(
      (f) =>
        !CATEGORIES.includes(f.categoria ?? "") &&
        (!search ||
          f.nome.toLowerCase().includes(lower) ||
          (f.descricao ?? "").toLowerCase().includes(lower)),
    );
  }, [flags, search]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Flag className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Feature Flags</h1>
            <p className="text-muted-foreground text-sm">
              Controle de funcionalidades por plano e clínica
            </p>
          </div>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Nova Flag
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar flags…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading && (
        <p className="text-center text-muted-foreground text-sm py-8">Carregando flags…</p>
      )}

      {Object.entries(grouped).map(([category, items]) => (
        <Card key={category}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm capitalize text-muted-foreground">
              {category} ({items.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {items.map((flag) => (
              <FeatureFlagToggle
                key={flag.id}
                flag={flag}
                onToggle={(id, enabled) => toggleMutation.mutateAsync({ id, enabled })}
              />
            ))}
          </CardContent>
        </Card>
      ))}

      {ungrouped.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Outros ({ungrouped.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ungrouped.map((flag) => (
              <FeatureFlagToggle
                key={flag.id}
                flag={flag}
                onToggle={(id, enabled) => toggleMutation.mutateAsync({ id, enabled })}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {!isLoading && flags.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            Nenhuma feature flag cadastrada.
          </CardContent>
        </Card>
      )}

      {/* Create dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Feature Flag</DialogTitle>
            <DialogDescription>
              Crie uma nova flag para controlar funcionalidades.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="ex: teleconsulta_ativa"
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoria</Label>
                <Select
                  value={form.categoria}
                  onValueChange={(v) => setForm((f) => ({ ...f, categoria: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c} className="capitalize">
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Plano mínimo</Label>
                <Input
                  value={form.plano_minimo}
                  onChange={(e) => setForm((f) => ({ ...f, plano_minimo: e.target.value }))}
                  placeholder="ex: Profissional"
                />
              </div>
            </div>
            <Button
              className="w-full"
              onClick={() => createMutation.mutate()}
              disabled={!form.nome || createMutation.isPending}
            >
              Criar Flag
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
