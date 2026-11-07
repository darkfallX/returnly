import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { submitClaimDomain } from "../server/domain/operations.ts";

export default defineAction({
  description:
    "Approve and dispatch a staged Return Passport claim packet to the merchant's Claims Inbox.",
  schema: z.object({
    claimId: z.string().describe("Draft claim ID to dispatch"),
    idempotencyKey: z
      .string()
      .describe("Idempotency key to prevent duplicate claim submissions"),
    buyerApproved: z
      .boolean()
      .optional()
      .describe("Explicit buyer approval flag"),
    discloseAttachments: z
      .boolean()
      .optional()
      .describe("Whether to disclose attached private evidence to the merchant"),
    demoActorRole: z
      .enum(["buyer", "merchant"])
      .optional()
      .describe("Optional demo presentation actor role"),
  }),
  outputSchema: z.object({
    id: z.string(),
    claimId: z.string(),
    claimCode: z.string(),
    status: z.string(),
    merchantName: z.string(),
    replayed: z.boolean(),
    message: z.string(),
  }),
  needsApproval: true,
  retrySafe: true,
  http: { method: "POST" },
  run: async (args, ctx) => {
    return await submitClaimDomain(args, ctx);
  },
});
