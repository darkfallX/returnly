import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { generateReturnPassDomain } from "../server/domain/operations.ts";

export default defineAction({
  description:
    "Retrieve or generate the QR Return Pass check-in token for a claim with an agreed resolution.",
  schema: z.object({
    claimId: z.string().describe("Claim ID to generate or read Return Pass for"),
  }),
  outputSchema: z.object({
    id: z.string(),
    claimId: z.string(),
    publicToken: z.string(),
    expiresAt: z.string(),
    message: z.string(),
  }),
  http: { method: "POST" },
  run: async (args, ctx) => {
    return await generateReturnPassDomain(args, ctx);
  },
});
