import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { confirmSlotAndReserveDomain } from "../server/domain/operations.ts";

export default defineAction({
  description:
    "Transactionally reserve branch replacement stock and an appointment slot for an agreed claim, and issue an opaque QR Return Pass token.",
  schema: z.object({
    claimId: z.string().describe("Claim ID to confirm reservation for"),
    branchId: z.string().optional().describe("Selected branch ID"),
    slotId: z.string().optional().describe("Selected appointment slot ID"),
    idempotencyKey: z
      .string()
      .describe("Idempotency key to prevent duplicate stock/slot decrements"),
    demoActorRole: z
      .enum(["buyer", "merchant"])
      .optional()
      .describe("Optional demo presentation actor role"),
  }),
  outputSchema: z.object({
    id: z.string(),
    reservationId: z.string(),
    passId: z.string().optional(),
    claimId: z.string(),
    status: z.string(),
    publicToken: z.string(),
    expiresAt: z.string(),
    replayed: z.boolean(),
    message: z.string(),
  }),
  needsApproval: true,
  retrySafe: true,
  http: { method: "POST" },
  run: async (args, ctx) => {
    return await confirmSlotAndReserveDomain(args, ctx);
  },
});
