import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { resetDemoScenarioDomain } from "../server/domain/operations.ts";

export default defineAction({
  description:
    "Reset the seeded Northline Audio & Maya Lin golden-path demo scenario so judges can replay the full workflow from a clean state.",
  schema: z.object({
    mode: z
      .enum(["submitted", "fresh_vault"])
      .optional()
      .describe(
        "Reset mode: 'submitted' seeds Claim #RT-1042 in Northline Audio's inbox; 'fresh_vault' seeds Maya's vault before any claim is staged.",
      ),
  }),
  outputSchema: z.object({
    id: z.string(),
    mode: z.string(),
    claimId: z.string().nullable(),
    purchaseId: z.string(),
    message: z.string(),
  }),
  http: { method: "POST" },
  run: async (args, ctx) => {
    return await resetDemoScenarioDomain(args, ctx);
  },
});
