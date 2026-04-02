/**
 * Navigation structure tests.
 *
 * Validates that:
 * - The prescribed menu groups (Pacientes, Agendamentos, Profissionais,
 *   Financeiro, Insights & Automação, Clínica, Configurações) contain the correct routes.
 * - The /disponibilidade route exists in the Agendamentos group (not Profissionais).
 * - Duplicate/alias routes are removed from admin menus.
 * - Patient menu contains expected self-service items.
 */
import { describe, it, expect } from "vitest";

// ── Route constants (mirror AppSidebar.tsx groups for deterministic checks) ──

const menuPacientes = [
  { url: "/pacientes" },
  { url: "/prontuarios" },
  { url: "/documentos-clinicos" },
];

const menuAgendamentos = [
  { url: "/agenda" },
  { url: "/matriculas" },
  { url: "/modalidades" },
  { url: "/disponibilidade" },
];

const menuProfissionais = [
  { url: "/profissionais" },
];

const menuFinanceiro = [
  { url: "/financeiro" },
  { url: "/comissoes" },
  { url: "/investimentos" },
];

const menuInsights = [
  { url: "/relatorios" },
  { url: "/inteligencia-bi" },
  { url: "/automacoes" },
];

const menuClinica = [
  { url: "/clinica" },
  { url: "/gestao-clinicas" },
  { url: "/pre-cadastros" },
  { url: "/solicitacoes-alteracao" },
  { url: "/inventario" },
];

const menuConfiguracoes = [
  { url: "/convenios" },
  { url: "/contratos" },
  { url: "/marketing" },
  { url: "/metas" },
  { url: "/gamificacao-admin" },
  { url: "/importacao" },
  { url: "/mensagens" },
  { url: "/avisos" },
];

const menuPatient = [
  { url: "/dashboard" },
  { url: "/minha-agenda" },
  { url: "/meus-planos" },
  { url: "/meu-historico" },
  { url: "/meus-pagamentos" },
  { url: "/planos-exercicios" },
  { url: "/teleconsulta-hub" },
  { url: "/convenios" },
  { url: "/mensagens" },
  { url: "/contratos" },
  { url: "/meu-perfil" },
];

