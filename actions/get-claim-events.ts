import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { getClaimDomain } from "../server/domain/operations.ts";

export default defineAction({
  description:
    "Get the chronological audit trail of events for a claim, identifying whether each change came from Buyer, Buyer Agent, Merchant, or Merchant Agent.",
  schema: z.object({
    claimId: z.string().describe("Claim ID to inspect audit events for"),
  }),
  outputSchema: z.array(z.any()),
  http: { method: "GET" },
  readOnly: true,
  run: async ({ claimId }, ctx) => {
    const detail = await getClaimDomain(claimId, ctx);
    return detail.events;
  },
});
