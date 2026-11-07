import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { setEvidenceDisclosureDomain } from "../server/domain/operations.ts";

export default defineAction({
  description:
    "Update buyer disclosure permission on a private attachment so the merchant can or cannot inspect the uploaded receipt, photo, or video.",
  schema: z.object({
    claimId: z.string().describe("Claim ID"),
    attachmentId: z.string().describe("Attachment ID to disclose or withhold"),
    disclosedToMerchant: z
      .boolean()
      .describe("Whether the merchant is authorized to view this attachment"),
    demoActorRole: z
      .enum(["buyer", "merchant"])
      .optional()
      .describe("Optional demo presentation actor role"),
  }),
  outputSchema: z.object({
    id: z.string(),
    claimId: z.string(),
    disclosedToMerchant: z.boolean(),
    message: z.string(),
  }),
  needsApproval: true,
  retrySafe: true,
  http: { method: "POST" },
  run: async (args, ctx) => {
    return await setEvidenceDisclosureDomain(args, ctx);
  },
});
