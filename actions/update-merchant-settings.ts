import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { updateMerchantSettingsDomain } from "../server/domain/operations.ts";

export default defineAction({
  description:
    "Update the merchant's return window, warranty window, policy rules, and branch stock count.",
  schema: z.object({
    returnDays: z
      .number()
      .nullable()
      .describe("Return window in days, or null if not offered"),
    warrantyDays: z
      .number()
      .nullable()
      .describe("Warranty window in days, or null if not offered"),
    returnRule: z.string().min(1).describe("Store return policy rule text"),
    warrantyRule: z.string().min(1).describe("Store warranty policy rule text"),
    branchId: z.string().optional().describe("Optional branch ID to update stock for"),
    stockOnHand: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe("Optional updated on-hand replacement stock count"),
  }),
  outputSchema: z.object({
    id: z.string(),
    version: z.number(),
    message: z.string(),
  }),
  needsApproval: true,
  http: { method: "POST" },
  run: async (args, ctx) => {
    return await updateMerchantSettingsDomain(args, ctx);
  },
});
