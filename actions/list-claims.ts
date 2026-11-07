import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { listClaimsDomain } from "../server/domain/operations.ts";

export default defineAction({
  description:
    "List claims visible to the current viewer, optionally filtered by buyer or merchant scope.",
  schema: z.object({
    scope: z
      .enum(["buyer", "merchant", "all"])
      .optional()
      .describe("Role scope to filter claims: buyer, merchant, or all"),
  }),
  outputSchema: z.array(z.any()),
  http: { method: "GET" },
  readOnly: true,
  run: async (args, ctx) => {
    return await listClaimsDomain(args, ctx);
  },
});
