import { afterEach, describe, expect, it } from "vitest";
import { registerPrivateBlobProvider, unregisterPrivateBlobProvider } from "@agent-native/core/private-blob";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb, schema } from "../db/index.ts";
import {
  acceptResolutionDomain,
  addClaimEvidenceDomain,
  cancelReservationDomain,
  completeOnboardingDomain,
  getViewerContextDomain,
  confirmResolutionReceivedDomain,
  confirmSlotAndReserveDomain,
  counterResolutionDomain,
  createPurchaseDomain,
  generateReturnPassDomain,
  getClaimDomain,
  getPurchaseDomain,
  ingestReceiptDomain,
  listClaimsDomain,
  listPurchasesDomain,
  proposeResolutionDomain,
  recordHandoverDomain,
  requestEvidenceDomain,
  resetDemoScenarioDomain,
  setEvidenceDisclosureDomain,
  stageClaimPacketDomain,
  submitClaimDomain,
  switchViewerAccountDomain,
  updateMerchantSettingsDomain,
  releaseExpiredReservationsForClaim,
  triageMerchantClaimDomain,
  verifyReturnPassDomain,
} from "./operations.ts";
import {
  computePartialRefundMinor,
  DEMO_BUYER_EMAIL,
  DEMO_IDS,
  DEMO_MERCHANT_EMAIL,
  DEMO_OUTSIDER_EMAIL,
  resolveCallerEmail,
} from "./returnly.ts";

afterEach(() => unregisterPrivateBlobProvider("returnly-test-storage"));

