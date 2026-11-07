import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { sendCaseMessageDomain } from "../server/domain/operations.ts";

export default defineAction({
  description:
    "Post a human or agent-drafted message in the Shared Resolution Room thread for a claim.",
  schema: z.object({
    claimId: z.string().describe("Claim ID to post a message to"),
    body: z.string().min(1).describe("Message text"),
    senderSide: z
      .enum(["buyer", "merchant"])
      .optional()
      .describe("Optional side indicator when in split-screen demo mode"),
  }),
  outputSchema: z.object({
    id: z.string(),
    claimId: z.string(),
    sentAt: z.string(),
    message: z.string(),
  }),
  http: { method: "POST" },
  run: async (args, ctx) => {
    return await sendCaseMessageDomain(args, ctx);
  },
});
