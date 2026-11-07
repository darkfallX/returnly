import { normalizeCopy } from "../app/i18n/normalize-copy";
import { writeFile } from "node:fs/promises";

import { createToolkitI18nCatalog } from "@agent-native/toolkit/app/i18n";

import appMessages from "../app/i18n/en-US";

// Refresh after changing app English copy or upgrading Toolkit.
// Use Toolkit's public API so its translation aliases remain intact.
const catalog = createToolkitI18nCatalog({ messages: appMessages });
await writeFile(
  new URL("../app/i18n/source-messages.json", import.meta.url),
  JSON.stringify(normalizeCopy(catalog.messages)),
);
