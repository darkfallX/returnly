import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { verifyReturnPassDomain } from "../server/domain/operations.ts";

export default defineAction({
  description:
    "Verify a QR Return Pass token as an authenticated merchant and optionally record bench inspection completion.",
  schema: z.object({
    token: z
      .string()
      .min(1)
      .describe("Opaque QR Return Pass token (e.g. RTP-...)"),
    recordInspection: z
      .boolean()
      .optional()
      .describe("Whether to record inspection completed immediately"),
    inspectionNote: z
      .string()
      .optional()
      .describe("Technician inspection note"),
    demoActorRole: z
      .enum(["buyer", "merchant"])
      .optional()
      .describe("Optional demo presentation actor role"),
  }),
  outputSchema: z.object({
    id: z.string(),
    claimId: z.string(),
    claimCode: z.string(),
    publicToken: z.string(),
    status: z.string(),
    inspectedAt: z.string().nullable(),
    redeemedAt: z.string().nullable(),
    productName: z.string(),
    merchantName: z.string(),
    branchName: z.string(),
    message: z.string(),
  }),
  needsApproval: true,
  retrySafe: true,
  http: { method: "POST" },
  run: async (args, ctx) => {
    return await verifyReturnPassDomain(args, ctx);
  },
});
