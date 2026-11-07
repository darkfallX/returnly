import { defineAction } from "@agent-native/core/action";
import { writeAppStateForCurrentTab } from "@agent-native/core/application-state";
import { z } from "zod";

export default defineAction({
  description:
    "Navigate the Returnly UI to a specific view, route path, purchase detail, claim resolution room, or QR pass check-in screen.",
  schema: z.object({
    view: z
      .string()
      .optional()
      .describe(
        "View name (e.g. landing, onboarding, buyer-home, buyer-vault, buyer-purchase-detail, buyer-claims, buyer-claim-detail, merchant-home, merchant-claims, merchant-claim-detail, merchant-settings, demo, pass-verify, chat, home)",
      ),
    path: z
      .string()
      .optional()
      .describe("Explicit route path (e.g. /buyer/home, /merchant/claims, /demo)"),
    purchaseId: z
      .string()
      .optional()
      .describe("Purchase ID when navigating to a purchase detail page"),
    claimId: z
      .string()
      .optional()
      .describe("Claim ID when navigating to a buyer or merchant claim room"),
    token: z
      .string()
      .optional()
      .describe("QR Return Pass token when navigating to /pass/:token"),
    threadId: z.string().optional().describe("Chat thread ID to open"),
  }),
  outputSchema: z.string(),
  http: false,
  run: async (args) => {
    if (
      !args.view &&
      !args.path &&
      !args.purchaseId &&
      !args.claimId &&
      !args.token
    ) {
      throw new Error(
        "Provide at least --view, --path, --purchaseId, --claimId, or --token.",
      );
    }
    const nav: Record<string, string> = {};
    if (args.view) nav.view = args.view;
    if (args.path) nav.path = args.path;
    if (args.purchaseId) nav.purchaseId = args.purchaseId;
    if (args.claimId) nav.claimId = args.claimId;
    if (args.token) nav.token = args.token;
    if (args.threadId) nav.threadId = args.threadId;
    nav._writeId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await writeAppStateForCurrentTab("navigate", nav);
    return `Navigating to ${args.path || args.view || args.claimId || args.purchaseId || args.token}`;
  },
});
