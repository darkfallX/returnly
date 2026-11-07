import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { addClaimEvidenceDomain } from "../server/domain/operations.ts";

export default defineAction({
  description:
    "Attach a written diagnostic note or an uploaded receipt, photo, or video clip (with buyer disclosure permission) to a claim.",
  schema: z.object({
    claimId: z.string().describe("Claim ID to attach evidence to"),
    label: z
      .string()
      .min(1)
      .describe("Short descriptive label for the evidence item"),
    mediaKind: z
      .enum(["receipt", "photo", "video", "diagnostic_note"])
      .describe("Evidence kind: receipt, photo, video, or diagnostic_note"),
    note: z.string().min(1).describe("Verification or diagnostic note"),
    fileName: z
      .string()
      .optional()
      .describe("Optional filename for the attachment"),
    mimeType: z
      .string()
      .optional()
      .describe("Optional MIME type for uploaded media"),
    size: z
      .number()
      .optional()
      .describe("Optional size in bytes for uploaded media"),
    dataUrl: z
      .string()
      .optional()
      .describe("Base64 data URL when uploading receipt, photo, or video"),
    attachmentId: z
      .string()
      .optional()
      .describe("Existing vault attachment ID to link"),
    discloseToMerchant: z
      .boolean()
      .optional()
      .describe("Whether the buyer authorizes disclosing this attachment to the merchant"),
    idempotencyKey: z
      .string()
      .optional()
      .describe("Optional idempotency key to prevent duplicate evidence writes"),
    demoActorRole: z
      .enum(["buyer", "merchant"])
      .optional()
      .describe("Optional demo presentation actor role"),
  }),
  outputSchema: z.object({
    id: z.string(),
    claimId: z.string(),
    attachmentId: z.string().nullable().optional(),
    status: z.string(),
    replayed: z.boolean().optional(),
    message: z.string(),
  }),
  needsApproval: ({ discloseToMerchant, mediaKind }) => mediaKind !== "diagnostic_note" && discloseToMerchant === true,
  retrySafe: true,
  http: { method: "POST" },
  run: async (args, ctx) => {
    return await addClaimEvidenceDomain(args, ctx);
  },
});
