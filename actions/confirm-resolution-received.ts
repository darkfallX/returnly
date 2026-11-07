import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { confirmResolutionReceivedDomain } from "../server/domain/operations.ts";

export default defineAction({
  description:
    "Confirm as the buyer that the agreed replacement, repair, or refund resolution was received, closing the claim.",
  schema: z.object({
    claimId: z.string().describe("Claim ID to mark as completed"),
    feedbackNote: z
      .string()
      .optional()
      .describe("Optional buyer closing feedback"),
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
    resolvedAt: z.string(),
    replayed: z.boolean().optional(),
    message: z.string(),
  }),
  needsApproval: true,
  retrySafe: true,
  http: { method: "POST" },
  run: async (args, ctx) => {
    return await confirmResolutionReceivedDomain(args, ctx);
  },
});
