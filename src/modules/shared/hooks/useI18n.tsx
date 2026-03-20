/**
 * useI18n – thin adapter over react-i18next.
 *
 * Keeps the original API (`useI18n()`, `I18nProvider`, `Locale`) so that
 * every existing component continues to work without changes, while all
 * translation resources are now managed by i18next (see src/i18n/i18n.ts).
 */

import { useCallback, type ReactNode } from "react";
import { useTranslation, I18nextProvider } from "react-i18next";
import i18nInstance, { type SupportedLocale } from "@/i18n/i18n";

export type Locale = SupportedLocale;

interface I18nContextValue {
    locale: Locale;
    setLocale: (l: Locale) => void;
    t: (key: string) => string;
}

/** Provider that initialises and supplies the i18next instance to the tree. */
export function I18nProvider({ children }: { children: ReactNode }) {
    return (
        <I18nextProvider i18n={i18nInstance}>
            {children}
        </I18nextProvider>
    );
}

const LOCALE_KEY = "app_locale";

/**
 * Hook that exposes the same `{ locale, setLocale, t }` interface as the
 * previous custom implementation.
 */
export function useI18n(): I18nContextValue {
    const { t: translate, i18n } = useTranslation("common");

    const locale = (i18n.language ?? "pt") as Locale;

    const setLocale = useCallback(
        (l: Locale) => {
            i18n.changeLanguage(l);
            try {
                localStorage.setItem(LOCALE_KEY, l);
            } catch {
                // ignore storage errors (e.g. incognito + blocked storage)
            }
        },
        [i18n],
    );

    const t = useCallback(
        (key: string): string => {
            const result = translate(key, { defaultValue: key });
            return result as string;
        },
        [translate],
    );

    return { locale, setLocale, t };
}
