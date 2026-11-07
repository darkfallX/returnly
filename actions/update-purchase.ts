import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { updatePurchaseDomain } from "../server/domain/operations.ts";

export default defineAction({
  description:
    "Update an existing purchase's product name, optional serial number, or order number.",
  schema: z.object({
    id: z.string().describe("Purchase ID to update"),
    productName: z.string().optional().describe("Updated product name"),
    serial: z
      .string()
      .nullable()
      .optional()
      .describe("Optional serial number (null if not provided)"),
    orderNumber: z
      .string()
      .nullable()
      .optional()
      .describe("Updated order reference"),
  }),
  outputSchema: z.object({
    id: z.string(),
    message: z.string(),
  }),
  http: { method: "POST" },
  run: async (args, ctx) => {
    return await updatePurchaseDomain(args, ctx);
  },
});
