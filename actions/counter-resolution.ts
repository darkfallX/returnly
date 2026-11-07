import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { counterResolutionDomain } from "../server/domain/operations.ts";

export default defineAction({
  description:
    "Submit a buyer counteroffer on an active resolution offer (for example switching from drop_off to pickup, selecting a preferred branch slot, or countering with a partial refund percentage).",
  schema: z.object({
    claimId: z.string().describe("Claim ID to counter"),
    remedyType: z
      .enum([
        "inspection",
        "repair",
        "replacement",
        "full_refund_request",
        "partial_keep_item_refund",
      ])
      .optional()
      .describe("Countered remedy type"),
    logisticsType: z
      .enum(["drop_off", "pickup"])
      .describe("Countered handover logistics (e.g. pickup instead of drop_off)"),
    branchId: z
      .string()
      .nullable()
      .optional()
      .describe("Preferred merchant branch ID"),
    slotId: z
      .string()
      .nullable()
      .optional()
      .describe("Preferred appointment slot ID"),
    refundPercent: z
      .number()
      .nullable()
      .optional()
      .describe("Optional partial keep-item refund percentage (10-35)"),
    note: z
      .string()
      .min(1)
      .describe("Buyer explanation for the counteroffer"),
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
    offerId: z.string(),
    claimId: z.string(),
    version: z.number(),
    remedyType: z.string(),
    logisticsType: z.string(),
    refundMinor: z.number().nullable(),
    refundPercent: z.number().nullable(),
    replayed: z.boolean().optional(),
    message: z.string(),
  }),
  needsApproval: true,
  retrySafe: true,
  http: { method: "POST" },
  run: async (args, ctx) => {
    return await counterResolutionDomain(args, ctx);
  },
});
