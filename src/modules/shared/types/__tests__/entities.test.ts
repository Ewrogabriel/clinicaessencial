/**
 * Type-level tests for src/modules/shared/types/entities.ts
 *
 * These tests verify that the consolidated types are importable and that
 * objects can be constructed against them, acting as a compile-time contract.
 */

import { describe, it, expect } from "vitest";
import type {
  PaymentEntry,
  FinancialSummary,
  Investment,
  InvestmentTransaction,
  BankTransactionRow,
  AppointmentRow,
  PatientRow,
  // Re-exported from @/types/entities
  Paciente,
  Agendamento,
  Pagamento,
} from "../entities";

describe("shared/types/entities – re-exported canonical types", () => {
  it("allows creating a valid Paciente", () => {
    const p: Paciente = {
      id: "id-1",
      nome: "Ana Silva",
      telefone: "11999998888",
      status: "ativo" as any,
      tipo_atendimento: "fisioterapia",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    expect(p.nome).toBe("Ana Silva");
  });

  it("allows creating a valid Agendamento", () => {
    const a: Agendamento = {
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
    expect(a.duracao_minutos).toBe(50);
  });

  it("allows creating a valid Pagamento", () => {
    const pg: Pagamento = {
      id: "pg-1",
      paciente_id: "p-1",
      profissional_id: "pr-1",
      valor: 150,
      data_pagamento: new Date().toISOString(),
      status: "pago" as any,
      created_at: new Date().toISOString(),
      created_by: "user-1",
    };
    expect(pg.valor).toBe(150);
  });
});

describe("shared/types/entities – new unified types", () => {
  it("allows creating a valid PaymentEntry", () => {
    const entry: PaymentEntry = {
      id: "pe-1",
      paciente_id: "p-1",
      valor: 200,
      status: "pendente",
      origem_tipo: "mensalidade",
    };
    expect(entry.origem_tipo).toBe("mensalidade");
    expect(entry.status).toBe("pendente");
  });

  it("PaymentEntry allows all valid origem_tipo values", () => {
    const origins: PaymentEntry["origem_tipo"][] = [
      "matricula",
      "mensalidade",
      "sessao_avulsa",
      "plano",
      "ajuste",
      "credito",
      "pagamento",
    ];
    expect(origins).toHaveLength(7);
  });

  it("PaymentEntry allows all valid status values", () => {
    const statuses: PaymentEntry["status"][] = [
      "pago",
      "pendente",
      "atrasado",
      "cancelado",
      "nao_iniciado",
      "parcialmente_pago",
    ];
    expect(statuses).toHaveLength(6);
  });

  it("allows creating a valid FinancialSummary", () => {
    const summary: FinancialSummary = {
      total_debito: 1000,
      total_pago: 500,
      total_pendente: 300,
      total_atrasado: 200,
      saldo_devedor: 500,
    };
    expect(summary.saldo_devedor).toBe(500);
  });

  it("allows creating a valid Investment", () => {
    const inv: Investment = {
      id: "inv-1",
      clinic_id: "clinic-1",
      tipo: "CDB",
      instituicao: "Banco Inter",
      valor_aplicado: 5000,
      data_aplicacao: "2026-01-01",
      status: "ativo",
      created_at: new Date().toISOString(),
    };
    expect(inv.tipo).toBe("CDB");
    expect(inv.status).toBe("ativo");
  });

  it("allows creating a valid InvestmentTransaction", () => {
    const tx: InvestmentTransaction = {
      id: "it-1",
      investment_id: "inv-1",
      tipo: "aplicacao",
      valor: 5000,
      data: "2026-01-01",
      created_at: new Date().toISOString(),
    };
    expect(tx.tipo).toBe("aplicacao");
  });

  it("allows creating a valid BankTransactionRow", () => {
    const row: BankTransactionRow = {
      id: "bt-1",
      bank_account_id: "ba-1",
      clinic_id: "clinic-1",
      data_transacao: "2026-03-01",
      descricao: "Pagamento paciente",
      valor: 150,
      tipo: "credito",
      status: "pendente",
      created_at: new Date().toISOString(),
    };
    expect(row.tipo).toBe("credito");
  });

  it("allows creating a valid AppointmentRow", () => {
    const row: AppointmentRow = {
      id: "ar-1",
      paciente_id: "p-1",
      profissional_id: "pr-1",
      data_horario: new Date().toISOString(),
      duracao_minutos: 50,
      tipo_atendimento: "fisioterapia",
      tipo_sessao: "individual",
      status: "agendado",
    };
    expect(row.status).toBe("agendado");
  });

  it("allows creating a valid PatientRow", () => {
    const row: PatientRow = {
      id: "p-1",
      nome: "João",
      telefone: "11999998888",
      status: "ativo",
      tipo_atendimento: "fisioterapia",
      created_at: new Date().toISOString(),
    };
    expect(row.nome).toBe("João");
  });
});
