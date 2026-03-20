import { describe, it, expect } from "vitest";
import type { Paciente, Agendamento, Plano, Pagamento, Matricula, ClinicSettings, StatusConfig } from "../entities";

describe("Entity type contracts", () => {
  it("should allow creating a valid Paciente object", () => {
    const paciente: Paciente = {
      id: "uuid-1",
      nome: "João Silva",
      telefone: "11999998888",
      status: "ativo" as any,
      tipo_atendimento: "fisioterapia",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    expect(paciente.nome).toBe("João Silva");
    expect(paciente.id).toBeDefined();
  });

  it("should allow optional fields to be null/undefined", () => {
    const paciente: Paciente = {
      id: "uuid-2",
      nome: "Maria",
      telefone: "11888887777",
      status: "ativo" as any,
      tipo_atendimento: "pilates",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      email: null,
      cpf: undefined,
      data_nascimento: null,
      foto_url: null,
    };
    expect(paciente.email).toBeNull();
    expect(paciente.cpf).toBeUndefined();
  });

  it("should allow creating a valid Agendamento", () => {
    const agendamento: Agendamento = {
      id: "ag-1",
      paciente_id: "p-1",
      profissional_id: "pr-1",
      data_horario: new Date().toISOString(),
      duracao_minutos: 50,
      tipo_atendimento: "fisioterapia",
      tipo_sessao: "individual" as any,
      status: "agendado" as any,
      recorrente: false,
      created_at: new Date().toISOString(),
      created_by: "user-1",
    };
    expect(agendamento.duracao_minutos).toBe(50);
    expect(agendamento.recorrente).toBe(false);
  });

  it("should allow creating a valid ClinicSettings", () => {
    const settings: ClinicSettings = {
      id: "cs-1",
      nome: "Clínica Essencial",
      cnpj: "12.345.678/0001-99",
      telefone: "1133334444",
    };
    expect(settings.nome).toBe("Clínica Essencial");
  });

  it("should enforce StatusConfig structure", () => {
    const config: StatusConfig = {
      label: "Agendado",
      variant: "default",
    };
    expect(config.label).toBe("Agendado");
    expect(["default", "secondary", "destructive", "outline"]).toContain(config.variant);
  });
});
