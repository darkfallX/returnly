import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { stageClaimPacketDomain } from "../server/domain/operations.ts";

export default defineAction({
  description:
    "Prepare and stage a draft Return Passport claim packet for a purchase. Does not send the claim to the merchant until the buyer approves via submit-claim.",
  schema: z.object({
    purchaseId: z.string().describe("Purchase ID from the buyer's vault"),
    issueTitle: z
      .string()
      .min(1)
      .describe("Concise title of the defect or issue"),
    issueDescription: z
      .string()
      .min(1)
      .describe("Detailed description of the problem experienced"),
    preferredResolution: z
      .enum([
        "inspection",
        "repair",
        "replacement",
        "full_refund_request",
        "partial_keep_item_refund",
      ])
      .describe("Buyer's preferred resolution remedy"),
    preferredLogistics: z
      .enum(["drop_off", "pickup"])
      .describe("Buyer's preferred handover logistics (drop_off or pickup)"),
    preferredBranchId: z
      .string()
      .nullable()
      .optional()
      .describe("Optional preferred merchant branch ID"),
    preferredSlotId: z
      .string()
      .nullable()
      .optional()
      .describe("Optional preferred branch appointment slot ID"),
    attachPhotoLabel: z
      .string()
      .optional()
      .describe("Label for the staged product condition photo"),
    attachPhotoNote: z
      .string()
      .optional()
      .describe("Diagnostic note for the staged photo"),
    attachDataUrl: z
      .string()
      .optional()
      .describe("Optional uploaded photo/video base64 data URL"),
    attachMimeType: z
      .string()
      .optional()
      .describe("Optional uploaded media MIME type"),
    attachFileName: z
      .string()
      .optional()
      .describe("Optional uploaded media file name"),
    discloseAttachmentsToMerchant: z
      .boolean()
      .optional()
      .describe("Whether private attachments should be disclosed to merchant immediately"),
    autoSubmit: z
      .literal(false)
      .optional()
      .describe("Staging creates a draft; use submit-claim with buyer approval"),
  }),
  outputSchema: z.object({
    id: z.string(),
    claimId: z.string(),
    claimCode: z.string(),
    status: z.enum(["draft", "submitted"]),
    nextRequiredAction: z.string(),
    message: z.string(),
  }),
  retrySafe: true,
  http: { method: "POST" },
  run: async (args, ctx) => {
    return await stageClaimPacketDomain(args, ctx);
  },
});
