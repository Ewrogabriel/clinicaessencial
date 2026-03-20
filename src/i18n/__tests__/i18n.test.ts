/**
 * Tests for the i18n translation files and i18next configuration.
 *
 * Validates:
 * - All locale files can be imported as valid JSON
 * - Portuguese (default) has expected key coverage
 * - English and Spanish have parity with Portuguese for critical keys
 * - i18next instance resolves translations correctly for all three locales
 * - Fallback to Portuguese when a key is missing in another locale
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import i18n from "../i18n";
import ptCommon from "../locales/pt/common.json";
import enCommon from "../locales/en/common.json";
import esCommon from "../locales/es/common.json";

// ── JSON shape tests ──────────────────────────────────────────────────────────

describe("locale JSON files", () => {
    it("pt/common.json has required common keys", () => {
        expect(ptCommon["common.save"]).toBe("Salvar");
        expect(ptCommon["common.cancel"]).toBe("Cancelar");
        expect(ptCommon["common.loading"]).toBe("Carregando...");
    });

    it("en/common.json has required common keys", () => {
        expect(enCommon["common.save"]).toBe("Save");
        expect(enCommon["common.cancel"]).toBe("Cancel");
        expect(enCommon["common.loading"]).toBe("Loading...");
    });

    it("es/common.json has required common keys", () => {
        expect(esCommon["common.save"]).toBe("Guardar");
        expect(esCommon["common.cancel"]).toBe("Cancelar");
        expect(esCommon["common.loading"]).toBe("Cargando...");
    });

    it("all locales have nav.home translated", () => {
        expect(ptCommon["nav.home"]).toBe("Início");
        expect(enCommon["nav.home"]).toBe("Home");
        expect(esCommon["nav.home"]).toBe("Inicio");
    });

    it("pt locale has more or equal keys than en (pt is the source)", () => {
        const ptCount = Object.keys(ptCommon).length;
        const enCount = Object.keys(enCommon).length;
        expect(ptCount).toBeGreaterThanOrEqual(enCount);
    });

    it("pt locale has more or equal keys than es", () => {
        const ptCount = Object.keys(ptCommon).length;
        const esCount = Object.keys(esCommon).length;
        expect(ptCount).toBeGreaterThanOrEqual(esCount);
    });

    it("lang keys are present in all locales", () => {
        expect(ptCommon["lang.pt"]).toBe("Português");
        expect(enCommon["lang.pt"]).toBe("Português");
        expect(esCommon["lang.pt"]).toBe("Português");
    });
});

// ── i18next instance tests ────────────────────────────────────────────────────

describe("i18next instance", () => {
    const originalLang = i18n.language;
    const t = i18n.t.bind(i18n) as (key: string, opts?: Record<string, unknown>) => string;

    afterEach(async () => {
        await i18n.changeLanguage(originalLang);
    });

    it("resolves Portuguese translations", async () => {
        await i18n.changeLanguage("pt");
        expect(t("common.save", { ns: "common" })).toBe("Salvar");
        expect(t("nav.patients", { ns: "common" })).toBe("Pacientes");
    });

    it("resolves English translations", async () => {
        await i18n.changeLanguage("en");
        expect(t("common.save", { ns: "common" })).toBe("Save");
        expect(t("nav.patients", { ns: "common" })).toBe("Patients");
    });

    it("resolves Spanish translations", async () => {
        await i18n.changeLanguage("es");
        expect(t("common.save", { ns: "common" })).toBe("Guardar");
        expect(t("nav.patients", { ns: "common" })).toBe("Pacientes");
    });

    it("falls back to Portuguese for a key missing in en", async () => {
        await i18n.changeLanguage("en");
        const ptKeys = Object.keys(ptCommon) as Array<keyof typeof ptCommon>;
        const enKeys = new Set(Object.keys(enCommon));
        const ptOnlyKey = ptKeys.find((k) => !enKeys.has(k));
        if (ptOnlyKey) {
            const result = t(ptOnlyKey, { ns: "common" });
            expect(result).toBe(ptCommon[ptOnlyKey]);
        }
    });

    it("returns the key itself when completely unknown", async () => {
        await i18n.changeLanguage("pt");
        const unknownKey = "__test_unknown_key__";
        expect(t(unknownKey, { ns: "common" })).toBe(unknownKey);
    });
});
