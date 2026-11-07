import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { completeOnboardingDomain } from "../server/domain/operations.ts";

export default defineAction({
  description:
    "Complete first-run onboarding for a Buyer, Merchant, or Split-Screen Demo workspace.",
  schema: z.object({
    role: z
      .enum(["buyer", "merchant", "demo"])
      .describe("Role selected during onboarding: buyer, merchant, or demo"),
    displayName: z
      .string()
      .optional()
      .describe("Display name for the buyer or store owner"),
    preferredCurrency: z
      .string()
      .optional()
      .describe("Preferred currency code, e.g. NGN or USD"),
    notificationsOptIn: z
      .boolean()
      .optional()
      .describe("Whether to opt in to in-app case updates"),
    merchantSetup: z
      .object({
        shopName: z.string().describe("Merchant shop or brand name"),
        category: z.string().describe("Primary retail product category"),
        supportContact: z
          .string()
          .describe("Support email or contact identifier"),
        branchName: z.string().describe("Primary service branch name"),
        branchAddress: z.string().describe("Branch street address"),
        returnDays: z
          .number()
          .nullable()
          .describe("Return window in days, or null if not offered"),
        warrantyDays: z
          .number()
          .nullable()
          .describe("Warranty window in days, or null if not offered"),
        policySummary: z
          .string()
          .describe("Human-readable return and inspection policy rule"),
        importDemoData: z
          .boolean()
          .optional()
          .describe("Whether to attach to the seeded Northline Audio demo data"),
      })
      .optional()
      .describe("Merchant organization and branch setup details"),
  }),
  outputSchema: z.object({
    id: z.string(),
    role: z.string(),
    demoMode: z.boolean(),
    merchantId: z.string().nullable(),
    nextPath: z.string(),
    message: z.string(),
  }),
  http: { method: "POST" },
  run: async (args, ctx) => {
    return await completeOnboardingDomain(args, ctx);
  },
});
