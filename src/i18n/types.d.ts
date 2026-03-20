/**
 * Augments the react-i18next DefaultResources type with our translation
 * namespaces so that `t()` calls are type-checked against the actual keys
 * defined in the JSON locale files.
 */

import type commonPt from "./locales/pt/common.json";

declare module "i18next" {
    interface CustomTypeOptions {
        defaultNS: "common";
        resources: {
            common: typeof commonPt;
        };
    }
}
