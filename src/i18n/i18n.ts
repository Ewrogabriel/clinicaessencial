/**
 * i18n configuration using i18next and react-i18next.
 *
 * Supports:
 *  - Portuguese (default / fallback)
 *  - English
 *  - Spanish
 *
 * Translations live in src/i18n/locales/{pt,en,es}/common.json.
 * The selected language is persisted to localStorage under "app_locale".
 */

import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import ptCommon from "./locales/pt/common.json";
import enCommon from "./locales/en/common.json";
import esCommon from "./locales/es/common.json";

const LOCALE_KEY = "app_locale";
const savedLocale = (() => {
    try {
        return localStorage.getItem(LOCALE_KEY) ?? "pt";
    } catch {
        return "pt";
    }
})();

i18n.use(initReactI18next).init({
    resources: {
        pt: { common: ptCommon },
        en: { common: enCommon },
        es: { common: esCommon },
    },
    lng: savedLocale,
    fallbackLng: "pt",
    defaultNS: "common",
    ns: ["common"],
    interpolation: {
        escapeValue: false, // React already escapes values
    },
    // Keep keys as-is (flat object format using dot notation as key names)
    keySeparator: false,
    nsSeparator: "##", // use an unlikely separator to avoid conflict with key dots
});

export default i18n;
export type SupportedLocale = "pt" | "en" | "es";
