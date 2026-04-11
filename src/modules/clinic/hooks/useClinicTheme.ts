/**
 * useClinicTheme
 *
 * Lê a `primary_color` das configurações da clínica e injeta as CSS custom
 * properties correspondentes em tempo real via `document.documentElement`.
 *
 * As variáveis são no formato HSL que o Tailwind/shadcn usa (sem `hsl()`):
 *   --primary: H S% L%
 *   --ring:    H S% L%
 *   --sidebar-primary: H S% L%
 *   --sidebar-ring:    H S% L%
 *
 * Chamar este hook uma única vez no App.tsx / layout raiz.
 */

import { useEffect } from "react";
import { useClinicSettings } from "./useClinicSettings";

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

// Calcula o foreground adequado (branco ou preto) com base na luminosidade
function foregroundForLightness(l: number): string {
  return l > 55 ? "170 30% 12%" : "0 0% 100%";
}

export function useClinicTheme() {
  const { data: settings } = useClinicSettings();

  useEffect(() => {
    const primaryHex = settings?.primary_color;
    if (!primaryHex) return;

    const hsl = hexToHsl(primaryHex);
    if (!hsl) return;

    const { h, s, l } = hsl;
    const primaryValue = `${h} ${s}% ${l}%`;
    // Sidebar ligeiramente mais claro/saturado
    const sidebarPrimaryValue = `${h} ${Math.min(s + 10, 100)}% ${Math.min(l + 8, 90)}%`;
    const foreground = foregroundForLightness(l);

    const root = document.documentElement;

    // Variáveis principais (modo claro — root)
    root.style.setProperty("--primary", primaryValue);
    root.style.setProperty("--primary-foreground", foreground);
    root.style.setProperty("--ring", primaryValue);
    root.style.setProperty("--accent", `${h} ${Math.max(s - 20, 10)}% ${Math.min(l + 40, 95)}%`);
    root.style.setProperty("--accent-foreground", `${h} ${s}% ${Math.max(l - 15, 15)}%`);

    // Sidebar
    root.style.setProperty("--sidebar-primary", sidebarPrimaryValue);
    root.style.setProperty("--sidebar-primary-foreground", "0 0% 100%");
    root.style.setProperty("--sidebar-ring", sidebarPrimaryValue);

    // Cor de fundo da sidebar (derivada, mais escura que a primária)
    const sidebarBg = `${h} ${Math.max(s - 15, 10)}% ${Math.max(l - 25, 8)}%`;
    root.style.setProperty("--sidebar-background", sidebarBg);
    root.style.setProperty("--sidebar-accent", `${h} ${Math.max(s - 10, 10)}% ${Math.max(l - 18, 12)}%`);
    root.style.setProperty("--sidebar-border", `${h} ${Math.max(s - 10, 10)}% ${Math.max(l - 15, 15)}%`);

    return () => {
      // Limpar as variáveis sobrescritas ao desmontar
      const vars = [
        "--primary", "--primary-foreground", "--ring", "--accent", "--accent-foreground",
        "--sidebar-primary", "--sidebar-primary-foreground", "--sidebar-ring",
        "--sidebar-background", "--sidebar-accent", "--sidebar-border",
      ];
      vars.forEach(v => root.style.removeProperty(v));
    };
  }, [settings?.primary_color]);
}
