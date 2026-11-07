import { normalizeCopy } from "./normalize-copy";
import { createToolkitI18nCatalog } from "@agent-native/toolkit/app/i18n";
import { describe, expect, it } from "vitest";

import english from "./en-US";
import french from "./fr-FR";
import { i18nCatalog } from "./index";

describe("Deferred toolkit translations", () => {
  it("keeps the startup snapshot in sync with the installed toolkit and app copy", () => {
    expect(i18nCatalog.messages).toEqual(
      normalizeCopy(createToolkitI18nCatalog({ messages: english }).messages),
    );
  });
  it("preserves the selected language and toolkit aliases when loading on demand", async () => {
    expect(await i18nCatalog.loadMessages("fr-FR")).toEqual(
      normalizeCopy(createToolkitI18nCatalog({ messages: french, sourceLocale: "fr-FR" }).messages),
    );
  });
});
