import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { ingestReceiptDomain } from "../server/domain/operations.ts";

export default defineAction({
  description:
    "Store an optional private receipt attachment in the buyer's vault and prepare purchase fields for user confirmation.",
  schema: z.object({
    fileName: z.string().describe("Receipt filename"),
    mimeType: z.string().optional().describe("Receipt MIME type"),
    size: z.number().optional().describe("Receipt file size in bytes"),
    dataUrl: z
      .string()
      .optional()
      .describe("Optional base64 data URL when uploading a real receipt file"),
    discloseToMerchant: z
      .boolean()
      .optional()
      .describe("Whether the receipt may be disclosed to the merchant on claims"),
    hintProductName: z
      .string()
      .optional()
      .describe("Optional product name hint from the receipt"),
    hintMerchantName: z
      .string()
      .optional()
      .describe("Optional merchant name hint from the receipt"),
    hintAmountMajor: z
      .number()
      .optional()
      .describe("Optional price in major currency units (e.g. 45000)"),
  }),
  outputSchema: z.object({
    attachmentId: z.string().nullable(),
    extractionSource: z.string(),
    requiresUserConfirmation: z.boolean(),
    disclosedToMerchant: z.boolean().optional(),
    fields: z.any(),
    message: z.string(),
  }),
  retrySafe: true,
  http: { method: "POST" },
  run: async (args, ctx) => {
    return await ingestReceiptDomain(args, ctx);
  },
});
