/**
 * Unit tests for patientService.
 *
 * Supabase is fully mocked via vi.mock so no real network calls are made.
 * We use a Proxy-based thenable chain so `await` works at any step of the
 * Supabase fluent API (whether the last call is .order(), .eq(), .single(),
 * .maybeSingle(), etc.).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { patientService } from "../patientService";

// ── Thenable chain helper ─────────────────────────────────────────────────────

/**
 * Returns a Proxy that:
 * - Returns itself for any method call (fluent builder)
 * - Is thenable: resolves to `terminal` when awaited
 */
function chain(terminal: { data: unknown; error: unknown }) {
    const proxy: object = new Proxy(
        {},
        {
            get(_t, prop) {
                if (prop === "then") {
                    return (
                        resolve: (v: unknown) => void,
                        reject: (e: unknown) => void
                    ) => Promise.resolve(terminal).then(resolve, reject);
                }
                // All method calls return the same proxy
                return () => proxy;
            },
        }
    );
    return proxy;
}

vi.mock("@/integrations/supabase/client", () => ({
    supabase: { from: vi.fn() },
}));

const getSupabase = async () =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((await import("@/integrations/supabase/client")) as any).supabase;

// ── Test data ─────────────────────────────────────────────────────────────────

const CLINIC_ID = "clinic-001";

