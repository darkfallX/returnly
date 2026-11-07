import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { switchViewerAccountDomain } from "../server/domain/operations.ts";

export default defineAction({
  description:
    "Confirm the current authenticated account and return its workspace. Changing identity requires signing in; this action cannot impersonate another email.",
  schema: z.object({
    email: z.string().email().describe("The currently authenticated account email"),
    role: z
      .enum(["buyer", "merchant"])
      .optional()
      .describe("Preferred role workspace after switching"),
  }),
  outputSchema: z.object({
    id: z.string(),
    email: z.string(),
    displayName: z.string(),
    role: z.enum(["buyer", "merchant"]),
    hasRealMerchantMembership: z.boolean(),
    nextPath: z.string(),
    message: z.string(),
  }),
  retrySafe: true,
  http: { method: "POST" },
  run: async (args, ctx) => {
    return await switchViewerAccountDomain(args, ctx);
  },
});
