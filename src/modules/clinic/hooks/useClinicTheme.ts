/**
 * useClinicTheme
 *
 * Lê as cores do tema da clínica da tabela `clinic_theme` e injeta as CSS
 * custom properties correspondentes em tempo real via `document.documentElement`.
 *
 * Chamar este hook uma única vez no App.tsx / layout raiz.
 */

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Converte hex (#rrggbb) para objeto {h, s, l}
function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const cleaned = hex.replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return null;

  const r = parseInt(cleaned.slice(0, 2), 16) / 255;
  const g = parseInt(cleaned.slice(2, 4), 16) / 255;
  const b = parseInt(cleaned.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

function hexToHslStr(hex: string): string | null {
  const hsl = hexToHsl(hex);
  if (!hsl) return null;
  return `${hsl.h} ${hsl.s}% ${hsl.l}%`;
}

// Calcula o foreground adequado (branco ou preto) com base na luminosidade
function foregroundForHex(hex: string): string {
  const hsl = hexToHsl(hex);
  if (!hsl) return "0 0% 100%";
  return hsl.l > 55 ? "170 30% 12%" : "0 0% 100%";
}

export function useClinicTheme() {
  // Fetch active clinic id
  const { data: clinicUser } = useQuery({
    queryKey: ["clinic-user-for-theme"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("clinic_users")
        .select("clinic_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      return data;
    },
    staleTime: 1000 * 60 * 30,
  });

  const clinicId = clinicUser?.clinic_id;

  const { data: theme } = useQuery({
    queryKey: ["clinic-theme-active", clinicId],
    queryFn: async () => {
      if (!clinicId) return null;
      const { data } = await (supabase as any)
        .from("clinic_theme")
        .select("*")
        .eq("clinic_id", clinicId)
        .maybeSingle();
      return data;
    },
    enabled: !!clinicId,
    staleTime: 1000 * 60 * 10,
  });

  useEffect(() => {
    if (!theme) return;

    const root = document.documentElement;
    const vars: string[] = [];

    const apply = (cssVar: string, hexValue: string | null) => {
      if (!hexValue) return;
      const hslStr = hexToHslStr(hexValue);
      if (!hslStr) return;
      root.style.setProperty(cssVar, hslStr);
      vars.push(cssVar);
    };

    // Primary colors
    if (theme.primary_color) {
      apply("--primary", theme.primary_color);
      root.style.setProperty("--primary-foreground", foregroundForHex(theme.primary_color));
      vars.push("--primary-foreground");
      apply("--ring", theme.primary_color);
    }

    if (theme.accent_color) {
      apply("--accent", theme.accent_color);
      const fg = foregroundForHex(theme.accent_color);
      root.style.setProperty("--accent-foreground", fg);
      vars.push("--accent-foreground");
    }

    if (theme.destructive_color) {
      apply("--destructive", theme.destructive_color);
    }

    if (theme.muted_color) {
      apply("--muted", theme.muted_color);
    }

    if (theme.card_bg) {
      apply("--card", theme.card_bg);
    }

    if (theme.card_border) {
      apply("--border", theme.card_border);
    }

    // Sidebar
    if (theme.sidebar_bg) {
      apply("--sidebar-background", theme.sidebar_bg);
    }
    if (theme.sidebar_text) {
      apply("--sidebar-foreground", theme.sidebar_text);
    }
    if (theme.primary_color) {
      apply("--sidebar-primary", theme.primary_color);
      root.style.setProperty("--sidebar-primary-foreground", "0 0% 100%");
      vars.push("--sidebar-primary-foreground");
      apply("--sidebar-ring", theme.primary_color);
      // Sidebar accent derived
      const hsl = hexToHsl(theme.primary_color);
      if (hsl) {
        const sidebarAccent = `${hsl.h} ${Math.max(hsl.s - 10, 10)}% ${Math.max(hsl.l - 18, 12)}%`;
        root.style.setProperty("--sidebar-accent", sidebarAccent);
        vars.push("--sidebar-accent");
        const sidebarBorder = `${hsl.h} ${Math.max(hsl.s - 10, 10)}% ${Math.max(hsl.l - 15, 15)}%`;
        root.style.setProperty("--sidebar-border", sidebarBorder);
        vars.push("--sidebar-border");
      }
    }

    // Button primary → same as primary (already applied)

    return () => {
      vars.forEach(v => root.style.removeProperty(v));
    };
  }, [theme]);
}