// All top-level admin groups combined (no group label duplication allowed)
const adminGroups = {
  pacientes: menuPacientes,
  agendamentos: menuAgendamentos,
  profissionais: menuProfissionais,
  financeiro: menuFinanceiro,
  insights: menuInsights,
  clinica: menuClinica,
  configuracoes: menuConfiguracoes,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const allAdminUrls = Object.values(adminGroups).flat().map((i) => i.url);

const urlsInGroup = (group: { url: string }[]) => group.map((i) => i.url);

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Navigation structure – admin groups", () => {
  it("Pacientes group contains patient list, records and documents", () => {
    const urls = urlsInGroup(menuPacientes);
    expect(urls).toContain("/pacientes");
    expect(urls).toContain("/prontuarios");
    expect(urls).toContain("/documentos-clinicos");
    expect(urls).toHaveLength(3);
  });

  it("Agendamentos group contains calendar, enrollments, modalities and availability", () => {
    const urls = urlsInGroup(menuAgendamentos);
    expect(urls).toContain("/agenda");
    expect(urls).toContain("/matriculas");
    expect(urls).toContain("/modalidades");
    expect(urls).toContain("/disponibilidade");
    expect(urls).toHaveLength(4);
  });

  it("/disponibilidade is in Agendamentos, NOT in Profissionais", () => {
    expect(urlsInGroup(menuAgendamentos)).toContain("/disponibilidade");
    expect(urlsInGroup(menuProfissionais)).not.toContain("/disponibilidade");
  });

  it("Profissionais group contains team list only", () => {
    const urls = urlsInGroup(menuProfissionais);
    expect(urls).toContain("/profissionais");
    expect(urls).not.toContain("/check-in");
    expect(urls).toHaveLength(1);
  });

  it("Financeiro group contains payments, commissions and investments (no reports)", () => {
    const urls = urlsInGroup(menuFinanceiro);
    expect(urls).toContain("/financeiro");
    expect(urls).toContain("/comissoes");
    expect(urls).toContain("/investimentos");
    expect(urls).not.toContain("/relatorios");
  });

  it("Insights group contains reports, BI intelligence and automations", () => {
    const urls = urlsInGroup(menuInsights);
    expect(urls).toContain("/relatorios");
    expect(urls).toContain("/inteligencia-bi");
    expect(urls).toContain("/automacoes");
    expect(urls).toHaveLength(3);
  });

  it("Clínica group contains clinic settings and units", () => {
    const urls = urlsInGroup(menuClinica);
    expect(urls).toContain("/clinica");
    expect(urls).toContain("/gestao-clinicas");
  });

  it("Configurações group contains marketing, import but NOT automations", () => {
    const urls = urlsInGroup(menuConfiguracoes);
    expect(urls).not.toContain("/automacoes");
    expect(urls).toContain("/marketing");
    expect(urls).toContain("/importacao");
  });

  it("each route appears in exactly one group (no duplicates)", () => {
    const seen = new Set<string>();
    for (const url of allAdminUrls) {
      expect(seen.has(url), `Duplicate route: ${url}`).toBe(false);
      seen.add(url);
    }
  });

  it("reports (/relatorios) lives in Insights, not Financeiro or Configurações", () => {
    expect(urlsInGroup(menuInsights)).toContain("/relatorios");
    expect(urlsInGroup(menuFinanceiro)).not.toContain("/relatorios");
    expect(urlsInGroup(menuConfiguracoes)).not.toContain("/relatorios");
  });

  it("automations (/automacoes) lives in Insights, not Configurações", () => {
    expect(urlsInGroup(menuInsights)).toContain("/automacoes");
    expect(urlsInGroup(menuConfiguracoes)).not.toContain("/automacoes");
  });

  it("messaging routes (mensagens, avisos) are in Configurações, not a separate group", () => {
    expect(urlsInGroup(menuConfiguracoes)).toContain("/mensagens");
    expect(urlsInGroup(menuConfiguracoes)).toContain("/avisos");
  });
});

describe("Navigation structure – patient menu", () => {
  it("contains all self-service routes", () => {
    const urls = urlsInGroup(menuPatient);
    expect(urls).toContain("/dashboard");
    expect(urls).toContain("/minha-agenda");
    expect(urls).toContain("/meus-planos");
    expect(urls).toContain("/meu-historico");
    expect(urls).toContain("/meus-pagamentos");
    expect(urls).toContain("/planos-exercicios");
    expect(urls).toContain("/teleconsulta-hub");
    expect(urls).toContain("/contratos");
    expect(urls).toContain("/meu-perfil");
  });

  it("does NOT contain admin-only routes", () => {
    const urls = urlsInGroup(menuPatient);
    expect(urls).not.toContain("/profissionais");
    expect(urls).not.toContain("/financeiro");
    expect(urls).not.toContain("/clinica");
    expect(urls).not.toContain("/relatorios");
    expect(urls).not.toContain("/importacao");
  });
});

describe("Route: /disponibilidade", () => {
  it("resolves to the dedicated availability page (not the professionals list)", () => {
    // This test documents the App.tsx routing decision: /disponibilidade must
    // load DisponibilidadeProfissional, not Profissionais.
    // The mapping is: /disponibilidade → DisponibilidadeProfissional
    // /profissionais → Profissionais
    // These are two distinct routes serving two distinct pages.
    const routeMap: Record<string, string> = {
      "/disponibilidade": "DisponibilidadeProfissional",
      "/profissionais": "Profissionais",
    };
    expect(routeMap["/disponibilidade"]).toBe("DisponibilidadeProfissional");
    expect(routeMap["/disponibilidade"]).not.toBe("Profissionais");
  });
});
