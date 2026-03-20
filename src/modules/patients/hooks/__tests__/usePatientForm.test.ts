/**
 * Unit tests for usePatientForm hook.
 *
 * All external dependencies (router, Supabase, auth, clinic, react-query)
 * are mocked so tests run fully in-process without a DOM or network.
 *
 * The test scope focuses on:
 *  - Correct initial grouped state defaults
 *  - setBasicField / setAddressField / setGuardianField / setInvoiceField /
 *    setClinicalField convenience setters
 *  - copyAddressToGuardian
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// ── Mock heavy external dependencies ─────────────────────────────────────────

const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ id: undefined }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: [] }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
    storage: { from: vi.fn(() => ({ upload: vi.fn(), getPublicUrl: vi.fn(() => ({ data: { publicUrl: "" } })) })) },
    functions: { invoke: vi.fn() },
  },
}));

vi.mock("@/modules/auth/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/modules/clinic/hooks/useClinic", () => ({
  useClinic: () => ({ activeClinicId: "clinic-1" }),
}));

vi.mock("@/modules/shared/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

// Mock UI components required by the hook (JSX in toast action)
vi.mock("@/components/ui/button", () => ({
  Button: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("lucide-react", () => ({
  Copy: () => null,
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { usePatientForm } from "../usePatientForm";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("usePatientForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("initial state", () => {
    it("starts with empty basic fields", () => {
      const { result } = renderHook(() => usePatientForm());
      const { basic } = result.current;
      expect(basic.nome).toBe("");
      expect(basic.cpf).toBe("");
      expect(basic.rg).toBe("");
      expect(basic.telefone).toBe("");
      expect(basic.email).toBe("");
      expect(basic.dataNascimento).toBe("");
      expect(basic.fotoUrl).toBe("");
      expect(basic.sexo).toBe("");
      expect(basic.identidadeGenero).toBe("");
      expect(basic.nomeSocial).toBe("");
    });

    it("starts with empty address fields", () => {
      const { result } = renderHook(() => usePatientForm());
      const { address } = result.current;
      expect(address.cep).toBe("");
      expect(address.rua).toBe("");
      expect(address.numero).toBe("");
      expect(address.complemento).toBe("");
      expect(address.bairro).toBe("");
      expect(address.cidade).toBe("");
      expect(address.estado).toBe("");
    });

    it("starts with guardian disabled", () => {
      const { result } = renderHook(() => usePatientForm());
      expect(result.current.guardian.temResponsavel).toBe(false);
    });

    it("starts with invoice disabled", () => {
      const { result } = renderHook(() => usePatientForm());
      expect(result.current.invoice.solicitaNf).toBe(false);
    });

    it("starts with clinical status = ativo", () => {
      const { result } = renderHook(() => usePatientForm());
      expect(result.current.clinical.status).toBe("ativo");
    });

    it("starts with LGPD consent off", () => {
      const { result } = renderHook(() => usePatientForm());
      expect(result.current.lgpdConsentimento).toBe(false);
    });

    it("isEditing is false when no id param", () => {
      const { result } = renderHook(() => usePatientForm());
      expect(result.current.isEditing).toBe(false);
    });
  });

  describe("setBasicField", () => {
    it("updates a single basic field without touching others", () => {
      const { result } = renderHook(() => usePatientForm());
      act(() => {
        result.current.setBasicField("nome", "João Silva");
      });
      expect(result.current.basic.nome).toBe("João Silva");
      expect(result.current.basic.cpf).toBe(""); // untouched
    });

    it("can update multiple basic fields independently", () => {
      const { result } = renderHook(() => usePatientForm());
      act(() => {
        result.current.setBasicField("nome", "Ana");
        result.current.setBasicField("email", "ana@example.com");
      });
      expect(result.current.basic.nome).toBe("Ana");
      expect(result.current.basic.email).toBe("ana@example.com");
    });
  });

  describe("setAddressField", () => {
    it("updates a single address field without touching others", () => {
      const { result } = renderHook(() => usePatientForm());
      act(() => {
        result.current.setAddressField("cidade", "São Paulo");
      });
      expect(result.current.address.cidade).toBe("São Paulo");
      expect(result.current.address.cep).toBe(""); // untouched
    });
  });

  describe("setGuardianField", () => {
    it("updates a single guardian field", () => {
      const { result } = renderHook(() => usePatientForm());
      act(() => {
        result.current.setGuardianField("nome", "Maria Responsável");
      });
      expect(result.current.guardian.nome).toBe("Maria Responsável");
      expect(result.current.guardian.temResponsavel).toBe(false); // untouched
    });
  });

  describe("setInvoiceField", () => {
    it("activates invoice flag", () => {
      const { result } = renderHook(() => usePatientForm());
      act(() => {
        result.current.setInvoiceField("solicitaNf", true);
      });
      expect(result.current.invoice.solicitaNf).toBe(true);
    });
  });

  describe("setClinicalField", () => {
    it("updates status to inativo", () => {
      const { result } = renderHook(() => usePatientForm());
      act(() => {
        result.current.setClinicalField("status", "inativo");
      });
      expect(result.current.clinical.status).toBe("inativo");
    });
  });

  describe("copyAddressToGuardian", () => {
    it("copies patient address into guardian address fields", () => {
      const { result } = renderHook(() => usePatientForm());

      // Set patient address
      act(() => {
        result.current.setAddressField("cep", "01310-100");
        result.current.setAddressField("rua", "Av. Paulista");
        result.current.setAddressField("numero", "1000");
        result.current.setAddressField("complemento", "Apto 5");
        result.current.setAddressField("bairro", "Bela Vista");
        result.current.setAddressField("cidade", "São Paulo");
        result.current.setAddressField("estado", "SP");
      });

      // Copy to guardian
      act(() => {
        result.current.copyAddressToGuardian();
      });

      const { guardian } = result.current;
      expect(guardian.cep).toBe("01310-100");
      expect(guardian.rua).toBe("Av. Paulista");
      expect(guardian.numero).toBe("1000");
      expect(guardian.complemento).toBe("Apto 5");
      expect(guardian.bairro).toBe("Bela Vista");
      expect(guardian.cidade).toBe("São Paulo");
      expect(guardian.estado).toBe("SP");
    });

    it("does not overwrite guardian-specific fields like nome and cpf", () => {
      const { result } = renderHook(() => usePatientForm());

      act(() => {
        result.current.setGuardianField("nome", "Carlos");
        result.current.setGuardianField("cpf", "123.456.789-09");
        result.current.setAddressField("cidade", "Rio de Janeiro");
      });

      act(() => {
        result.current.copyAddressToGuardian();
      });

      expect(result.current.guardian.nome).toBe("Carlos");
      expect(result.current.guardian.cpf).toBe("123.456.789-09");
      expect(result.current.guardian.cidade).toBe("Rio de Janeiro");
    });
  });

  describe("mask helpers", () => {
    it("exposes maskCPF, maskPhone, maskCEP, maskRG from the hook", () => {
      const { result } = renderHook(() => usePatientForm());
      expect(typeof result.current.maskCPF).toBe("function");
      expect(typeof result.current.maskPhone).toBe("function");
      expect(typeof result.current.maskCEP).toBe("function");
      expect(typeof result.current.maskRG).toBe("function");
    });

    it("maskCPF formats correctly", () => {
      const { result } = renderHook(() => usePatientForm());
      expect(result.current.maskCPF("12345678909")).toBe("123.456.789-09");
    });
  });
});
