import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { getViewerContextDomain } from "../server/domain/operations.ts";

export default defineAction({
  description:
    "Return the current viewer context, onboarding state, role permissions, active merchant organization, policy, branches, inventory, and appointment slots.",
  schema: z.object({}),
  outputSchema: z.object({
    email: z.string(),
    user: z.any(),
    hasRealMerchantMembership: z.boolean(),
    canAccessDemoSwitcher: z.boolean(),
    activeMerchant: z.any().nullable(),
    policy: z.any().nullable(),
    branches: z.array(z.any()),
    inventory: z.array(z.any()),
    slots: z.array(z.any()),
  }),
  http: { method: "GET" },
  readOnly: true,
  run: async (_args, ctx) => {
    return await getViewerContextDomain(ctx);
  },
});
