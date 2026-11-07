import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { acceptResolutionDomain } from "../server/domain/operations.ts";

export default defineAction({
  description:
    "Accept the active resolution offer (or approve a buyer counteroffer) with version check and idempotency protection.",
  schema: z.object({
    claimId: z.string().describe("Claim ID"),
    offerId: z.string().describe("Offer ID being accepted"),
    expectedVersion: z
      .number()
      .optional()
      .describe("Expected offer version number to prevent accepting a stale offer"),
    idempotencyKey: z
      .string()
      .describe("Idempotency key for offer acceptance"),
    demoActorRole: z
      .enum(["buyer", "merchant"])
      .optional()
      .describe("Optional demo presentation actor role"),
  }),
  outputSchema: z.object({
    id: z.string(),
    offerId: z.string(),
    claimId: z.string(),
    status: z.string(),
    replayed: z.boolean(),
    nextRequiredAction: z.string(),
    message: z.string(),
  }),
  needsApproval: true,
  retrySafe: true,
  http: { method: "POST" },
  run: async (args, ctx) => {
    return await acceptResolutionDomain(args, ctx);
  },
});
