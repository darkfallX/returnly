import { normalizeCopy } from "./normalize-copy";
import {
  createAgentNativeI18nCatalog,
  type LocaleCode,
} from "@agent-native/core/client/i18n";

import sourceMessages from "./source-messages.json";

// Toolkit's combined catalog eagerly imports every language. Keep its public
// catalog builder on the language-switch path, not on the startup path.
async function localized(
  locale: LocaleCode,
  appLoader: () => Promise<{ default: Record<string, unknown> }>,
) {
  const [{ createToolkitI18nCatalog }, app] = await Promise.all([
    import("@agent-native/toolkit/app/i18n"),
    appLoader(),
  ]);
  return normalizeCopy(createToolkitI18nCatalog({
    messages: app.default,
    sourceLocale: locale,
  }).messages);
}

export const i18nCatalog = createAgentNativeI18nCatalog({
  messages: sourceMessages,
  localeLoaders: {
    "zh-CN": () => localized("zh-CN", () => import("./zh-CN")),
    "zh-TW": () => localized("zh-TW", () => import("./zh-TW")),
    "es-ES": () => localized("es-ES", () => import("./es-ES")),
    "fr-FR": () => localized("fr-FR", () => import("./fr-FR")),
    "de-DE": () => localized("de-DE", () => import("./de-DE")),
    "ja-JP": () => localized("ja-JP", () => import("./ja-JP")),
    "ko-KR": () => localized("ko-KR", () => import("./ko-KR")),
    "pt-BR": () => localized("pt-BR", () => import("./pt-BR")),
    "hi-IN": () => localized("hi-IN", () => import("./hi-IN")),
    "ar-SA": () => localized("ar-SA", () => import("./ar-SA")),
  },
});
