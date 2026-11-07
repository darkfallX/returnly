import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { triageMerchantClaimDomain } from "../server/domain/operations.ts";

export default defineAction({
  description:
    "Check a claim deterministically on a submitted claim against stored merchant policy, purchase age, evidence completeness, and branch stock availability.",
  schema: z.object({
    claimId: z.string().describe("Claim ID to triage"),
    demoActorRole: z
      .enum(["buyer", "merchant"])
      .optional()
      .describe("Optional demo presentation actor role"),
  }),
  outputSchema: z.object({
    id: z.string(),
    claimId: z.string(),
    policyMatch: z.enum(["matched", "not_matched", "uncertain"]),
    daysSincePurchase: z.number().nullable(),
    missingItems: z.array(z.string()),
    stockSnapshot: z.array(z.any()),
    recommendedRemedies: z.array(z.string()),
    reasoningSummary: z.string(),
    sourceRefs: z.array(z.string()),
    status: z.string(),
    nextRequiredAction: z.string(),
    message: z.string(),
  }),
  retrySafe: true,
  http: { method: "POST" },
  run: async (args, ctx) => {
    return await triageMerchantClaimDomain(args, ctx);
  },
});
