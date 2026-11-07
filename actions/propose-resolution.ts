import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { proposeResolutionDomain } from "../server/domain/operations.ts";

export default defineAction({
  description:
    "Propose a structured resolution offer from the merchant to the buyer (inspection, replacement, repair, partial keep-item refund, or full refund request).",
  schema: z.object({
    claimId: z.string().describe("Claim ID to propose an offer on"),
    remedyType: z
      .enum([
        "inspection",
        "repair",
        "replacement",
        "full_refund_request",
        "partial_keep_item_refund",
      ])
      .describe("Proposed remedy type"),
    logisticsType: z
      .enum(["drop_off", "pickup"])
      .describe("Proposed handover logistics: drop_off or pickup"),
    branchId: z
      .string()
      .nullable()
      .optional()
      .describe("Target merchant branch ID"),
    slotId: z
      .string()
      .nullable()
      .optional()
      .describe("Suggested appointment slot ID"),
    refundPercent: z
      .number()
      .nullable()
      .optional()
      .describe("Optional refund percentage when remedyType is partial_keep_item_refund"),
    note: z
      .string()
      .min(1)
      .describe("Merchant note explaining the terms of the resolution offer"),
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
    status: z.string(),
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
    return await proposeResolutionDomain(args, ctx);
  },
});
