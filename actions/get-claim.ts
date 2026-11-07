import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { getClaimDomain } from "../server/domain/operations.ts";

export default defineAction({
  description:
    "Get the complete Shared Resolution Room record for a claim, including purchase, policy coverage, evidence packet, AI triage matrix, offers, messages, branches, slots, reservation, QR pass, pending approvals, and audit events.",
  schema: z.object({
    id: z.string().describe("Claim ID to fetch"),
    demoActorRole: z
      .enum(["buyer", "merchant"])
      .optional()
      .describe("Optional demo presentation actor role"),
  }),
  outputSchema: z.any(),
  http: { method: "GET" },
  readOnly: true,
  dedupe: false,
  run: async ({ id, demoActorRole }, ctx) => {
    return await getClaimDomain(id, ctx, demoActorRole);
  },
});
