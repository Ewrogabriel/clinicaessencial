import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Save, RotateCcw, Palette } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface ThemeColors {
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  sidebar_bg: string;
  sidebar_text: string;
  header_bg: string;
  header_text: string;
  card_bg: string;
  card_border: string;
  button_primary: string;
  button_text: string;
  muted_color: string;
  destructive_color: string;
}

const DEFAULT_THEME: ThemeColors = {
  primary_color: "#22c55e",
  secondary_color: "#1e293b",
  accent_color: "#14b8a6",
  sidebar_bg: "#f1f5f9",
  sidebar_text: "#64748b",
  header_bg: "#ffffff",
  header_text: "#1e293b",
  card_bg: "#ffffff",
  card_border: "#e2e8f0",
  button_primary: "#22c55e",
  button_text: "#ffffff",
  muted_color: "#f1f5f9",
  destructive_color: "#ef4444",
};

const PRESET_THEMES: { name: string; colors: ThemeColors }[] = [
  {
    name: "Paleta Original",
    colors: {
      primary_color: "#2a9d6e",
      secondary_color: "#e8f5ee",
      accent_color: "#4abf8a",
      sidebar_bg: "#1f3d2e",
      sidebar_text: "#d4e8dc",
      header_bg: "#f8fdf9",
      header_text: "#1a3328",
      card_bg: "#ffffff",
      card_border: "#d4e8dc",
      button_primary: "#2a9d6e",
      button_text: "#ffffff",
      muted_color: "#e8f5ee",
      destructive_color: "#ef4444",
    },
  },
  {
    name: "Verde Saúde",
    colors: DEFAULT_THEME,
  },
  {
    name: "Azul Clínico",
    colors: {
      ...DEFAULT_THEME,
      primary_color: "#3b82f6",
      accent_color: "#06b6d4",
      button_primary: "#3b82f6",
      sidebar_bg: "#eff6ff",
    },
  },
  {
    name: "Roxo Moderno",
    colors: {
      ...DEFAULT_THEME,
      primary_color: "#8b5cf6",
      accent_color: "#a78bfa",
      button_primary: "#8b5cf6",
      sidebar_bg: "#f5f3ff",
      secondary_color: "#312e81",
    },
  },
  {
    name: "Rosa Wellness",
    colors: {
      ...DEFAULT_THEME,
      primary_color: "#ec4899",
      accent_color: "#f472b6",
      button_primary: "#ec4899",
      sidebar_bg: "#fdf2f8",
    },
  },
  {
    name: "Laranja Energético",
    colors: {
      ...DEFAULT_THEME,
      primary_color: "#f97316",
      accent_color: "#fb923c",
      button_primary: "#f97316",
      sidebar_bg: "#fff7ed",
    },
  },
  {
    name: "Dark Elegante",
    colors: {
      primary_color: "#22c55e",
      secondary_color: "#0f172a",
      accent_color: "#14b8a6",
      sidebar_bg: "#1e293b",
      sidebar_text: "#94a3b8",
      header_bg: "#0f172a",
      header_text: "#f8fafc",
      card_bg: "#1e293b",
      card_border: "#334155",
      button_primary: "#22c55e",
      button_text: "#ffffff",
      muted_color: "#334155",
      destructive_color: "#ef4444",
    },
  },
];

const COLOR_FIELDS: { key: keyof ThemeColors; label: string; group: string }[] = [
  { key: "primary_color", label: "Cor Primária", group: "Cores Principais" },
  { key: "secondary_color", label: "Cor Secundária", group: "Cores Principais" },
  { key: "accent_color", label: "Cor de Destaque", group: "Cores Principais" },
  { key: "button_primary", label: "Botões", group: "Cores Principais" },
  { key: "button_text", label: "Texto dos Botões", group: "Cores Principais" },
  { key: "destructive_color", label: "Cor de Alerta/Erro", group: "Cores Principais" },
  { key: "sidebar_bg", label: "Fundo do Menu Lateral", group: "Layout" },
  { key: "sidebar_text", label: "Texto do Menu Lateral", group: "Layout" },
  { key: "header_bg", label: "Fundo do Cabeçalho", group: "Layout" },
  { key: "header_text", label: "Texto do Cabeçalho", group: "Layout" },
  { key: "card_bg", label: "Fundo dos Cards", group: "Layout" },
  { key: "card_border", label: "Borda dos Cards", group: "Layout" },
  { key: "muted_color", label: "Cor de Fundo Suave", group: "Layout" },
];

