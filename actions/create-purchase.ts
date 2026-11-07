import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { createPurchaseDomain } from "../server/domain/operations.ts";

export default defineAction({
  description:
    "Create a new purchase in the buyer's Purchase Vault using integer minor currency units.",
  schema: z.object({
    productName: z.string().min(1).describe("Product title"),
    merchantName: z.string().min(1).describe("Store or merchant name"),
    merchantId: z
      .string()
      .nullable()
      .optional()
      .describe("Optional merchant organization ID"),
    category: z.string().optional().describe("Product category"),
    sku: z.string().nullable().optional().describe("Optional product SKU"),
    serial: z
      .string()
      .nullable()
      .optional()
      .describe("Optional serial number (leave null if not on receipt)"),
    orderNumber: z
      .string()
      .nullable()
      .optional()
      .describe("Store order or receipt reference number"),
    amountMinor: z
      .number()
      .int()
      .nonnegative()
      .describe("Purchase price in integer minor currency units (e.g. 4500000 for ₦45,000)"),
    currencyCode: z
      .string()
      .optional()
      .describe("ISO currency code, defaults to NGN"),
    purchasedAt: z
      .string()
      .describe("ISO-8601 purchase date/time string"),
    sourceType: z
      .enum(["manual", "receipt_upload"])
      .optional()
      .describe("How the purchase record was created"),
    receiptId: z
      .string()
      .nullable()
      .optional()
      .describe("Optional private receipt attachment ID"),
  }),
  outputSchema: z.object({
    id: z.string(),
    message: z.string(),
  }),
  http: { method: "POST" },
  run: async (args, ctx) => {
    return await createPurchaseDomain(args, ctx);
  },
});
