import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { listPurchasesDomain } from "../server/domain/operations.ts";

export default defineAction({
  description:
    "List purchases in the buyer's Purchase Vault with stored merchant policy coverage and linked claims.",
  schema: z.object({}),
  outputSchema: z.array(z.any()),
  http: { method: "GET" },
  readOnly: true,
  run: async (_args, ctx) => {
    return await listPurchasesDomain(ctx);
  },
});