export function ClinicThemeTab() {
  const { activeClinicId } = useClinic();
  const queryClient = useQueryClient();
  const [colors, setColors] = useState<ThemeColors>(DEFAULT_THEME);

  const { data: theme, isLoading } = useQuery({
    queryKey: ["clinic-theme", activeClinicId],
    queryFn: async () => {
      if (!activeClinicId) return null;
      const { data } = await (supabase as any)
        .from("clinic_theme")
        .select("*")
        .eq("clinic_id", activeClinicId)
        .maybeSingle();
      return data;
    },
    enabled: !!activeClinicId,
  });

  useEffect(() => {
    if (theme) {
      setColors({
        primary_color: theme.primary_color || DEFAULT_THEME.primary_color,
        secondary_color: theme.secondary_color || DEFAULT_THEME.secondary_color,
        accent_color: theme.accent_color || DEFAULT_THEME.accent_color,
        sidebar_bg: theme.sidebar_bg || DEFAULT_THEME.sidebar_bg,
        sidebar_text: theme.sidebar_text || DEFAULT_THEME.sidebar_text,
        header_bg: theme.header_bg || DEFAULT_THEME.header_bg,
        header_text: theme.header_text || DEFAULT_THEME.header_text,
        card_bg: theme.card_bg || DEFAULT_THEME.card_bg,
        card_border: theme.card_border || DEFAULT_THEME.card_border,
        button_primary: theme.button_primary || DEFAULT_THEME.button_primary,
        button_text: theme.button_text || DEFAULT_THEME.button_text,
        muted_color: theme.muted_color || DEFAULT_THEME.muted_color,
        destructive_color: theme.destructive_color || DEFAULT_THEME.destructive_color,
      });
    }
  }, [theme]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!activeClinicId) throw new Error("Clínica não selecionada");
      const payload = { clinic_id: activeClinicId, ...colors };
      const { error } = await (supabase as any)
        .from("clinic_theme")
        .upsert(payload, { onConflict: "clinic_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clinic-theme"] });
      toast.success("Tema salvo com sucesso!");
    },
    onError: (e: Error) => toast.error("Erro ao salvar tema", { description: e.message }),
  });

  const applyPreset = (preset: ThemeColors) => {
    setColors(preset);
  };

  const groupedFields = COLOR_FIELDS.reduce((acc, field) => {
    if (!acc[field.group]) acc[field.group] = [];
    acc[field.group].push(field);
    return acc;
  }, {} as Record<string, typeof COLOR_FIELDS>);

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6">
      {/* Presets */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" /> Temas Predefinidos
          </CardTitle>
          <CardDescription>Escolha um tema base e personalize as cores</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {PRESET_THEMES.map((preset) => (
              <button
                key={preset.name}
                onClick={() => applyPreset(preset.colors)}
                className="border rounded-lg p-3 text-left hover:border-primary transition-colors group"
              >
                <div className="flex gap-1.5 mb-2">
                  {[preset.colors.primary_color, preset.colors.secondary_color, preset.colors.accent_color, preset.colors.sidebar_bg].map((c, i) => (
                    <span key={i} className="w-5 h-5 rounded-full border shadow-sm" style={{ backgroundColor: c }} />
                  ))}
                </div>
                <span className="text-xs font-medium group-hover:text-primary transition-colors">{preset.name}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Custom color pickers */}
      {Object.entries(groupedFields).map(([group, fields]) => (
        <Card key={group}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">{group}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {fields.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label className="text-xs">{field.label}</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={colors[field.key]}
                      onChange={(e) => setColors({ ...colors, [field.key]: e.target.value })}
                      className="w-8 h-8 rounded border cursor-pointer"
                    />
                    <Input
                      value={colors[field.key]}
                      onChange={(e) => setColors({ ...colors, [field.key]: e.target.value })}
                      className="text-xs h-8 font-mono"
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Preview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Pré-visualização</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: colors.card_bg, borderColor: colors.card_border }}>
            {/* Header preview */}
            <div className="px-4 py-2 flex items-center gap-3" style={{ backgroundColor: colors.header_bg }}>
              <span className="font-bold text-sm" style={{ color: colors.header_text }}>Minha Clínica</span>
              <span className="ml-auto text-xs" style={{ color: colors.header_text, opacity: 0.6 }}>Dashboard</span>
            </div>
            <div className="flex">
              {/* Sidebar preview */}
              <div className="w-32 p-2 space-y-1 border-r" style={{ backgroundColor: colors.sidebar_bg, borderColor: colors.card_border }}>
                {["Início", "Agenda", "Pacientes", "Financeiro"].map((item) => (
                  <div key={item} className="text-xs px-2 py-1 rounded" style={{ color: colors.sidebar_text }}>
                    {item}
                  </div>
                ))}
              </div>
              {/* Content preview */}
              <div className="flex-1 p-3 space-y-2" style={{ backgroundColor: colors.muted_color }}>
                <div className="rounded-md p-3 border" style={{ backgroundColor: colors.card_bg, borderColor: colors.card_border }}>
                  <span className="text-xs font-medium" style={{ color: colors.header_text }}>Sessões Hoje</span>
                  <div className="text-lg font-bold mt-1" style={{ color: colors.primary_color }}>12</div>
                </div>
                <button className="text-xs px-3 py-1.5 rounded-md font-medium" style={{ backgroundColor: colors.button_primary, color: colors.button_text }}>
                  Novo Agendamento
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex gap-3">
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="gap-2">
          <Save className="h-4 w-4" /> {saveMutation.isPending ? "Salvando..." : "Salvar Tema"}
        </Button>
        <Button variant="outline" onClick={() => setColors(DEFAULT_THEME)} className="gap-2">
          <RotateCcw className="h-4 w-4" /> Restaurar Padrão
        </Button>
      </div>
    </div>
  );
}