const PATIENT_1 = {
    id: "p1",
    nome: "Ana Silva",
    email: "ana@example.com",
    telefone: "(11) 99999-0001",
    status: "ativo",
};
const PATIENT_2 = {
    id: "p2",
    nome: "Bruno Lima",
    email: "bruno@example.com",
    telefone: "(11) 99999-0002",
    status: "ativo",
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("patientService", () => {
    let supabase: Awaited<ReturnType<typeof getSupabase>>;

    beforeEach(async () => {
        vi.clearAllMocks();
        supabase = await getSupabase();
    });

    // ── getPatients ───────────────────────────────────────────────────────────

    describe("getPatients", () => {
        it("returns patients for a given clinic", async () => {
            supabase.from
                .mockReturnValueOnce(chain({ data: [{ paciente_id: "p1" }, { paciente_id: "p2" }], error: null }))
                .mockReturnValueOnce(chain({ data: [PATIENT_1, PATIENT_2], error: null }));

            const result = await patientService.getPatients(CLINIC_ID);
            expect(result).toHaveLength(2);
            expect(result[0].nome).toBe("Ana Silva");
            expect(supabase.from).toHaveBeenCalledWith("clinic_pacientes");
            expect(supabase.from).toHaveBeenCalledWith("pacientes");
        });

        it("returns empty array when clinic has no patients", async () => {
            supabase.from.mockReturnValueOnce(chain({ data: [], error: null }));

            const result = await patientService.getPatients(CLINIC_ID);
            expect(result).toEqual([]);
        });

        it("returns all patients when no clinic filter is set", async () => {
            supabase.from.mockReturnValueOnce(chain({ data: [PATIENT_1], error: null }));

            const result = await patientService.getPatients(null);
            expect(result).toHaveLength(1);
            expect(supabase.from).toHaveBeenCalledWith("pacientes");
        });

        it("returns empty array on supabase error (clinic_pacientes)", async () => {
            supabase.from.mockReturnValueOnce(chain({ data: null, error: { message: "DB error" } }));

            const result = await patientService.getPatients(CLINIC_ID);
            expect(result).toEqual([]);
        });

        it("returns empty array on supabase error (pacientes)", async () => {
            supabase.from
                .mockReturnValueOnce(chain({ data: [{ paciente_id: "p1" }], error: null }))
                .mockReturnValueOnce(chain({ data: null, error: { message: "DB error" } }));

            const result = await patientService.getPatients(CLINIC_ID);
            expect(result).toEqual([]);
        });

        it("accepts 'inativo' status filter", async () => {
            supabase.from
                .mockReturnValueOnce(chain({ data: [{ paciente_id: "p1" }], error: null }))
                .mockReturnValueOnce(chain({ data: [{ ...PATIENT_1, status: "inativo" }], error: null }));

            const result = await patientService.getPatients(CLINIC_ID, "inativo");
            expect(result).toHaveLength(1);
        });
    });

    // ── getPatientBasic ───────────────────────────────────────────────────────

    describe("getPatientBasic", () => {
        it("returns minimal patient objects for a clinic", async () => {
            const basic = [{ id: "p1", nome: "Ana Silva" }];
            supabase.from
                .mockReturnValueOnce(chain({ data: [{ paciente_id: "p1" }], error: null }))
                .mockReturnValueOnce(chain({ data: basic, error: null }));

            const result = await patientService.getPatientBasic(CLINIC_ID);
            expect(result).toEqual(basic);
        });

        it("returns empty array when clinic has no patients", async () => {
            supabase.from.mockReturnValueOnce(chain({ data: [], error: null }));

            const result = await patientService.getPatientBasic(CLINIC_ID);
            expect(result).toEqual([]);
        });

        it("queries all patients when no clinic filter is set", async () => {
            supabase.from.mockReturnValueOnce(chain({ data: [{ id: "p1", nome: "Ana" }], error: null }));

            const result = await patientService.getPatientBasic(null);
            expect(result).toHaveLength(1);
        });

        it("returns empty array on error", async () => {
            supabase.from.mockReturnValueOnce(chain({ data: null, error: { message: "error" } }));

            const result = await patientService.getPatientBasic(CLINIC_ID);
            expect(result).toEqual([]);
        });
    });

    // ── getPatientById ────────────────────────────────────────────────────────

    describe("getPatientById", () => {
        it("returns a single patient by id", async () => {
            supabase.from.mockReturnValueOnce(chain({ data: PATIENT_1, error: null }));

            const result = await patientService.getPatientById("p1");
            expect(result).toEqual(PATIENT_1);
            expect(supabase.from).toHaveBeenCalledWith("pacientes");
        });

        it("returns null on error", async () => {
            supabase.from.mockReturnValueOnce(chain({ data: null, error: { message: "Not found" } }));

            const result = await patientService.getPatientById("does-not-exist");
            expect(result).toBeNull();
        });
    });

    // ── getPatientByUserId ────────────────────────────────────────────────────

    describe("getPatientByUserId", () => {
        it("returns a patient matched by user_id", async () => {
            supabase.from.mockReturnValueOnce(
                chain({ data: { ...PATIENT_1, user_id: "user-abc" }, error: null })
            );

            const result = await patientService.getPatientByUserId("user-abc");
            expect(result?.id).toBe("p1");
        });

        it("returns null when no patient matches (data is null)", async () => {
            supabase.from.mockReturnValueOnce(chain({ data: null, error: null }));

            const result = await patientService.getPatientByUserId("unknown-user");
            expect(result).toBeNull();
        });

        it("returns null on db error", async () => {
            supabase.from.mockReturnValueOnce(chain({ data: null, error: { message: "DB error" } }));

            const result = await patientService.getPatientByUserId("user-abc");
            expect(result).toBeNull();
        });
    });

    // ── approvePreCadastro ────────────────────────────────────────────────────

    const PRE_CADASTRO_DATA = {
        nome: "Carlos Souza",
        cpf: "123.456.789-00",
        rg: null,
        telefone: "(11) 99999-1234",
        email: "carlos@example.com",
        data_nascimento: "1990-05-15",
        cep: null,
        rua: null,
        numero: null,
        complemento: null,
        bairro: null,
        cidade: null,
        estado: null,
        tipo_atendimento: "fisioterapia",
        observacoes: null,
        tem_responsavel_legal: false,
        responsavel_nome: null,
        responsavel_cpf: null,
        responsavel_telefone: null,
        responsavel_email: null,
        responsavel_parentesco: null,
    };

    describe("approvePreCadastro", () => {
        it("creates patient, links to clinic, marks pre-cadastro approved, and returns codigo", async () => {
            const newPatient = { ...PATIENT_1, id: "p-new", nome: "Carlos Souza" };

            // pacientes insert → success
            supabase.from
                .mockReturnValueOnce(chain({ data: newPatient, error: null }))
                // clinic_pacientes insert → success
                .mockReturnValueOnce(chain({ data: null, error: null }))
                // pre_cadastros update → success
                .mockReturnValueOnce(chain({ data: null, error: null }));

            const result = await patientService.approvePreCadastro({
                preCadastroId: "pc-1",
                preCadastroData: PRE_CADASTRO_DATA,
                activeClinicId: CLINIC_ID,
                createdBy: "user-admin",
                revisadoPor: "user-admin",
            });

            expect(result.patient.id).toBe("p-new");
            expect(result.codigoAcesso).toHaveLength(8);
            expect(/^[A-Z0-9]{8}$/.test(result.codigoAcesso)).toBe(true);
            expect(supabase.from).toHaveBeenCalledWith("pacientes");
            expect(supabase.from).toHaveBeenCalledWith("clinic_pacientes");
            expect(supabase.from).toHaveBeenCalledWith("pre_cadastros");
        });

        it("skips clinic link when activeClinicId is null", async () => {
            const newPatient = { ...PATIENT_1, id: "p-new2" };

            // pacientes insert → success
            supabase.from
                .mockReturnValueOnce(chain({ data: newPatient, error: null }))
                // pre_cadastros update → success
                .mockReturnValueOnce(chain({ data: null, error: null }));

            const result = await patientService.approvePreCadastro({
                preCadastroId: "pc-2",
                preCadastroData: PRE_CADASTRO_DATA,
                activeClinicId: null,
                createdBy: "user-admin",
                revisadoPor: "user-admin",
            });

            expect(result.patient.id).toBe("p-new2");
            // clinic_pacientes should NOT be called
            expect(supabase.from).not.toHaveBeenCalledWith("clinic_pacientes");
        });

        it("throws when patient insert fails", async () => {
            supabase.from.mockReturnValueOnce(
                chain({ data: null, error: { message: "insert failed" } })
            );

            await expect(
                patientService.approvePreCadastro({
                    preCadastroId: "pc-3",
                    preCadastroData: PRE_CADASTRO_DATA,
                    activeClinicId: CLINIC_ID,
                    createdBy: "user-admin",
                    revisadoPor: "user-admin",
                })
            ).rejects.toMatchObject({ message: "insert failed" });
        });

        it("throws when clinic link fails", async () => {
            const newPatient = { ...PATIENT_1, id: "p-new3" };

            supabase.from
                .mockReturnValueOnce(chain({ data: newPatient, error: null }))
                .mockReturnValueOnce(chain({ data: null, error: { message: "link error" } }));

            await expect(
                patientService.approvePreCadastro({
                    preCadastroId: "pc-4",
                    preCadastroData: PRE_CADASTRO_DATA,
                    activeClinicId: CLINIC_ID,
                    createdBy: "user-admin",
                    revisadoPor: "user-admin",
                })
            ).rejects.toThrow("Erro ao vincular paciente à clínica: link error");
        });

        it("throws when pre_cadastros update fails", async () => {
            const newPatient = { ...PATIENT_1, id: "p-new4" };

            supabase.from
                .mockReturnValueOnce(chain({ data: newPatient, error: null }))
                .mockReturnValueOnce(chain({ data: null, error: null }))
                .mockReturnValueOnce(chain({ data: null, error: { message: "update failed" } }));

            await expect(
                patientService.approvePreCadastro({
                    preCadastroId: "pc-5",
                    preCadastroData: PRE_CADASTRO_DATA,
                    activeClinicId: CLINIC_ID,
                    createdBy: "user-admin",
                    revisadoPor: "user-admin",
                })
            ).rejects.toMatchObject({ message: "update failed" });
        });
    });
});
