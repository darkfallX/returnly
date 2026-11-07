import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { requestEvidenceDomain } from "../server/domain/operations.ts";

export default defineAction({
  description:
    "Request missing evidence (such as a short issue video or clearer defect photo) from the buyer and transition the claim to awaiting_evidence.",
  schema: z.object({
    claimId: z.string().describe("Claim ID to request evidence for"),
    requestedItem: z
      .string()
      .min(1)
      .describe("Specific evidence item needed, e.g. 10-second speaker cutout video"),
    note: z
      .string()
      .min(1)
      .describe("Polite explanation sent to the buyer in the Shared Resolution Room"),
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
    replayed: z.boolean().optional(),
    message: z.string(),
  }),
  needsApproval: true,
  retrySafe: true,
  http: { method: "POST" },
  run: async (args, ctx) => {
    return await requestEvidenceDomain(args, ctx);
  },
});
