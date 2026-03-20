// All available system resources for permission configuration
export const ALL_RESOURCES = [
  { key: "agenda", label: "Agenda", description: "Visualizar e gerenciar agendamentos" },
  { key: "pacientes", label: "Pacientes", description: "Cadastro e gestão de pacientes" },
  { key: "prontuarios", label: "Prontuários", description: "Avaliações e evoluções clínicas" },
  { key: "modalidades", label: "Modalidades", description: "Tipos de atendimento" },
  { key: "disponibilidade", label: "Disponibilidade", description: "Horários disponíveis" },
  { key: "financeiro", label: "Financeiro", description: "Pagamentos e receitas" },
  { key: "matriculas", label: "Matrículas", description: "Matrículas e mensalidades" },
  { key: "planos", label: "Planos", description: "Planos de sessões" },
  { key: "produtos", label: "Produtos", description: "Catálogo de produtos" },
  { key: "comissoes", label: "Comissões", description: "Regras e cálculo de comissões" },
  { key: "precos_planos", label: "Preços & Descontos", description: "Tabela de preços e descontos" },
  { key: "despesas", label: "Despesas", description: "Controle de despesas" },
  { key: "contratos", label: "Contratos", description: "Geração de contratos" },
  { key: "relatorios", label: "Relatórios", description: "Relatórios gerenciais" },
  { key: "avisos", label: "Mural de Avisos", description: "Publicar e gerenciar avisos" },
  { key: "mensagens", label: "Mensagens", description: "Mensagens internas" },
  { key: "aniversariantes", label: "Aniversariantes", description: "Lista de aniversariantes" },
  { key: "clinica", label: "Dados da Clínica", description: "Configurações da clínica" },
  { key: "dicas_diarias", label: "Dicas Diárias", description: "Dicas com IA" },
  { key: "inteligencia", label: "Inteligência", description: "Insights com IA" },
  { key: "automacoes", label: "Automações", description: "Fluxos automatizados" },
  { key: "indicadores", label: "Indicadores", description: "KPIs e indicadores" },
  { key: "profissionais", label: "Profissionais", description: "Gestão de profissionais" },
  { key: "check_in", label: "Check-in", description: "Check-in de pacientes" },
] as const;

// Default permissions per role
export const DEFAULT_PERMISSIONS: Record<string, string[]> = {
  profissional: [
    "agenda", "pacientes", "prontuarios", "disponibilidade",
    "comissoes", "mensagens", "check_in",
  ],
  secretario: [
    "agenda", "pacientes", "matriculas", "financeiro",
    "planos", "mensagens", "aniversariantes", "produtos",
  ],
};
