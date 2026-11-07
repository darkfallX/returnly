import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { cancelReservationDomain } from "../server/domain/operations.ts";

export default defineAction({
  description:
    "Cancel an active branch appointment reservation before physical handover, releasing reserved stock and slot capacity and reverting the claim to agreed.",
  schema: z.object({
    claimId: z.string().describe("Claim ID to cancel reservation for"),
    reason: z
      .string()
      .optional()
      .describe("Optional cancellation reason"),
    idempotencyKey: z
      .string()
      .optional()
      .describe("Optional idempotency key to prevent duplicate cancellations"),
    demoActorRole: z
      .enum(["buyer", "merchant"])
      .optional()
      .describe("Optional demo presentation actor role"),
  }),
  outputSchema: z.object({
    id: z.string(),
    reservationId: z.string().optional(),
    claimId: z.string(),
    status: z.string(),
    replayed: z.boolean(),
    message: z.string(),
  }),
  needsApproval: true,
  retrySafe: true,
  http: { method: "POST" },
  run: async (args, ctx) => {
    return await cancelReservationDomain(args, ctx);
  },
});
