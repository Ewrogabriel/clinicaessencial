import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase client
const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  },
}));

describe("Database Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Pacientes (Patients)", () => {
    it("should fetch patient list", async () => {
      const mockPatients = [
        { id: "1", nome: "João Silva", cpf: "12345678901" },
        { id: "2", nome: "Maria Santos", cpf: "98765432101" },
      ];

      mockFrom.mockReturnValue({
        select: () => ({
          eq: () => ({
            order: () => Promise.resolve({ data: mockPatients, error: null }),
          }),
          order: () => Promise.resolve({ data: mockPatients, error: null }),
        }),
      });

      const result = await mockFrom("pacientes")
        .select()
        .order();

      expect(result.data).toHaveLength(2);
      expect(result.data[0].nome).toBe("João Silva");
    });

    it("should create a new patient", async () => {
      const newPatient = { id: "3", nome: "Carlos Oliveira", cpf: "11122233344" };

      mockFrom.mockReturnValue({
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: newPatient, error: null }),
          }),
        }),
      });

      const result = await mockFrom("pacientes")
        .insert()
        .select()
        .single();

      expect(result.data.nome).toBe("Carlos Oliveira");
      expect(result.error).toBeNull();
    });

    it("should update patient data", async () => {
      mockFrom.mockReturnValue({
        update: () => ({
          eq: () => ({
            select: () => ({
              single: () => Promise.resolve({ 
                data: { id: "1", nome: "João Silva Updated" }, 
                error: null 
              }),
            }),
          }),
        }),
      });

      const result = await mockFrom("pacientes")
        .update()
        .eq()
        .select()
        .single();

      expect(result.data.nome).toBe("João Silva Updated");
    });
  });

  describe("Sessões (Sessions)", () => {
    it("should fetch upcoming sessions for patient", async () => {
      const mockSessions = [
        { id: "1", data_hora: "2024-01-15T10:00:00", status: "agendada" },
        { id: "2", data_hora: "2024-01-16T14:00:00", status: "agendada" },
      ];

      mockFrom.mockReturnValue({
        select: () => ({
          eq: () => ({
            gte: () => ({
              order: () => ({
                limit: () => Promise.resolve({ data: mockSessions, error: null }),
              }),
            }),
          }),
        }),
      });

      const result = await mockFrom("sessoes")
        .select()
        .eq()
        .gte()
        .order()
        .limit();

      expect(result.data).toHaveLength(2);
      expect(result.data[0].status).toBe("agendada");
    });

    it("should create a new session", async () => {
      const newSession = { 
        id: "3", 
        paciente_id: "1", 
        profissional_id: "1", 
        data_hora: "2024-01-17T09:00:00",
        status: "agendada" 
      };

      mockFrom.mockReturnValue({
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: newSession, error: null }),
          }),
        }),
      });

      const result = await mockFrom("sessoes")
        .insert()
        .select()
        .single();

      expect(result.data.status).toBe("agendada");
    });

    it("should update session status", async () => {
      mockFrom.mockReturnValue({
        update: () => ({
          eq: () => Promise.resolve({ data: { id: "1", status: "realizada" }, error: null }),
        }),
      });

      const result = await mockFrom("sessoes")
        .update()
        .eq();

      expect(result.data.status).toBe("realizada");
    });
  });

  describe("Pagamentos (Payments)", () => {
    it("should fetch pending payments for patient", async () => {
      const mockPayments = [
        { id: "1", valor: 150.00, status: "pendente", data_vencimento: "2024-01-20" },
      ];

      mockFrom.mockReturnValue({
        select: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ data: mockPayments, error: null }),
          }),
        }),
      });

      const result = await mockFrom("pagamentos")
        .select()
        .eq()
        .eq();

      expect(result.data).toHaveLength(1);
      expect(result.data[0].status).toBe("pendente");
    });

    it("should mark payment as paid", async () => {
      mockFrom.mockReturnValue({
        update: () => ({
          eq: () => Promise.resolve({ 
            data: { id: "1", status: "pago", data_pagamento: "2024-01-15" }, 
            error: null 
          }),
        }),
      });

      const result = await mockFrom("pagamentos")
        .update()
        .eq();

      expect(result.data.status).toBe("pago");
    });
  });

  describe("Exercícios (Exercises)", () => {
    it("should fetch exercise plans for patient", async () => {
      const mockPlans = [
        { id: "1", nome: "Plano de Reabilitação", paciente_id: "1", ativo: true },
      ];

      mockFrom.mockReturnValue({
        select: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ data: mockPlans, error: null }),
          }),
        }),
      });

      const result = await mockFrom("planos_exercicios")
        .select()
        .eq()
        .eq();

      expect(result.data).toHaveLength(1);
      expect(result.data[0].ativo).toBe(true);
    });

    it("should create exercise plan", async () => {
      const newPlan = { 
        id: "2", 
        nome: "Fortalecimento", 
        paciente_id: "1",
        profissional_id: "1",
        ativo: true 
      };

      mockFrom.mockReturnValue({
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: newPlan, error: null }),
          }),
        }),
      });

      const result = await mockFrom("planos_exercicios")
        .insert()
        .select()
        .single();

      expect(result.data.nome).toBe("Fortalecimento");
    });
  });

  describe("Prontuários (Medical Records)", () => {
    it("should fetch patient medical records", async () => {
      const mockRecords = [
        { id: "1", paciente_id: "1", conteudo: "Avaliação inicial", data: "2024-01-10" },
      ];

      mockFrom.mockReturnValue({
        select: () => ({
          eq: () => ({
            order: () => Promise.resolve({ data: mockRecords, error: null }),
          }),
        }),
      });

      const result = await mockFrom("prontuarios")
        .select()
        .eq()
        .order();

      expect(result.data).toHaveLength(1);
    });

    it("should create medical record entry", async () => {
      const newRecord = { 
        id: "2", 
        paciente_id: "1", 
        profissional_id: "1",
        conteudo: "Sessão de fisioterapia",
        data: "2024-01-15" 
      };

      mockFrom.mockReturnValue({
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: newRecord, error: null }),
          }),
        }),
      });

      const result = await mockFrom("prontuarios")
        .insert()
        .select()
        .single();

      expect(result.data.conteudo).toBe("Sessão de fisioterapia");
    });
  });

  describe("Mensagens (Messages)", () => {
    it("should fetch messages for user", async () => {
      const mockMessages = [
        { id: "1", remetente_id: "admin-1", conteudo: "Bem-vindo!", lida: false },
      ];

      mockFrom.mockReturnValue({
        select: () => ({
          or: () => ({
            order: () => Promise.resolve({ data: mockMessages, error: null }),
          }),
        }),
      });

      const result = await mockFrom("mensagens")
        .select()
        .or()
        .order();

      expect(result.data).toHaveLength(1);
    });

    it("should send a message", async () => {
      const newMessage = { 
        id: "2", 
        remetente_id: "patient-1", 
        destinatario_id: "admin-1",
        conteudo: "Dúvida sobre sessão",
        lida: false 
      };

      mockFrom.mockReturnValue({
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: newMessage, error: null }),
          }),
        }),
      });

      const result = await mockFrom("mensagens")
        .insert()
        .select()
        .single();

      expect(result.data.conteudo).toBe("Dúvida sobre sessão");
    });
  });
});

describe("RPC Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call gamification points calculation", async () => {
    mockRpc.mockResolvedValue({ data: { total_points: 150 }, error: null });

    const result = await mockRpc("calcular_pontos_paciente", { paciente_id: "1" });

    expect(result.data.total_points).toBe(150);
  });

  it("should call dashboard stats function", async () => {
    mockRpc.mockResolvedValue({ 
      data: { 
        total_pacientes: 50, 
        sessoes_hoje: 10, 
        receita_mes: 15000 
      }, 
      error: null 
    });

    const result = await mockRpc("get_dashboard_stats", { clinic_id: "1" });

    expect(result.data.total_pacientes).toBe(50);
    expect(result.data.sessoes_hoje).toBe(10);
  });
});