describe("Returnly Domain, Security & Golden-Path Workflow", { timeout: 90_000 }, () => {
  it("computes integer minor-unit partial refunds accurately without floating-point drift", () => {
    // ₦45,000 = 4,500,000 minor units
    expect(computePartialRefundMinor(4_500_000, 25)).toBe(1_125_000); // ₦11,250.00
    expect(computePartialRefundMinor(4_500_000, 30)).toBe(1_350_000); // ₦13,500.00
    expect(computePartialRefundMinor(2_850_000, 20)).toBe(570_000); // ₦5,700.00
  });

  it("handles unknown merchant policy and missing receipt serial numbers honestly without fabrication", async () => {
    await resetDemoScenarioDomain(
      { mode: "submitted" },
      { userEmail: DEMO_BUYER_EMAIL, caller: "http" },
    );

    const purchases = await listPurchasesDomain({
      userEmail: DEMO_BUYER_EMAIL,
      caller: "http",
    });

    const headphones = purchases.find(
      (p) => p.id === DEMO_IDS.purchaseHeadphones,
    );
    const kettle = purchases.find((p) => p.id === DEMO_IDS.purchaseKettle);

    expect(headphones).toBeDefined();
    expect(headphones?.serial).toBeNull();
    expect(headphones?.coverage.policyKnown).toBe(true);
    expect(headphones?.coverage.returnEligible).toBe("eligible");

    expect(kettle).toBeDefined();
    expect(kettle?.coverage.policyKnown).toBe(false);
    expect(kettle?.coverage.returnEligible).toBe("unknown");
    expect(kettle?.coverage.returnLabel).toContain("Check with merchant");
  });

  it("enforces cross-tenant data isolation so an unrelated user cannot read or mutate a private purchase or claim", async () => {
    const otherStore = randomUUID();
    await getDb().insert(schema.merchantOrganizations).values({ id: otherStore, ownerEmail: "staff@another-store.example", name: "Another Store", category: "Electronics", supportContact: "staff@another-store.example", demoFlag: false });
    const privatePurchase = await createPurchaseDomain(
      {
        productName: "Private DSLR Camera",
        merchantName: "Another Store",
        merchantId: otherStore,
        amountMinor: 12_000_000,
        purchasedAt: new Date().toISOString(),
      },
      { userEmail: "alice.private@example.com", caller: "http" },
    );

    await expect(
      getPurchaseDomain(privatePurchase.id, {
        userEmail: "intruder.bob@example.com",
        caller: "http",
      }),
    ).rejects.toThrow(/not found or unauthorized/i);

    const privateDraft = await stageClaimPacketDomain(
      {
        purchaseId: privatePurchase.id,
        issueTitle: "Shutter button stuck",
        issueDescription: "Shutter fails to release on half-press.",
        preferredResolution: "repair",
        preferredLogistics: "drop_off",
      },
      { userEmail: "alice.private@example.com", caller: "http" },
    );

    // Draft claims must not be visible in merchant inbox before buyer approval/submission
    const merchantInboxBeforeSubmit = await listClaimsDomain(
      { scope: "merchant" },
      { userEmail: DEMO_MERCHANT_EMAIL, caller: "http" },
    );
    expect(
      merchantInboxBeforeSubmit.some((c) => c.id === privateDraft.claimId),
    ).toBe(false);

    await expect(
      getClaimDomain(privateDraft.claimId, {
        userEmail: DEMO_MERCHANT_EMAIL,
        caller: "http",
      }),
    ).rejects.toThrow(/approval|permission/i);
    await expect(
      getClaimDomain(privateDraft.claimId, {
        userEmail: DEMO_BUYER_EMAIL,
        caller: "http",
      }),
    ).rejects.toThrow(/approval|permission/i);
    await expect(
      getClaimDomain(privateDraft.claimId, {
        userEmail: "intruder.bob@example.com",
        caller: "http",
      }),
    ).rejects.toThrow(/permission/i);
    await submitClaimDomain({ claimId: privateDraft.claimId, idempotencyKey: randomUUID(), buyerApproved: true }, { userEmail: "alice.private@example.com", caller: "http" });
    await expect(getClaimDomain(privateDraft.claimId, { userEmail: DEMO_MERCHANT_EMAIL, caller: "http" })).rejects.toThrow(/permission/i);
    expect((await listClaimsDomain({ scope: "merchant" }, { userEmail: DEMO_MERCHANT_EMAIL, caller: "http" })).some((claim) => claim.id === privateDraft.claimId)).toBe(false);
  });

  it("enforces strict buyer vs merchant account boundaries on seeded demo identities", async () => {
    await resetDemoScenarioDomain(
      { mode: "submitted" },
      { userEmail: DEMO_BUYER_EMAIL, caller: "http" },
    );

    const buyerCtx = { userEmail: DEMO_BUYER_EMAIL, caller: "http" as const };
    const merchantCtx = {
      userEmail: DEMO_MERCHANT_EMAIL,
      caller: "http" as const,
    };
    const outsiderCtx = {
      userEmail: DEMO_OUTSIDER_EMAIL,
      caller: "http" as const,
    };

    // Buyer cannot run merchant-only triage or propose offers
    await expect(confirmSlotAndReserveDomain({ claimId: DEMO_IDS.claimHeadphones, idempotencyKey: randomUUID() }, buyerCtx)).rejects.toThrow(/merchant/i);
    await expect(stageClaimPacketDomain({ purchaseId: DEMO_IDS.purchaseHeadphones, issueTitle: "Bypass attempt", issueDescription: "Staging must not dispatch", preferredResolution: "replacement", preferredLogistics: "drop_off", autoSubmit: true }, buyerCtx)).rejects.toThrow(/buyer approval/i);
    await expect(
      triageMerchantClaimDomain({ claimId: DEMO_IDS.claimHeadphones }, buyerCtx),
    ).rejects.toThrow(/merchant staff permission|merchant membership/i);

    await expect(
      proposeResolutionDomain(
        {
          claimId: DEMO_IDS.claimHeadphones,
          remedyType: "replacement",
          logisticsType: "drop_off",
          note: "Unauthorized buyer-as-merchant attempt",
        },
        buyerCtx,
      ),
    ).rejects.toThrow(/merchant staff permission|merchant membership/i);

    // Merchant cannot see Buyer's private Purchase Vault
    const merchantPurchases = await listPurchasesDomain(merchantCtx);
    expect(merchantPurchases).toHaveLength(0);

    // Outsider buyer sees 0 purchases and 0 claims
    expect(await listPurchasesDomain(outsiderCtx)).toHaveLength(0);
    expect(await listClaimsDomain({ scope: "all" }, outsiderCtx)).toHaveLength(
      0,
    );

    await expect(switchViewerAccountDomain({ email: DEMO_MERCHANT_EMAIL }, buyerCtx)).rejects.toThrow(/sign in/i);
    expect(resolveCallerEmail(buyerCtx)).toBe(DEMO_BUYER_EMAIL);
    expect(resolveCallerEmail(outsiderCtx)).toBe(DEMO_OUTSIDER_EMAIL);
    // This endpoint can only confirm the current authenticated identity.
    const switchedToMerchant = await switchViewerAccountDomain(
      { email: DEMO_MERCHANT_EMAIL },
      merchantCtx,
    );
    expect(switchedToMerchant.role).toBe("merchant");
    expect(switchedToMerchant.hasRealMerchantMembership).toBe(false);

    const switchedBackToBuyer = await switchViewerAccountDomain(
      { email: DEMO_BUYER_EMAIL },
      buyerCtx,
    );
    expect(switchedBackToBuyer.role).toBe("buyer");
    const outsiderPolicy = { returnDays: 1, warrantyDays: 1, returnRule: "Unauthorized", warrantyRule: "Unauthorized", branchId: DEMO_IDS.centralBranch, stockOnHand: 999 };
    await expect(updateMerchantSettingsDomain(outsiderPolicy, outsiderCtx)).rejects.toThrow(/membership/i);
    await expect(resetDemoScenarioDomain({ mode: "submitted" }, outsiderCtx)).rejects.toThrow(/demo/i);
  });

  it("requires real store setup, keeps missing inventory and coordinates unknown, and scopes store edits", async () => {
    const owner = { userEmail: "owner@blue-shop.example", caller: "http" as const };
    await expect(completeOnboardingDomain({ role: "merchant" }, owner)).rejects.toThrow(/store.*contact.*branch/i);
    await completeOnboardingDomain({ role: "merchant", merchantSetup: { shopName: "Blue Shop", category: "Electronics", supportContact: "support@blue-shop.example", branchName: "Workshop", branchAddress: "10 Workshop Road, Lagos", returnDays: 14, warrantyDays: null, policySummary: "Inspection required within 14 days", importDemoData: false } }, owner);
    const viewer = await getViewerContextDomain(owner);
    expect(viewer.hasRealMerchantMembership).toBe(true);
    expect(viewer.activeMerchant?.name).toBe("Blue Shop");
    expect(viewer.inventory).toHaveLength(0);
    expect(viewer.slots).toHaveLength(0);
    expect(viewer.branches[0]?.latitude).toBeNull();
    expect(viewer.branches[0]?.longitude).toBeNull();
    expect(viewer.branches[0]?.addressText).toBe("10 Workshop Road, Lagos");
    await expect(updateMerchantSettingsDomain({ returnDays: 1, warrantyDays: 1, returnRule: "Unauthorized", warrantyRule: "Unauthorized", branchId: DEMO_IDS.centralBranch, stockOnHand: 999 }, owner)).rejects.toThrow(/branch.*store/i);
    expect((await getViewerContextDomain(owner)).policy?.version).toBe(1);
    await expect(getClaimDomain(DEMO_IDS.claimHeadphones, owner)).rejects.toThrow(/permission/i);
  });

  it("keeps manual metadata honest and prevents dispatch to an invented merchant", async () => {
    const ctx = { userEmail: DEMO_BUYER_EMAIL, caller: "http" as const };
    const metadata = await ingestReceiptDomain(
      { fileName: "unknown.pdf" },
      ctx,
    );
    expect(metadata.attachmentId).toBeNull();
    expect(metadata.fields.amountMinor.value).toBeNull();
    expect(metadata.fields.purchasedAt.value).toBeNull();
    const purchase = await createPurchaseDomain(
      {
        productName: "Unknown item",
        merchantName: "Unknown store",
        amountMinor: 1000,
        purchasedAt: new Date().toISOString(),
      },
      ctx,
    );
    expect((await getPurchaseDomain(purchase.id, ctx)).orderNumber).toBeNull();
    await expect(
      stageClaimPacketDomain(
        {
          purchaseId: purchase.id,
          issueTitle: "Fault",
          issueDescription: "Does not turn on",
          preferredResolution: "inspection",
          preferredLogistics: "drop_off",
        },
        ctx,
      ),
    ).rejects.toThrow(/not linked/i);
  });

  it("supports private media uploads with explicit buyer disclosure permissions", async () => {
    const buyer = { userEmail: DEMO_BUYER_EMAIL, caller: "http" as const };
    const merchant = { userEmail: DEMO_MERCHANT_EMAIL, caller: "http" as const };
    await resetDemoScenarioDomain({ mode: "submitted" }, buyer);

    const blobs = new Map<string, Uint8Array>();
    registerPrivateBlobProvider({
      id: "returnly-test-storage", name: "Test-only external storage", isConfigured: () => true,
      put: async (input) => { const id = randomUUID(); blobs.set(id, input.data); return { id, provider: "returnly-test-storage", opaque: true, encrypted: false }; },
      read: async (handle) => ({ data: blobs.get(handle.id)!, handle }),
      delete: async (handle) => ({ deleted: blobs.delete(handle.id), provider: "returnly-test-storage" }),
    });

    const samplePngDataUrl =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    // Buyer uploads a photo but marks discloseToMerchant = false initially
    const uploaded = await addClaimEvidenceDomain(
      {
        claimId: DEMO_IDS.claimHeadphones,
        label: "Private serial plate photo",
        mediaKind: "photo",
        note: "Contains private home desk background; withheld until approved.",
        fileName: "serial-plate.png",
        mimeType: "image/png",
        dataUrl: samplePngDataUrl,
        discloseToMerchant: false,
      },
      buyer,
    );
    expect(uploaded.attachmentId).toBeTruthy();
    const [storedAttachment] = await getDb().select().from(schema.attachments).where(eq(schema.attachments.id, uploaded.attachmentId!));
    expect(storedAttachment?.dataUrl).toBeNull();
    expect(storedAttachment?.storageKey).toMatch(/^private-blob:/);
    const foreignAttachmentId = randomUUID();
    await getDb().insert(schema.attachments).values({ id: foreignAttachmentId, ownerUserId: DEMO_IDS.outsiderUser, ownerEmail: DEMO_OUTSIDER_EMAIL, caseId: DEMO_IDS.claimHeadphones, fileName: "foreign.png", mimeType: "image/png", size: 10, storageKey: "fixture://foreign-private", disclosedToMerchant: false, purpose: "evidence" });
    await expect(setEvidenceDisclosureDomain({ claimId: DEMO_IDS.claimHeadphones, attachmentId: foreignAttachmentId, disclosedToMerchant: true }, buyer)).rejects.toThrow(/not found/i);
    await expect(addClaimEvidenceDomain({ claimId: DEMO_IDS.claimHeadphones, attachmentId: foreignAttachmentId, label: "Foreign attachment", mediaKind: "photo", note: "Must not disclose", discloseToMerchant: true }, buyer)).rejects.toThrow(/not found/i);
    const [stillPrivate] = await getDb().select().from(schema.attachments).where(eq(schema.attachments.id, foreignAttachmentId));
    expect(stillPrivate?.disclosedToMerchant).toBe(false);
    await expect(setEvidenceDisclosureDomain({ claimId: DEMO_IDS.claimHeadphones, attachmentId: DEMO_IDS.receiptAttachment, disclosedToMerchant: true }, { userEmail: DEMO_OUTSIDER_EMAIL, caller: "http" })).rejects.toThrow(/permission/i);

    // Buyer can see the private attachment
    const buyerView = await getClaimDomain(DEMO_IDS.claimHeadphones, buyer);
    const buyerEv = buyerView.evidence.find((e) => e.id === uploaded.id);
    expect(buyerEv?.storageStatus).toBe("uploaded_media");
    expect(buyerEv?.dataUrl).toBe(samplePngDataUrl);

    // Merchant cannot see the private attachment bytes before buyer disclosure
    const merchantViewBefore = await getClaimDomain(
      DEMO_IDS.claimHeadphones,
      merchant,
    );
    const merchantEvBefore = merchantViewBefore.evidence.find(
      (e) => e.id === uploaded.id,
    );
    expect(merchantEvBefore?.storageStatus).toBe("undisclosed_private");
    expect(merchantEvBefore?.attachmentId).toBeNull();
    expect(merchantEvBefore?.dataUrl).toBeNull();

    // Buyer grants disclosure permission
    await setEvidenceDisclosureDomain(
      {
        claimId: DEMO_IDS.claimHeadphones,
        attachmentId: uploaded.attachmentId!,
        disclosedToMerchant: true,
      },
      buyer,
    );

    const merchantViewAfter = await getClaimDomain(
      DEMO_IDS.claimHeadphones,
      merchant,
    );
    const merchantEvAfter = merchantViewAfter.evidence.find(
      (e) => e.id === uploaded.id,
    );
    expect(merchantEvAfter?.storageStatus).toBe("uploaded_media");
    expect(merchantEvAfter?.dataUrl).toBe(samplePngDataUrl);
  });

  it("prevents overbooking under competing claims, rejects past slots, and releases stock/slot on cancellation or expiry", async () => {
    const buyer = { userEmail: DEMO_BUYER_EMAIL, caller: "http" as const };
    const merchant = { userEmail: DEMO_MERCHANT_EMAIL, caller: "http" as const };
    await resetDemoScenarioDomain({ mode: "fresh_vault" }, buyer);
    const db = getDb();
    await db
      .update(schema.inventory)
      .set({ onHand: 2, reserved: 0 })
      .where(eq(schema.inventory.id, DEMO_IDS.invCentralHeadphones));
    await db
      .update(schema.slots)
      .set({ capacity: 1, reservedCount: 0 })
      .where(eq(schema.slots.id, DEMO_IDS.slotCentralMorning));

    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const draft = await stageClaimPacketDomain(
        {
          purchaseId: DEMO_IDS.purchaseHeadphones,
          issueTitle: `Booking test ${i}`,
          issueDescription: "Reported fault; inspection required",
          preferredResolution: "replacement",
          preferredLogistics: "drop_off",
        },
        buyer,
      );
      await submitClaimDomain(
        {
          claimId: draft.claimId,
          buyerApproved: true,
          idempotencyKey: randomUUID(),
        },
        buyer,
      );
      const offer = await proposeResolutionDomain(
        {
          claimId: draft.claimId,
          remedyType: "replacement",
          logisticsType: "drop_off",
          branchId: DEMO_IDS.centralBranch,
          slotId: DEMO_IDS.slotCentralMorning,
          note: "Inspection and replacement proposal",
        },
        merchant,
      );
      await acceptResolutionDomain(
        {
          claimId: draft.claimId,
          offerId: offer.offerId,
          expectedVersion: offer.version,
          idempotencyKey: randomUUID(),
        },
        buyer,
      );
      ids.push(draft.claimId);
    }

    await db.update(schema.slots).set({ serviceType: "pickup" }).where(eq(schema.slots.id, DEMO_IDS.slotCentralMorning));
    await expect(confirmSlotAndReserveDomain({ claimId: ids[0]!, idempotencyKey: randomUUID() }, merchant)).rejects.toThrow(/service does not match/i);
    expect((await getClaimDomain(ids[0]!, buyer)).reservation).toBeNull();
    await db.update(schema.slots).set({ serviceType: "drop_off" }).where(eq(schema.slots.id, DEMO_IDS.slotCentralMorning));

    const results = await Promise.allSettled(
      ids
        .slice(0, 2)
        .map((claimId) =>
          confirmSlotAndReserveDomain(
            { claimId, idempotencyKey: randomUUID() },
            merchant,
          ),
        ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);

    const [slot] = await db
      .select()
      .from(schema.slots)
      .where(eq(schema.slots.id, DEMO_IDS.slotCentralMorning));
    const [stock] = await db
      .select()
      .from(schema.inventory)
      .where(eq(schema.inventory.id, DEMO_IDS.invCentralHeadphones));
    expect(slot?.reservedCount).toBe(1);
    expect(stock?.reserved).toBe(1);

    await expect(
      confirmSlotAndReserveDomain(
        { claimId: ids[2]!, idempotencyKey: randomUUID() },
        merchant,
      ),
    ).rejects.toThrow(/slot is full/i);
    const [after] = await db
      .select()
      .from(schema.inventory)
      .where(eq(schema.inventory.id, DEMO_IDS.invCentralHeadphones));
    expect(after?.reserved).toBe(1);
    expect((await getClaimDomain(ids[2]!, buyer)).claim.status).toBe("agreed");

    // Cancel the confirmed reservation on the winning claim -> releases stock & slot
    const confirmedClaimId =
      results[0]?.status === "fulfilled" ? ids[0]! : ids[1]!;
    const cancelled = await cancelReservationDomain(
      {
        claimId: confirmedClaimId,
        reason: "Rescheduling appointment",
        idempotencyKey: "cancel-res-001",
      },
      buyer,
    );
    expect(cancelled.status).toBe("agreed");

    const [slotAfterCancel] = await db
      .select()
      .from(schema.slots)
      .where(eq(schema.slots.id, DEMO_IDS.slotCentralMorning));
    const [stockAfterCancel] = await db
      .select()
      .from(schema.inventory)
      .where(eq(schema.inventory.id, DEMO_IDS.invCentralHeadphones));
    expect(slotAfterCancel?.reservedCount).toBe(0);
    expect(stockAfterCancel?.reserved).toBe(0);

    // Past appointment slots are rejected
    const pastIso = new Date(Date.now() - 3600_000).toISOString();
    const origStartAt = slotAfterCancel!.startAt;
    await db
      .update(schema.slots)
      .set({ startAt: pastIso })
      .where(eq(schema.slots.id, DEMO_IDS.slotCentralMorning));

    await expect(
      confirmSlotAndReserveDomain(
        { claimId: ids[2]!, idempotencyKey: randomUUID() },
        merchant,
      ),
    ).rejects.toThrow(/in the past/i);

    // Restore future startAt and confirm ids[2] can now book the freed slot
    await db
      .update(schema.slots)
      .set({ startAt: origStartAt })
      .where(eq(schema.slots.id, DEMO_IDS.slotCentralMorning));

    const rebooked = await confirmSlotAndReserveDomain(
      { claimId: ids[2]!, idempotencyKey: randomUUID() },
      merchant,
    );
    expect(rebooked.status).toBe("appointment_confirmed");
    await getDb().update(schema.reservations).set({ expiresAt: new Date(Date.now() - 1000).toISOString() }).where(eq(schema.reservations.id, rebooked.reservationId));
    await Promise.all([releaseExpiredReservationsForClaim(ids[2]!), releaseExpiredReservationsForClaim(ids[2]!)]);
    const expiredView = await getClaimDomain(ids[2]!, buyer);
    expect(expiredView.claim.status).toBe("agreed");
    expect(expiredView.events.filter((event) => event.actionType === "reservation-expired")).toHaveLength(1);
    const [freedStock] = await db.select().from(schema.inventory).where(eq(schema.inventory.id, DEMO_IDS.invCentralHeadphones));
    expect(freedStock?.reserved).toBe(0);
    await expect(verifyReturnPassDomain({ token: rebooked.publicToken }, merchant)).rejects.toThrow(/invalidated|expired/i);
  });

  it("executes the persisted golden path with simulated tool/HTTP callers, retries, stock reservation and pass redemption", async () => {
    await resetDemoScenarioDomain(
      { mode: "fresh_vault" },
      { userEmail: DEMO_BUYER_EMAIL, caller: "http" },
    );

    // 1. Buyer Agent stages Return Passport (draft)
    const staged = await stageClaimPacketDomain(
      {
        purchaseId: DEMO_IDS.purchaseHeadphones,
        issueTitle: "Left speaker stopped working",
        issueDescription:
          "Left earcup audio cut out after 4 days of normal indoor listening.",
        preferredResolution: "replacement",
        preferredLogistics: "pickup",
      },
      { userEmail: DEMO_BUYER_EMAIL, caller: "tool" },
    );
    expect(staged.status).toBe("draft");

    // 2. Buyer approves and dispatches claim (with idempotency replay verification)
    const submitted1 = await submitClaimDomain(
      {
        claimId: staged.claimId,
        idempotencyKey: "test-submit-key-001",
        buyerApproved: true,
      },
      { userEmail: DEMO_BUYER_EMAIL, caller: "http" },
    );
    expect(submitted1.status).toBe("submitted");
    expect(submitted1.replayed).toBe(false);

    const submittedReplay = await submitClaimDomain(
      {
        claimId: staged.claimId,
        idempotencyKey: "test-submit-key-001",
        buyerApproved: true,
      },
      { userEmail: DEMO_BUYER_EMAIL, caller: "http" },
    );
    expect(submittedReplay.replayed).toBe(true);

    await expect(
      addClaimEvidenceDomain(
        {
          claimId: staged.claimId,
          label: "Fake video",
          mediaKind: "video",
          note: "No bytes sent",
        },
        { userEmail: DEMO_BUYER_EMAIL, caller: "http" },
      ),
    ).rejects.toThrow(/not connected/i);
    await expect(
      confirmSlotAndReserveDomain(
        { claimId: staged.claimId, idempotencyKey: "premature" },
        { userEmail: DEMO_MERCHANT_EMAIL, caller: "http" },
      ),
    ).rejects.toThrow(/accepted/i);
    await expect(
      generateReturnPassDomain(
        { claimId: staged.claimId },
        { userEmail: DEMO_BUYER_EMAIL, caller: "http" },
      ),
    ).rejects.toThrow(/merchant must confirm/i);

    // 3. Merchant Agent runs triage on submitted claim
    const triage1 = await triageMerchantClaimDomain(
      { claimId: staged.claimId },
      { userEmail: DEMO_MERCHANT_EMAIL, caller: "tool" },
    );
    expect(triage1.policyMatch).toBe("uncertain");
    expect(triage1.missingItems.length).toBeGreaterThan(0);

    // 4. Merchant requests written details
    const requested = await requestEvidenceDomain(
      {
        claimId: staged.claimId,
        requestedItem: "Fault details",
        note: "Describe the fault; inspection will be in person.",
      },
      { userEmail: DEMO_MERCHANT_EMAIL, caller: "http" },
    );
    expect(requested.status).toBe("awaiting_evidence");

    // 5. Buyer supplies an honest note, not a fabricated video
    const evidenceAdded = await addClaimEvidenceDomain(
      {
        claimId: staged.claimId,
        label: "Audio fault details",
        mediaKind: "diagnostic_note",
        note: "Shows right channel playing tone while left earcup is silent.",
      },
      { userEmail: DEMO_BUYER_EMAIL, caller: "http" },
    );
    expect(evidenceAdded.status).toBe("under_review");

    // 6. A note does not satisfy the policy requirement for a recording
    const triage2 = await triageMerchantClaimDomain(
      { claimId: staged.claimId },
      { userEmail: DEMO_MERCHANT_EMAIL, caller: "tool" },
    );
    expect(triage2.policyMatch).toBe("uncertain");
    expect(triage2.missingItems.join(" ")).toContain("not a recording");

    // 7. Merchant proposes Offer v1 (Replacement with drop_off)
    const offerV1 = await proposeResolutionDomain(
      {
        claimId: staged.claimId,
        remedyType: "replacement",
        logisticsType: "drop_off",
        branchId: DEMO_IDS.centralBranch,
        slotId: DEMO_IDS.slotCentralMorning,
        note: "Approved for Central Branch bench check + replacement swap.",
      },
      { userEmail: DEMO_MERCHANT_EMAIL, caller: "http" },
    );
    expect(offerV1.version).toBe(1);
    expect(offerV1.status).toBe("offer_pending");

    // 8. Buyer counters with Offer v2 (requesting Pickup + afternoon slot)
    const offerV2 = await counterResolutionDomain(
      {
        claimId: staged.claimId,
        remedyType: "replacement",
        logisticsType: "pickup",
        branchId: DEMO_IDS.centralBranch,
        slotId: DEMO_IDS.slotCentralPickup,
        note: "Requesting Scheduled Pickup for Tomorrow 2:00 PM – 3:30 PM.",
      },
      { userEmail: DEMO_BUYER_EMAIL, caller: "http" },
    );
    expect(offerV2.version).toBe(2);

    // Verify stale version check rejects accepting v1
    await expect(
      acceptResolutionDomain(
        {
          claimId: staged.claimId,
          offerId: offerV2.offerId,
          expectedVersion: 1,
          idempotencyKey: "stale-accept-attempt",
        },
        { userEmail: DEMO_MERCHANT_EMAIL, caller: "http" },
      ),
    ).rejects.toThrow(/stale offer version/i);

    // 9. Merchant accepts Buyer Counteroffer v2
    const accepted = await acceptResolutionDomain(
      {
        claimId: staged.claimId,
        offerId: offerV2.offerId,
        expectedVersion: 2,
        idempotencyKey: "accept-v2-key",
      },
      { userEmail: DEMO_MERCHANT_EMAIL, caller: "http" },
    );
    expect(accepted.status).toBe("agreed");

    // 10. Confirm slot & transactionally reserve replacement stock + issue QR pass
    const reserved = await confirmSlotAndReserveDomain(
      {
        claimId: staged.claimId,
        branchId: DEMO_IDS.centralBranch,
        slotId: DEMO_IDS.slotCentralPickup,
        idempotencyKey: "reserve-slot-key",
      },
      { userEmail: DEMO_MERCHANT_EMAIL, caller: "http" },
    );
    expect(reserved.status).toBe("appointment_confirmed");
    expect(reserved.publicToken).toMatch(/^RTP-/);

    const repeatedBooking = await confirmSlotAndReserveDomain(
      { claimId: staged.claimId, idempotencyKey: "different-retry-key" },
      { userEmail: DEMO_MERCHANT_EMAIL, caller: "http" },
    );
    expect(repeatedBooking.replayed).toBe(true);
    expect(repeatedBooking.publicToken).toBe(reserved.publicToken);
    await expect(
      recordHandoverDomain(
        { claimId: staged.claimId },
        { userEmail: DEMO_MERCHANT_EMAIL, caller: "http" },
      ),
    ).rejects.toThrow(/inspection/i);
    await expect(
      confirmResolutionReceivedDomain(
        { claimId: staged.claimId },
        { userEmail: DEMO_BUYER_EMAIL, caller: "http" },
      ),
    ).rejects.toThrow(/cannot be marked completed/i);

    // 11. Merchant verifies QR Return Pass & records bench inspection
    const verifiedPass = await verifyReturnPassDomain(
      {
        token: reserved.publicToken,
        recordInspection: true,
      },
      { userEmail: DEMO_MERCHANT_EMAIL, caller: "http" },
    );
    expect(verifiedPass.status).toBe("inspection");

    // 12. Merchant records physical replacement handover
    const handedOver = await recordHandoverDomain(
      {
        claimId: staged.claimId,
        handoverNote: "Sealed replacement unit handed over.",
      },
      { userEmail: DEMO_MERCHANT_EMAIL, caller: "http" },
    );
    expect(handedOver.status).toBe("fulfilled");

    const handoverReplay = await recordHandoverDomain(
      { claimId: staged.claimId },
      { userEmail: DEMO_MERCHANT_EMAIL, caller: "http" },
    );
    expect(handoverReplay.status).toBe("fulfilled");
    await expect(
      verifyReturnPassDomain(
        { token: reserved.publicToken },
        { userEmail: DEMO_MERCHANT_EMAIL, caller: "http" },
      ),
    ).rejects.toThrow(/redeemed/i);

    // 13. Buyer confirms resolution received -> case closed
    const closed = await confirmResolutionReceivedDomain(
      {
        claimId: staged.claimId,
        feedbackNote: "Both channels working great!",
      },
      { userEmail: DEMO_BUYER_EMAIL, caller: "http" },
    );
    expect(closed.status).toBe("closed");

    // Verify audit trail captured both UI and Agent sources
    const finalDetail = await getClaimDomain(staged.claimId, {
      userEmail: DEMO_BUYER_EMAIL,
      caller: "http",
    });
    const sources = new Set(finalDetail.events.map((e) => e.actorSource));
    expect(sources.has("buyer_agent")).toBe(true);
    expect(sources.has("buyer_ui")).toBe(true);
    expect(sources.has("merchant_agent")).toBe(true);
    expect(sources.has("merchant_ui")).toBe(true);
  });
});
