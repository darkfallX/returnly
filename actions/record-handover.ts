import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { recordHandoverDomain } from "../server/domain/operations.ts";

export default defineAction({
  description:
    "Record physical handover of the replacement/repaired item or refund acknowledgment at the merchant branch and redeem the Return Pass.",
  schema: z.object({
    claimId: z.string().describe("Claim ID to record handover for"),
    handoverNote: z
      .string()
      .optional()
      .describe("Merchant handover note (e.g. Sealed replacement unit provided)"),
    idempotencyKey: z
      .string()
      .optional()
      .describe("Optional idempotency key"),
    demoActorRole: z
      .enum(["buyer", "merchant"])
      .optional()
      .describe("Optional demo presentation actor role"),
  }),
  outputSchema: z.object({
    id: z.string(),
    claimId: z.string(),
    status: z.string(),
    message: z.string(),
  }),
  needsApproval: true,
  retrySafe: true,
  http: { method: "POST" },
  run: async (args, ctx) => {
    return await recordHandoverDomain(args, ctx);
  },
});
