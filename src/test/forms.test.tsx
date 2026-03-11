import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock form validation patterns
describe("Form Validation", () => {
  describe("Patient Registration Form", () => {
    const validatePatientForm = (data: {
      nome?: string;
      cpf?: string;
      email?: string;
      telefone?: string;
      data_nascimento?: string;
    }) => {
      const errors: string[] = [];

      if (!data.nome || data.nome.length < 3) {
        errors.push("Nome deve ter pelo menos 3 caracteres");
      }

      if (!data.cpf || data.cpf.replace(/\D/g, "").length !== 11) {
        errors.push("CPF inválido");
      }

      if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        errors.push("Email inválido");
      }

      if (data.telefone && data.telefone.replace(/\D/g, "").length < 10) {
        errors.push("Telefone inválido");
      }

      return { isValid: errors.length === 0, errors };
    };

    it("should validate valid patient data", () => {
      const result = validatePatientForm({
        nome: "João Silva",
        cpf: "123.456.789-01",
        email: "joao@email.com",
        telefone: "(11) 99999-9999",
      });
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject short name", () => {
      const result = validatePatientForm({
        nome: "Jo",
        cpf: "123.456.789-01",
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Nome deve ter pelo menos 3 caracteres");
    });

    it("should reject invalid CPF", () => {
      const result = validatePatientForm({
        nome: "João Silva",
        cpf: "123",
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("CPF inválido");
    });

    it("should reject invalid email", () => {
      const result = validatePatientForm({
        nome: "João Silva",
        cpf: "123.456.789-01",
        email: "invalid-email",
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Email inválido");
    });
  });

  describe("Session Scheduling Form", () => {
    const validateSessionForm = (data: {
      paciente_id?: string;
      profissional_id?: string;
      data_horario?: string;
      tipo_atendimento?: string;
    }) => {
      const errors: string[] = [];

      if (!data.paciente_id) {
        errors.push("Selecione um paciente");
      }

      if (!data.profissional_id) {
        errors.push("Selecione um profissional");
      }

      if (!data.data_horario) {
        errors.push("Selecione data e horário");
      } else {
        const date = new Date(data.data_horario);
        if (date < new Date()) {
          errors.push("Data não pode ser no passado");
        }
      }

      if (!data.tipo_atendimento) {
        errors.push("Selecione o tipo de atendimento");
      }

      return { isValid: errors.length === 0, errors };
    };

    it("should validate valid session data", () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);

      const result = validateSessionForm({
        paciente_id: "patient-1",
        profissional_id: "prof-1",
        data_horario: futureDate.toISOString(),
        tipo_atendimento: "consulta",
      });
      expect(result.isValid).toBe(true);
    });

    it("should require patient selection", () => {
      const result = validateSessionForm({
        profissional_id: "prof-1",
        data_horario: new Date().toISOString(),
        tipo_atendimento: "consulta",
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Selecione um paciente");
    });

    it("should reject past dates", () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const result = validateSessionForm({
        paciente_id: "patient-1",
        profissional_id: "prof-1",
        data_horario: pastDate.toISOString(),
        tipo_atendimento: "consulta",
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Data não pode ser no passado");
    });
  });

  describe("Payment Form", () => {
    const validatePaymentForm = (data: {
      valor?: number;
      forma_pagamento?: string;
      paciente_id?: string;
    }) => {
      const errors: string[] = [];

      if (!data.valor || data.valor <= 0) {
        errors.push("Valor deve ser maior que zero");
      }

      if (!data.forma_pagamento) {
        errors.push("Selecione a forma de pagamento");
      }

      if (!data.paciente_id) {
        errors.push("Selecione um paciente");
      }

      return { isValid: errors.length === 0, errors };
    };

    it("should validate valid payment data", () => {
      const result = validatePaymentForm({
        valor: 150.00,
        forma_pagamento: "cartao_credito",
        paciente_id: "patient-1",
      });
      expect(result.isValid).toBe(true);
    });

    it("should reject zero value", () => {
      const result = validatePaymentForm({
        valor: 0,
        forma_pagamento: "dinheiro",
        paciente_id: "patient-1",
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Valor deve ser maior que zero");
    });

    it("should reject negative value", () => {
      const result = validatePaymentForm({
        valor: -100,
        forma_pagamento: "dinheiro",
        paciente_id: "patient-1",
      });
      expect(result.isValid).toBe(false);
    });
  });

  describe("Exercise Plan Form", () => {
    const validateExercisePlanForm = (data: {
      nome?: string;
      descricao?: string;
      paciente_id?: string;
      exercicios?: Array<{ nome: string; series?: number; repeticoes?: number }>;
    }) => {
      const errors: string[] = [];

      if (!data.nome || data.nome.length < 3) {
        errors.push("Nome do plano deve ter pelo menos 3 caracteres");
      }

      if (!data.paciente_id) {
        errors.push("Selecione um paciente");
      }

      if (!data.exercicios || data.exercicios.length === 0) {
        errors.push("Adicione pelo menos um exercício");
      }

      return { isValid: errors.length === 0, errors };
    };

    it("should validate valid exercise plan", () => {
      const result = validateExercisePlanForm({
        nome: "Plano de Reabilitação",
        descricao: "Exercícios para lombar",
        paciente_id: "patient-1",
        exercicios: [{ nome: "Alongamento", series: 3, repeticoes: 10 }],
      });
      expect(result.isValid).toBe(true);
    });

    it("should require at least one exercise", () => {
      const result = validateExercisePlanForm({
        nome: "Plano Vazio",
        paciente_id: "patient-1",
        exercicios: [],
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Adicione pelo menos um exercício");
    });
  });
});

describe("Input Masks", () => {
  const maskCPF = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  };

  const maskPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 10) {
      return digits
        .replace(/(\d{2})(\d)/, "($1) $2")
        .replace(/(\d{4})(\d)/, "$1-$2");
    }
    return digits
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2");
  };

  const maskCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  it("should mask CPF correctly", () => {
    expect(maskCPF("12345678901")).toBe("123.456.789-01");
    expect(maskCPF("123")).toBe("123");
    expect(maskCPF("12345")).toBe("123.45");
  });

  it("should mask phone correctly", () => {
    expect(maskPhone("11999999999")).toBe("(11) 99999-9999");
    expect(maskPhone("1199999999")).toBe("(11) 9999-9999");
  });

  it("should mask currency correctly", () => {
    const result = maskCurrency(1500.50);
    expect(result).toContain("R$");
    expect(result.includes("1.500,50") || result.includes("1500,50")).toBe(true);
  });
});

describe("Form State Management", () => {
  it("should track form dirty state", () => {
    const initialValues = { name: "John", email: "john@example.com" };
    const currentValues = { name: "John Doe", email: "john@example.com" };
    
    const isDirty = JSON.stringify(initialValues) !== JSON.stringify(currentValues);
    expect(isDirty).toBe(true);
  });

  it("should track form pristine state", () => {
    const initialValues = { name: "John", email: "john@example.com" };
    const currentValues = { name: "John", email: "john@example.com" };
    
    const isPristine = JSON.stringify(initialValues) === JSON.stringify(currentValues);
    expect(isPristine).toBe(true);
  });

  it("should validate on blur", () => {
    const validateField = (field: string, value: string) => {
      if (field === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return "Email inválido";
      }
      return null;
    };

    expect(validateField("email", "invalid")).toBe("Email inválido");
    expect(validateField("email", "valid@email.com")).toBeNull();
  });
});
