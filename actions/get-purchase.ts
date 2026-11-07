import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { getPurchaseDomain } from "../server/domain/operations.ts";

export default defineAction({
  description:
    "Get a single purchase from the buyer's Purchase Vault by ID, including policy coverage, receipt metadata, and linked claims.",
  schema: z.object({
    id: z.string().describe("Purchase ID to inspect"),
  }),
  outputSchema: z.any(),
  http: { method: "GET" },
  readOnly: true,
  run: async ({ id }, ctx) => {
    return await getPurchaseDomain(id, ctx);
  },
});
