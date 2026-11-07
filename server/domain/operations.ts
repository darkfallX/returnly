import { formatAppointmentWindow } from "../../shared/appointment-time.ts";
import { randomBytes, randomUUID } from "node:crypto";
import {
  type ActionRunContext,
  NoWriteError,
} from "@agent-native/core/action";
import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { storeEvidence, readEvidence, isStoredEvidence } from "./evidence-storage.ts";
import { checkClaimPolicy } from "./triage.ts";

import { getDb, schema } from "../db/index.ts";
import {
  type ClaimStatus,
  claimStatusMachine,
  offerStateMachine,
} from "../db/machines.ts";
import {
  assertClaimAccess,
  computePartialRefundMinor,
  computePolicyCoverage,
  DEMO_BUYER_EMAIL,
  DEMO_IDS,
  DEMO_MERCHANT_EMAIL,
  DEMO_OUTSIDER_EMAIL,
  ensureSeededDemoData,
  getViewerPermissions,
  hashPassToken,
  resolveActorSource,
  seedDemoScenarioInternal,
} from "./returnly.ts";

export async function getViewerContextDomain(ctx?: ActionRunContext) {
  const perms = await getViewerPermissions(ctx);
  const db = getDb();

  const activeMerchant =
    perms.memberMerchants[0] ?? (perms.canAccessDemoSwitcher ? perms.demoMerchant : null);

  const merchantForCatalog = activeMerchant;

  let policy: typeof schema.merchantPolicies.$inferSelect | null = null;
  let merchantBranches: (typeof schema.branches.$inferSelect)[] = [];
  let merchantInventory: (typeof schema.inventory.$inferSelect)[] = [];
  let merchantSlots: (typeof schema.slots.$inferSelect)[] = [];

  if (merchantForCatalog) {
    const policies = await db
      .select()
      .from(schema.merchantPolicies)
      .where(eq(schema.merchantPolicies.merchantId, merchantForCatalog.id))
      .orderBy(desc(schema.merchantPolicies.version))
      .limit(1);
    policy = policies[0] ?? null;

    merchantBranches = await db
      .select()
      .from(schema.branches)
      .where(eq(schema.branches.merchantId, merchantForCatalog.id));

    merchantInventory = await db
      .select()
      .from(schema.inventory)
      .where(eq(schema.inventory.merchantId, merchantForCatalog.id));

    merchantSlots = await db
      .select()
      .from(schema.slots)
      .where(eq(schema.slots.merchantId, merchantForCatalog.id));
  }

  return {
    email: perms.email,
    user: perms.user,
    hasRealMerchantMembership: perms.hasRealMerchantMembership,
    canAccessDemoSwitcher: perms.canAccessDemoSwitcher,
    activeMerchant,
    demoMerchant: perms.demoMerchant,
    policy,
    branches: merchantBranches,
    inventory: merchantInventory,
    slots: merchantSlots,
    availableAccounts: [
      {
        email: DEMO_BUYER_EMAIL,
        label: "Maya Lin",
        role: "buyer" as const,
        subtitle: "Buyer · Seeded Vault",
      },
      {
        email: DEMO_MERCHANT_EMAIL,
        label: "Northline Support",
        role: "merchant" as const,
        subtitle: "Merchant · Northline Audio",
      },
      {
        email: DEMO_OUTSIDER_EMAIL,
        label: "Alex Rivera",
        role: "buyer" as const,
        subtitle: "Buyer · Isolated Account",
      },
    ],
  };
}

export async function switchViewerAccountDomain(
  input: {
    email: string;
    role?: "buyer" | "merchant" | undefined;
  },
  ctx?: ActionRunContext,
) {
  const cleanEmail = input.email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) {
    throw new NoWriteError("Provide a valid account email to switch.", {
      errorCode: "invalid_account_email",
      statusCode: 400,
    });
  }

  const perms = await getViewerPermissions(ctx);
  if (cleanEmail !== perms.email) {
    throw new NoWriteError("Sign in as that account to change identity. Demo preview only changes the view.", {
      errorCode: "account_switch_requires_sign_in",
      statusCode: 403,
    });
  }

  const effectiveRole: "buyer" | "merchant" = input.role === "merchant" && perms.memberMerchants.length > 0
    ? "merchant"
    : perms.memberMerchants.length > 0 && input.role !== "buyer" ? "merchant" : "buyer";

  return {
    id: perms.user.id,
    email: perms.email,
    displayName: perms.user.displayName,
    role: effectiveRole,
    hasRealMerchantMembership: perms.hasRealMerchantMembership,
    nextPath: effectiveRole === "merchant" ? "/merchant/home" : "/buyer/home",
    message: `Signed in as ${perms.user.displayName}.`,
  };
}

export async function completeOnboardingDomain(
  input: {
    role: "buyer" | "merchant" | "demo";
    displayName?: string | undefined;
    preferredCurrency?: string | undefined;
    notificationsOptIn?: boolean | undefined;
    merchantSetup?:
      | {
          shopName: string;
          category: string;
          supportContact: string;
          branchName: string;
          branchAddress: string;
          returnDays: number | null;
          warrantyDays: number | null;
          policySummary: string;
          importDemoData?: boolean | undefined;
        }
      | undefined;
  },
  ctx?: ActionRunContext,
) {
  if (input.role === "merchant" && (!input.merchantSetup || !input.merchantSetup.shopName.trim() || !input.merchantSetup.branchName.trim() || !input.merchantSetup.branchAddress.trim() || !input.merchantSetup.supportContact.trim() || !input.merchantSetup.policySummary.trim())) throw new NoWriteError("Provide a store, contact, branch address and explicit policy.", { errorCode: "merchant_setup_required", statusCode: 400 });
  const perms = await getViewerPermissions(ctx);
  return await getDb().transaction(async (db) => {
  const now = new Date().toISOString();

  const isDemo =
    input.role === "demo" || Boolean(input.merchantSetup?.importDemoData);
  const effectiveRole = input.role === "demo" ? "buyer" : input.role;

  await db
    .update(schema.users)
    .set({
      displayName: input.displayName?.trim() || perms.user.displayName,
      preferredRole: effectiveRole,
      preferredCurrency: input.preferredCurrency?.trim() || "NGN",
      notificationsOptIn: input.notificationsOptIn ?? true,
      onboardingCompleted: true,
      demoMode: isDemo,
    })
    .where(eq(schema.users.id, perms.user.id));

  let createdMerchantId: string | null = null;

  if (input.role === "merchant" && input.merchantSetup) {
    if (input.merchantSetup.importDemoData) {
      createdMerchantId = DEMO_IDS.merchantOrg;
      await db
        .insert(schema.merchantMemberships)
        .values({
          id: randomUUID(),
          memberUserId: perms.user.id,
          ownerEmail: perms.email,
          merchantId: DEMO_IDS.merchantOrg,
          role: "owner",
          createdAt: now,
        })
        .onConflictDoNothing();
    } else {
      const merchantId = randomUUID();
      createdMerchantId = merchantId;
      await db.insert(schema.merchantOrganizations).values({
        id: merchantId,
        ownerEmail: perms.email,
        name: input.merchantSetup.shopName.trim(),
        category: input.merchantSetup.category.trim(),
        supportContact: input.merchantSetup.supportContact.trim(),
        demoFlag: false,
        createdAt: now,
      });

      await db.insert(schema.merchantMemberships).values({
        id: randomUUID(),
        memberUserId: perms.user.id,
        ownerEmail: perms.email,
        merchantId,
        role: "owner",
        createdAt: now,
      });

      await db.insert(schema.merchantPolicies).values({
        id: randomUUID(),
        merchantId,
        version: 1,
        returnDays: input.merchantSetup.returnDays,
        warrantyDays: input.merchantSetup.warrantyDays,
        conditionsJson: JSON.stringify({
          returnRule: input.merchantSetup.policySummary.trim(),
          warrantyRule:
            input.merchantSetup.warrantyDays !== null
              ? `${input.merchantSetup.warrantyDays}-day store hardware warranty with inspection.`
              : "Check with merchant for manufacturer coverage.",
          requiresReceipt: true,
          requiresFaultMedia: true,
          allowedRemedies: [
            "inspection",
            "replacement",
            "repair",
            "partial_keep_item_refund",
          ],
          maxPartialKeepRefundPercent: 35,
        }),
        effectiveAt: now,
      });

      const branchId = randomUUID();
      await db.insert(schema.branches).values({
        id: branchId,
        merchantId,
        name: input.merchantSetup.branchName.trim(),
        addressText: input.merchantSetup.branchAddress.trim(),
        city: "Lagos",
        latitude: null,
        longitude: null,
        servicesJson: JSON.stringify([
          "Inspection",
          "Replacement swap",
          "Repair drop-off",
        ]),
        verifiedAt: null,
      });

    }
  }

  return {
    id: perms.user.id,
    role: effectiveRole,
    demoMode: isDemo || perms.user.demoMode,
    merchantId: createdMerchantId,
    nextPath:
      input.role === "demo"
        ? "/demo"
        : effectiveRole === "merchant"
          ? "/merchant/home"
          : "/buyer/home",
    message: `Onboarding completed for ${effectiveRole} workspace.`,
  };
  });
}

export async function listPurchasesDomain(ctx?: ActionRunContext) {
  const perms = await getViewerPermissions(ctx);
  const db = getDb();

  const rows = await db.select().from(schema.purchases)
    .where(eq(schema.purchases.ownerEmail, perms.email))
    .orderBy(desc(schema.purchases.purchasedAt));

  const merchantIds = [
    ...new Set(
      rows.map((r) => r.merchantId).filter((id): id is string => Boolean(id)),
    ),
  ];

  const policiesMap = new Map<
    string,
    typeof schema.merchantPolicies.$inferSelect
  >();
  if (merchantIds.length > 0) {
    const policies = await db
      .select()
      .from(schema.merchantPolicies)
      .where(inArray(schema.merchantPolicies.merchantId, merchantIds))
      .orderBy(desc(schema.merchantPolicies.version));
    for (const p of policies) {
      if (!policiesMap.has(p.merchantId)) {
        policiesMap.set(p.merchantId, p);
      }
    }
  }

  const purchaseIds = rows.map((r) => r.id);
  const claimsByPurchase = new Map<
    string,
    (typeof schema.claims.$inferSelect)[]
  >();
  if (purchaseIds.length > 0) {
    const relatedClaims = await db
      .select()
      .from(schema.claims)
      .where(inArray(schema.claims.purchaseId, purchaseIds))
      .orderBy(desc(schema.claims.updatedAt));
    for (const c of relatedClaims) {
      const list = claimsByPurchase.get(c.purchaseId) ?? [];
      list.push(c);
      claimsByPurchase.set(c.purchaseId, list);
    }
  }

  return rows.map((p) => {
    const policy = p.merchantId ? (policiesMap.get(p.merchantId) ?? null) : null;
    const coverage = computePolicyCoverage(p.purchasedAt, policy);
    const linkedClaims = claimsByPurchase.get(p.id) ?? [];
    return {
      ...p,
      coverage,
      policy: policy
        ? {
            id: policy.id,
            version: policy.version,
            returnDays: policy.returnDays,
            warrantyDays: policy.warrantyDays,
            conditions: JSON.parse(policy.conditionsJson || "{}"),
          }
        : null,
      linkedClaims: linkedClaims.map((c) => ({
        id: c.id,
        claimCode: c.claimCode,
        status: c.status,
        issueTitle: c.issueTitle,
        updatedAt: c.updatedAt,
      })),
    };
  });
}

export async function getPurchaseDomain(
  purchaseId: string,
  ctx?: ActionRunContext,
) {
  const list = await listPurchasesDomain(ctx);
  const found = list.find((p) => p.id === purchaseId);
  if (!found) {
    throw new NoWriteError(`Purchase ${purchaseId} not found or unauthorized.`, {
      errorCode: "purchase_not_found",
      statusCode: 404,
    });
  }
  const db = getDb();
  let receiptAttachment: typeof schema.attachments.$inferSelect | null = null;
  if (found.receiptId) {
    const attRows = await db
      .select()
      .from(schema.attachments)
      .where(eq(schema.attachments.id, found.receiptId))
      .limit(1);
    receiptAttachment = attRows[0] ?? null;
  }

  return {
    ...found,
    receiptAttachment: receiptAttachment
      ? {
          id: receiptAttachment.id,
          fileName: receiptAttachment.fileName,
          mimeType: receiptAttachment.mimeType,
          size: receiptAttachment.size,
          uploadedAt: receiptAttachment.uploadedAt,
          disclosedToMerchant: receiptAttachment.disclosedToMerchant,
          dataUrl: await readEvidence(receiptAttachment),
        }
      : null,
  };
}

export async function createPurchaseDomain(
  input: {
    productName: string;
    merchantName: string;
    merchantId?: string | null | undefined;
    category?: string | undefined;
    sku?: string | null | undefined;
    serial?: string | null | undefined;
    orderNumber?: string | null | undefined;
    amountMinor: number;
    currencyCode?: string | undefined;
    purchasedAt: string;
    sourceType?: "manual" | "receipt_upload" | undefined;
    receiptId?: string | null | undefined;
  },
  ctx?: ActionRunContext,
) {
  const perms = await getViewerPermissions(ctx);
  const db = getDb();
  const id = randomUUID();
  const now = new Date().toISOString();

  let resolvedMerchantId = input.merchantId ?? null;
  if (!resolvedMerchantId && input.merchantName?.toLowerCase().includes("northline")) {
    resolvedMerchantId = DEMO_IDS.merchantOrg;
  }
  if (resolvedMerchantId) {
    const [merchant] = await db
      .select()
      .from(schema.merchantOrganizations)
      .where(eq(schema.merchantOrganizations.id, resolvedMerchantId));
    if (!merchant) {
      throw new NoWriteError("Merchant was not found.", {
        errorCode: "merchant_not_found",
        statusCode: 404,
      });
    }
  }
  if (
    !Number.isSafeInteger(input.amountMinor) ||
    input.amountMinor <= 0 ||
    !Number.isFinite(Date.parse(input.purchasedAt)) ||
    Date.parse(input.purchasedAt) > Date.now()
  ) {
    throw new NoWriteError(
      "Enter a valid purchase date and a positive price in minor currency units.",
      { errorCode: "invalid_purchase", statusCode: 400 },
    );
  }
  if (input.receiptId) {
    const [receipt] = await db
      .select()
      .from(schema.attachments)
      .where(
        and(
          eq(schema.attachments.id, input.receiptId),
          eq(schema.attachments.ownerEmail, perms.email),
        ),
      );
    if (!receipt) {
      throw new NoWriteError("Receipt was not found or unauthorized.", {
        errorCode: "invalid_receipt",
        statusCode: 403,
      });
    }
  }

  await db.insert(schema.purchases).values({
    id,
    buyerUserId: perms.user.id,
    ownerEmail: perms.email,
    merchantId: resolvedMerchantId,
    merchantName: input.merchantName.trim(),
    branchId:
      resolvedMerchantId === DEMO_IDS.merchantOrg
        ? DEMO_IDS.centralBranch
        : null,
    productName: input.productName.trim(),
    category: input.category?.trim() || "Electronics",
    sku: input.sku?.trim() || null,
    serial: input.serial?.trim() || null,
    orderNumber: input.orderNumber?.trim() || null,
    amountMinor: Math.round(input.amountMinor),
    currencyCode: input.currencyCode?.trim() || "NGN",
    purchasedAt: input.purchasedAt,
    sourceType: input.sourceType ?? (input.receiptId ? "receipt_upload" : "manual"),
    receiptId: input.receiptId ?? null,
    verificationStatus: "user_confirmed",
    confidenceJson: JSON.stringify({
      merchantName: 100,
      productName: 100,
      amountMinor: 100,
      purchasedAt: 100,
      serial: input.serial ? 100 : 0,
    }),
    createdAt: now,
  });

  return {
    id,
    message: `Saved ${input.productName} (${input.merchantName}) to your Purchase Vault.`,
  };
}

export async function updatePurchaseDomain(
  input: {
    id: string;
    productName?: string | undefined;
    serial?: string | null | undefined;
    orderNumber?: string | null | undefined;
  },
  ctx?: ActionRunContext,
) {
  const existing = await getPurchaseDomain(input.id, ctx);
  const db = getDb();

  await db
    .update(schema.purchases)
    .set({
      productName: input.productName?.trim() || existing.productName,
      serial:
        input.serial !== undefined
          ? input.serial?.trim() || null
          : existing.serial,
      orderNumber:
        input.orderNumber !== undefined
          ? input.orderNumber?.trim() || null
          : existing.orderNumber,
      verificationStatus:
        existing.verificationStatus === "merchant_verified"
          ? "merchant_verified"
          : "user_confirmed",
    })
    .where(eq(schema.purchases.id, existing.id));

  return {
    id: existing.id,
    message: `Updated purchase details for ${input.productName ?? existing.productName}.`,
  };
}

export async function ingestReceiptDomain(
  input: {
    fileName: string;
    mimeType?: string | undefined;
    size?: number | undefined;
    dataUrl?: string | undefined;
    discloseToMerchant?: boolean | undefined;
    hintProductName?: string | undefined;
    hintMerchantName?: string | undefined;
    hintAmountMajor?: number | undefined;
  },
  ctx?: ActionRunContext,
) {
  const perms = await getViewerPermissions(ctx);
  const supplied = <T>(value: T | null) => ({
    value,
    confidence: 0,
    status: value === null ? "unknown" : "provided",
  });

  let attachmentId: string | null = null;
  if (input.dataUrl && input.dataUrl.trim().startsWith("data:")) {
    const db = getDb();
    attachmentId = randomUUID();
    const now = new Date().toISOString();
    const stored = await storeEvidence(input.dataUrl, perms.email, input.fileName, input.mimeType);
    await db.insert(schema.attachments).values({
      id: attachmentId,
      ownerUserId: perms.user.id,
      ownerEmail: perms.email,
      fileName: input.fileName.trim() || "receipt-upload",
      ...stored,
      purpose: "receipt",
      disclosedToMerchant: Boolean(input.discloseToMerchant),
      uploadedAt: now,
    });
  }

  return {
    attachmentId,
    extractionSource: attachmentId ? "uploaded_receipt" : "manual_metadata",
    requiresUserConfirmation: true,
    disclosedToMerchant: Boolean(input.discloseToMerchant),
    fields: {
      merchantName: supplied(input.hintMerchantName?.trim() || null),
      productName: supplied(input.hintProductName?.trim() || null),
      amountMinor: supplied(
        input.hintAmountMajor == null
          ? null
          : Math.round(input.hintAmountMajor * 100),
      ),
      purchasedAt: supplied<string>(null),
      serial: supplied<string>(null),
    },
    message: attachmentId
      ? "Private receipt uploaded and stored in your vault. Confirm purchase details below."
      : "Sample fields loaded. No file was uploaded or read. Enter the purchase date and confirm the details.",
  };
}

export async function stageClaimPacketDomain(
  input: {
    purchaseId: string;
    issueTitle: string;
    issueDescription: string;
    preferredResolution:
      | "inspection"
      | "repair"
      | "replacement"
      | "full_refund_request"
      | "partial_keep_item_refund";
    preferredLogistics: "drop_off" | "pickup";
    preferredBranchId?: string | null | undefined;
    preferredSlotId?: string | null | undefined;
    attachPhotoLabel?: string | undefined;
    attachPhotoNote?: string | undefined;
    attachDataUrl?: string | undefined;
    attachMimeType?: string | undefined;
    attachFileName?: string | undefined;
    discloseAttachmentsToMerchant?: boolean | undefined;
    autoSubmit?: boolean | undefined;
  },
  ctx?: ActionRunContext,
) {
  if (input.autoSubmit) throw new NoWriteError("Staging only creates a draft. Use submit-claim with buyer approval.", { errorCode: "buyer_approval_required", statusCode: 400 });
  const purchase = await getPurchaseDomain(input.purchaseId, ctx);
  const perms = await getViewerPermissions(ctx);
  const db = getDb();
  const now = new Date().toISOString();
  const actorSource = resolveActorSource("buyer", ctx);
  const lastChangedBy =
    actorSource === "buyer_agent" ? "Buyer Agent" : "Buyer";

  const merchantId = purchase.merchantId;
  if (!merchantId) {
    throw new NoWriteError(
      "This purchase is not linked to a participating merchant. Merchant review is needed before a claim can be sent.",
      { errorCode: "merchant_not_connected", statusCode: 400 },
    );
  }

  const existingDrafts = await db
    .select()
    .from(schema.claims)
    .where(
      and(
        eq(schema.claims.purchaseId, purchase.id),
        eq(schema.claims.status, "draft"),
      ),
    )
    .limit(1);

  const claimId = existingDrafts[0]?.id ?? randomUUID();
  const claimCode =
    existingDrafts[0]?.claimCode ??
    `RT-${Math.floor(1050 + Math.random() * 8900)}`;

  if (existingDrafts[0]) {
    await db
      .update(schema.claims)
      .set({
        issueTitle: input.issueTitle.trim(),
        issueDescription: input.issueDescription.trim(),
        preferredResolution: input.preferredResolution,
        preferredLogistics: input.preferredLogistics,
        preferredBranchId: input.preferredBranchId ?? null,
        preferredSlotId: input.preferredSlotId ?? null,
        lastChangedBy,
        lastActionSource: actorSource,
        updatedAt: now,
        version: existingDrafts[0].version + 1,
      })
      .where(eq(schema.claims.id, claimId));
  } else {
    await db.insert(schema.claims).values({
      id: claimId,
      claimCode,
      purchaseId: purchase.id,
      buyerUserId: perms.user.id,
      ownerEmail: perms.email,
      merchantId,
      status: "draft",
      issueTitle: input.issueTitle.trim(),
      issueDescription: input.issueDescription.trim(),
      preferredResolution: input.preferredResolution,
      preferredLogistics: input.preferredLogistics,
      preferredBranchId: input.preferredBranchId ?? null,
      preferredSlotId: input.preferredSlotId ?? null,
      policyVersionId: purchase.policy?.id ?? null,
      lastChangedBy,
      lastActionSource: actorSource,
      createdAt: now,
      updatedAt: now,
      version: 1,
    });

    if (purchase.receiptId) {
      await db.insert(schema.claimEvidence).values({
        id: randomUUID(),
        claimId,
        attachmentId: purchase.receiptId,
        submittedBy: actorSource,
        label:
          purchase.sourceType === "demo_seed"
            ? "Demo receipt fixture"
            : "Purchase receipt reference",
        mediaKind: "receipt",
        isVerified: false,
        confidence: 0,
        note: "Reference recorded; content has not been independently verified.",
        createdAt: now,
      });
    }
    if (purchase.sourceType === "demo_seed") {
      await db.insert(schema.claimEvidence).values({
        id: randomUUID(),
        claimId,
        attachmentId: DEMO_IDS.photoAttachment,
        submittedBy: actorSource,
        label: "Demo product photo fixture",
        mediaKind: "photo",
        isVerified: false,
        confidence: 0,
        note: "Illustrative demo fixture; no uploaded photo was analyzed.",
        createdAt: now,
      });
    }
  }

  if (input.attachDataUrl && input.attachDataUrl.startsWith("data:")) {
    const stored = await storeEvidence(input.attachDataUrl, perms.email, input.attachFileName || "evidence", input.attachMimeType);
    const attId = randomUUID();
    const isVideo = input.attachMimeType?.startsWith("video/") ?? false;
    await db.insert(schema.attachments).values({
      id: attId,
      ownerUserId: perms.user.id,
      ownerEmail: perms.email,
      caseId: claimId,
      purchaseId: purchase.id,
      fileName: input.attachFileName?.trim() || "evidence-upload",
      ...stored,
      purpose: "evidence",
      disclosedToMerchant: Boolean(input.discloseAttachmentsToMerchant),
      uploadedAt: now,
    });
    await db.insert(schema.claimEvidence).values({
      id: randomUUID(),
      claimId,
      attachmentId: attId,
      submittedBy: actorSource,
      label: input.attachPhotoLabel?.trim() || "Buyer evidence attachment",
      mediaKind: isVideo ? "video" : "photo",
      isVerified: false,
      confidence: 0,
      note:
        input.attachPhotoNote?.trim() ||
        "Buyer uploaded private media attachment.",
      createdAt: now,
    });
  }

  await db.insert(schema.claimEvents).values({
    id: randomUUID(),
    claimId,
    actorUserId: perms.user.id,
    actorRole: "buyer",
    actorSource,
    actionType: "stage-claim-packet",
    summary: `${lastChangedBy} staged Return Passport (${claimCode}) for ${purchase.productName}`,
    payloadRedactedJson: JSON.stringify({
      claimCode,
      preferredResolution: input.preferredResolution,
      preferredLogistics: input.preferredLogistics,
      serialStatus: purchase.serial ? "provided" : "not_provided",
    }),
    createdAt: now,
  });


  return {
    id: claimId,
    claimId,
    claimCode,
    status: "draft" as const,
    nextRequiredAction: "submit-claim",
    message: `Return Passport #${claimCode} staged as draft. Buyer approval is required before sending to ${purchase.merchantName}.`,
  };
}

export async function submitClaimDomain(
  input: {
    claimId: string;
    idempotencyKey: string;
    buyerApproved?: boolean | undefined;
    discloseAttachments?: boolean | undefined;
    demoActorRole?: "buyer" | "merchant" | undefined;
  },
  ctx?: ActionRunContext,
) {
  const { claim, merchant, perms } = await assertClaimAccess(
    input.claimId,
    "buyer",
    ctx,
    input.demoActorRole,
  );
  const db = getDb();

  const existingEvent = await db
    .select()
    .from(schema.claimEvents)
    .where(eq(schema.claimEvents.idempotencyKey, input.idempotencyKey))
    .limit(1);

  if (existingEvent[0] || claim.status !== "draft") {
    return {
      id: claim.id,
      claimId: claim.id,
      claimCode: claim.claimCode,
      status: claim.status as ClaimStatus,
      merchantName: merchant?.name ?? "Northline Audio",
      replayed: true,
      message: `Claim #${claim.claimCode} was already dispatched to ${merchant?.name ?? "Northline Audio"}.`,
    };
  }

  if (input.buyerApproved === false) {
    throw new NoWriteError(
      "Buyer must explicitly approve the Return Passport before dispatch.",
      {
        errorCode: "buyer_approval_required",
        statusCode: 400,
      },
    );
  }

  const nextStatus = claimStatusMachine.transition(
    claimStatusMachine.parseState(claim.status),
    "submit",
  );
  const now = new Date().toISOString();
  const actorSource = resolveActorSource("buyer", ctx);
  const lastChangedBy =
    actorSource === "buyer_agent" ? "Buyer Agent" : "Buyer";

  if (input.discloseAttachments !== false) {
    const evRows = await db
      .select()
      .from(schema.claimEvidence)
      .where(eq(schema.claimEvidence.claimId, claim.id));
    const attIds = evRows
      .map((e) => e.attachmentId)
      .filter((id): id is string => Boolean(id));
    if (attIds.length > 0) {
      await db
        .update(schema.attachments)
        .set({ disclosedToMerchant: true })
        .where(inArray(schema.attachments.id, attIds));
    }
  }

  await db
    .update(schema.claims)
    .set({
      status: nextStatus,
      lastChangedBy,
      lastActionSource: actorSource,
      updatedAt: now,
      version: claim.version + 1,
    })
    .where(
      and(
        eq(schema.claims.id, claim.id),
        inArray(schema.claims.status, claimStatusMachine.fromStates("submit")),
      ),
    );

  await db
    .update(schema.pendingApprovals)
    .set({ status: "approved", resolvedAt: now })
    .where(
      and(
        eq(schema.pendingApprovals.claimId, claim.id),
        eq(schema.pendingApprovals.actionName, "submit-claim"),
        eq(schema.pendingApprovals.status, "pending"),
      ),
    );

  await db.insert(schema.claimEvents).values({
    id: randomUUID(),
    claimId: claim.id,
    actorUserId: perms.user.id,
    actorRole: "buyer",
    actorSource,
    actionType: "submit-claim",
    summary: `${lastChangedBy} dispatched Claim #${claim.claimCode} to ${merchant?.name ?? "Northline Audio"}`,
    payloadRedactedJson: JSON.stringify({
      claimCode: claim.claimCode,
      merchantId: claim.merchantId,
      merchantName: merchant?.name ?? "Northline Audio",
      preferredResolution: claim.preferredResolution,
      preferredLogistics: claim.preferredLogistics,
      discloseAttachments: input.discloseAttachments !== false,
    }),
    createdAt: now,
    idempotencyKey: input.idempotencyKey,
  });

  await db.insert(schema.claimMessages).values({
    id: randomUUID(),
    claimId: claim.id,
    senderUserId: perms.user.id,
    senderRole: actorSource === "buyer_agent" ? "buyer_agent" : "buyer",
    body: `Claim #${claim.claimCode} submitted to ${merchant?.name ?? "Northline Audio"}. Issue: "${claim.issueTitle}". Preferred outcome: ${claim.preferredResolution.replace(/_/g, " ")} (${claim.preferredLogistics.replace(/_/g, " ")}).`,
    kind: "system",
    sentAt: now,
  });

  return {
    id: claim.id,
    claimId: claim.id,
    claimCode: claim.claimCode,
    status: nextStatus,
    merchantName: merchant?.name ?? "Northline Audio",
    replayed: false,
    message: `Claim sent to ${merchant?.name ?? "Northline Audio"}.`,
  };
}

export async function addClaimEvidenceDomain(
  input: {
    claimId: string;
    label: string;
    mediaKind: "receipt" | "photo" | "video" | "diagnostic_note";
    note: string;
    fileName?: string | undefined;
    mimeType?: string | undefined;
    size?: number | undefined;
    dataUrl?: string | undefined;
    attachmentId?: string | undefined;
    discloseToMerchant?: boolean | undefined;
    idempotencyKey?: string | undefined;
    demoActorRole?: "buyer" | "merchant" | undefined;
  },
  ctx?: ActionRunContext,
) {
  const { claim, perms, isBuyerOwner } = await assertClaimAccess(
    input.claimId,
    "either",
    ctx,
    input.demoActorRole,
  );
  const db = getDb();
  const now = new Date().toISOString();
  const role = isBuyerOwner ? "buyer" : "merchant";
  const actorSource = resolveActorSource(role, ctx);
  const lastChangedBy =
    actorSource === "buyer_agent"
      ? "Buyer Agent"
      : actorSource === "merchant_agent"
        ? "Merchant Agent"
        : role === "buyer"
          ? "Buyer"
          : "Merchant";

  if (input.idempotencyKey) {
    const existingEv = await db
      .select()
      .from(schema.claimEvents)
      .where(eq(schema.claimEvents.idempotencyKey, input.idempotencyKey))
      .limit(1);
    if (existingEv[0]) {
      return {
        id: existingEv[0].id,
        claimId: claim.id,
        status: claim.status as ClaimStatus,
        replayed: true,
        message: `Evidence "${input.label.trim()}" was already recorded.`,
      };
    }
  }

  if (!input.note.trim()) throw new NoWriteError("Enter a diagnostic note.", { errorCode: "empty_evidence", statusCode: 400 });
  let resolvedAttachmentId: string | null = input.attachmentId ?? null;

  if (input.mediaKind !== "diagnostic_note") {
    if (input.dataUrl && input.dataUrl.trim().startsWith("data:")) {
      resolvedAttachmentId = randomUUID();
      const shouldDisclose = input.discloseToMerchant === true;
      const stored = await storeEvidence(input.dataUrl, perms.email, input.fileName || "evidence", input.mimeType);
      await db.insert(schema.attachments).values({
        id: resolvedAttachmentId,
        ownerUserId: perms.user.id,
        ownerEmail: perms.email,
        caseId: claim.id,
        purchaseId: claim.purchaseId,
        fileName: input.fileName?.trim() || `${input.mediaKind}-evidence`,
        ...stored,
        purpose: input.mediaKind === "receipt" ? "receipt" : "evidence",
        disclosedToMerchant: shouldDisclose,
        uploadedAt: now,
      });
    } else if (resolvedAttachmentId) {
      const [att] = await db
        .select()
        .from(schema.attachments)
        .where(eq(schema.attachments.id, resolvedAttachmentId));
      if (!att || att.deletedAt || att.ownerUserId !== perms.user.id ||
          (att.caseId !== claim.id && att.purchaseId !== claim.purchaseId)) {
        throw new NoWriteError("Referenced attachment was not found.", {
          errorCode: "attachment_not_found",
          statusCode: 404,
        });
      }
      if (input.discloseToMerchant !== undefined) {
        await db
          .update(schema.attachments)
          .set({ disclosedToMerchant: input.discloseToMerchant })
          .where(eq(schema.attachments.id, resolvedAttachmentId));
      }
    } else {
      throw new NoWriteError(
        "File upload is not connected. Add a written diagnostic note or arrange a merchant inspection.",
        { errorCode: "media_upload_not_connected", statusCode: 400 },
      );
    }
  }

  if (!input.note.trim()) {
    throw new NoWriteError("Enter a diagnostic note.", {
      errorCode: "empty_evidence",
      statusCode: 400,
    });
  }

  const evidenceId = randomUUID();
  await db.insert(schema.claimEvidence).values({
    id: evidenceId,
    claimId: claim.id,
    attachmentId: resolvedAttachmentId,
    submittedBy: actorSource,
    label: input.label.trim(),
    mediaKind: input.mediaKind,
    isVerified: false,
    confidence: 0,
    note: input.note.trim(),
    createdAt: now,
  });

  let nextStatus = claimStatusMachine.parseState(claim.status);
  if (
    claimStatusMachine.can(nextStatus, "provide_evidence") &&
    claim.status === "awaiting_evidence"
  ) {
    nextStatus = claimStatusMachine.transition(nextStatus, "provide_evidence");
  }

  await db
    .update(schema.claims)
    .set({
      status: nextStatus,
      lastChangedBy,
      lastActionSource: actorSource,
      updatedAt: now,
      version: claim.version + 1,
    })
    .where(eq(schema.claims.id, claim.id));

  await db.insert(schema.claimMessages).values({
    id: randomUUID(),
    claimId: claim.id,
    senderUserId: perms.user.id,
    senderRole: actorSource,
    body: resolvedAttachmentId
      ? `Evidence uploaded (${input.mediaKind}): "${input.label.trim()}" - ${input.note.trim()}`
      : `Diagnostic note recorded: "${input.label.trim()}" - ${input.note.trim()}`,
    kind: "human",
    sentAt: now,
  });

  await db.insert(schema.claimEvents).values({
    id: randomUUID(),
    claimId: claim.id,
    actorUserId: perms.user.id,
    actorRole: role,
    actorSource,
    actionType: "add-claim-evidence",
    summary: `${lastChangedBy} attached ${input.mediaKind} ${resolvedAttachmentId ? "file" : "note"}: ${input.label.trim()}`,
    payloadRedactedJson: JSON.stringify({
      evidenceId,
      attachmentId: resolvedAttachmentId,
      mediaKind: input.mediaKind,
      label: input.label.trim(),
      disclosedToMerchant:
        input.discloseToMerchant ?? (claim.status !== "draft"),
      newStatus: nextStatus,
    }),
    createdAt: now,
    idempotencyKey: input.idempotencyKey ?? null,
  });

  return {
    id: evidenceId,
    claimId: claim.id,
    attachmentId: resolvedAttachmentId,
    status: nextStatus,
    message: `Attached "${input.label.trim()}" to Claim #${claim.claimCode}.`,
  };
}

export async function setEvidenceDisclosureDomain(
  input: {
    claimId: string;
    attachmentId: string;
    disclosedToMerchant: boolean;
    demoActorRole?: "buyer" | "merchant" | undefined;
  },
  ctx?: ActionRunContext,
) {
  const { claim, perms } = await assertClaimAccess(
    input.claimId,
    "buyer",
    ctx,
    input.demoActorRole,
  );
  const db = getDb();
  const now = new Date().toISOString();

  const [attachment] = await db.select().from(schema.attachments).where(and(
    eq(schema.attachments.id, input.attachmentId),
    eq(schema.attachments.ownerUserId, perms.user.id),
  ));
  if (!attachment || attachment.deletedAt ||
      (attachment.caseId !== claim.id && attachment.purchaseId !== claim.purchaseId)) {
    throw new NoWriteError("Attachment not found for this claim.", {
      errorCode: "attachment_not_found", statusCode: 404,
    });
  }

  await db
    .update(schema.attachments)
    .set({ disclosedToMerchant: input.disclosedToMerchant })
    .where(eq(schema.attachments.id, input.attachmentId));

  const actorSource = resolveActorSource("buyer", ctx);
  await db.insert(schema.claimEvents).values({
    id: randomUUID(),
    claimId: claim.id,
    actorUserId: perms.user.id,
    actorRole: "buyer",
    actorSource,
    actionType: "set-evidence-disclosure",
    summary: `Buyer ${input.disclosedToMerchant ? "disclosed" : "withheld"} private attachment for merchant inspection`,
    payloadRedactedJson: JSON.stringify({
      attachmentId: input.attachmentId,
      disclosedToMerchant: input.disclosedToMerchant,
    }),
    createdAt: now,
  });

  return {
    id: input.attachmentId,
    claimId: claim.id,
    disclosedToMerchant: input.disclosedToMerchant,
    message: input.disclosedToMerchant
      ? "Attachment disclosed to merchant."
      : "Attachment marked private to buyer vault.",
  };
}

export async function releaseExpiredReservationsForClaim(claimId: string) {
  const db = getDb();
  const reservations = await db
    .select()
    .from(schema.reservations)
    .where(
      and(
        eq(schema.reservations.claimId, claimId),
        eq(schema.reservations.status, "confirmed"),
      ),
    );

  const nowMs = Date.now();
  const expired = reservations.filter((r) => Date.parse(r.expiresAt) <= nowMs);
  if (expired.length === 0) return false;

  await db.transaction(async (tx) => {
    const [claim] = await tx
      .select()
      .from(schema.claims)
      .where(eq(schema.claims.id, claimId))
      .for("update");
    if (!claim) return;

    const now = new Date().toISOString();
    for (const res of expired) {
      const [freshRes] = await tx
        .select()
        .from(schema.reservations)
        .where(eq(schema.reservations.id, res.id))
        .for("update");
      if (!freshRes || freshRes.status !== "confirmed") continue;

      if (freshRes.inventoryId) {
        await tx
          .update(schema.inventory)
          .set({
            reserved: sql`GREATEST(0, ${schema.inventory.reserved} - 1)`,
            updatedAt: now,
          })
          .where(eq(schema.inventory.id, freshRes.inventoryId));
      }

      await tx
        .update(schema.slots)
        .set({
          reservedCount: sql`GREATEST(0, ${schema.slots.reservedCount} - 1)`,
        })
        .where(eq(schema.slots.id, freshRes.slotId));

      await tx
        .update(schema.reservations)
        .set({ status: "expired" })
        .where(eq(schema.reservations.id, freshRes.id));

      await tx
        .update(schema.returnPasses)
        .set({ invalidatedAt: now })
        .where(eq(schema.returnPasses.reservationId, freshRes.id));
    }

    if (claim.status === "appointment_confirmed") {
      await tx
        .update(schema.claims)
        .set({
          status: "agreed",
          lastChangedBy: "System",
          lastActionSource: "system",
          updatedAt: now,
          version: claim.version + 1,
        })
        .where(eq(schema.claims.id, claim.id));

      await tx.insert(schema.claimEvents).values({
        id: randomUUID(),
        claimId: claim.id,
        actorUserId: null,
        actorRole: "merchant",
        actorSource: "system",
        actionType: "reservation-expired",
        summary:
          "Reservation expired - reserved stock and appointment slot were automatically released",
        payloadRedactedJson: JSON.stringify({
          expiredCount: expired.length,
          status: "agreed",
        }),
        createdAt: now,
      });
    }
  });

  return true;
}

export async function cancelReservationDomain(
  input: {
    claimId: string;
    reason?: string | undefined;
    idempotencyKey?: string | undefined;
    demoActorRole?: "buyer" | "merchant" | undefined;
  },
  ctx?: ActionRunContext,
) {
  const { claim: authorizedClaim, perms, isBuyerOwner } =
    await assertClaimAccess(
      input.claimId,
      "either",
      ctx,
      input.demoActorRole,
    );
  const db = getDb();

  return await db.transaction(async (tx) => {
    const [claim] = await tx
      .select()
      .from(schema.claims)
      .where(eq(schema.claims.id, authorizedClaim.id))
      .for("update");
    if (!claim) {
      throw new NoWriteError("Claim no longer exists.", {
        errorCode: "claim_not_found",
        statusCode: 404,
      });
    }

    if (input.idempotencyKey) {
      const [existingEv] = await tx
        .select()
        .from(schema.claimEvents)
        .where(eq(schema.claimEvents.idempotencyKey, input.idempotencyKey));
      if (existingEv) {
        return {
          id: claim.id,
          claimId: claim.id,
          status: claim.status as ClaimStatus,
          replayed: true,
          message: "Reservation cancellation was already processed.",
        };
      }
    }

    if (claim.status === "fulfilled" || claim.status === "closed") {
      throw new NoWriteError(
        "Cannot cancel an appointment after physical handover is completed.",
        { errorCode: "already_fulfilled", statusCode: 409 },
      );
    }

    const reservations = await tx
      .select()
      .from(schema.reservations)
      .where(eq(schema.reservations.claimId, claim.id))
      .orderBy(desc(schema.reservations.createdAt));

    const activeRes = reservations.find((r) => r.status === "confirmed");
    if (!activeRes) {
      if (reservations[0]?.status === "cancelled" && claim.status === "agreed") {
        return {
          id: reservations[0].id,
          reservationId: reservations[0].id,
          claimId: claim.id,
          status: "agreed" as const,
          replayed: true,
          message: "Reservation was already cancelled and stock/slot released.",
        };
      }
      throw new NoWriteError(
        "No active confirmed reservation found to cancel.",
        { errorCode: "no_active_reservation", statusCode: 409 },
      );
    }

    const now = new Date().toISOString();
    if (activeRes.inventoryId) {
      await tx
        .update(schema.inventory)
        .set({
          reserved: sql`GREATEST(0, ${schema.inventory.reserved} - 1)`,
          updatedAt: now,
        })
        .where(eq(schema.inventory.id, activeRes.inventoryId));
    }

    await tx
      .update(schema.slots)
      .set({
        reservedCount: sql`GREATEST(0, ${schema.slots.reservedCount} - 1)`,
      })
      .where(eq(schema.slots.id, activeRes.slotId));

    await tx
      .update(schema.reservations)
      .set({ status: "cancelled" })
      .where(eq(schema.reservations.id, activeRes.id));

    await tx
      .update(schema.returnPasses)
      .set({ invalidatedAt: now })
      .where(eq(schema.returnPasses.reservationId, activeRes.id));

    const role = isBuyerOwner ? "buyer" : "merchant";
    const actorSource = resolveActorSource(role, ctx);
    const lastChangedBy =
      actorSource === "buyer_agent"
        ? "Buyer Agent"
        : actorSource === "merchant_agent"
          ? "Merchant Agent"
          : role === "buyer"
            ? "Buyer"
            : "Merchant";

    const reasonText =
      input.reason?.trim() || "Appointment cancelled to select another slot.";

    await tx
      .update(schema.claims)
      .set({
        status: "agreed",
        lastChangedBy,
        lastActionSource: actorSource,
        updatedAt: now,
        version: claim.version + 1,
      })
      .where(eq(schema.claims.id, claim.id));

    await tx.insert(schema.claimMessages).values({
      id: randomUUID(),
      claimId: claim.id,
      senderUserId: perms.user.id,
      senderRole: actorSource,
      body: `Reservation cancelled by ${lastChangedBy}: ${reasonText} Reserved branch stock and slot capacity have been released.`,
      kind: "system",
      sentAt: now,
    });

    await tx.insert(schema.claimEvents).values({
      id: randomUUID(),
      claimId: claim.id,
      actorUserId: perms.user.id,
      actorRole: role,
      actorSource,
      actionType: "cancel-reservation",
      summary: `${lastChangedBy} cancelled appointment & released stock/slot`,
      payloadRedactedJson: JSON.stringify({
        reservationId: activeRes.id,
        slotId: activeRes.slotId,
        inventoryReleased: Boolean(activeRes.inventoryId),
        reason: reasonText,
      }),
      createdAt: now,
      idempotencyKey: input.idempotencyKey ?? null,
    });

    return {
      id: activeRes.id,
      reservationId: activeRes.id,
      claimId: claim.id,
      status: "agreed" as const,
      replayed: false,
      message:
        "Appointment cancelled. Reserved stock and slot capacity have been released.",
    };
  });
}

export async function listClaimsDomain(
  input: { scope?: "buyer" | "merchant" | "all" | undefined } = {},
  ctx?: ActionRunContext,
) {
  const perms = await getViewerPermissions(ctx);
  const db = getDb();

  const allClaims = await db
    .select()
    .from(schema.claims)
    .orderBy(desc(schema.claims.updatedAt));

  const seededPurchases = await db
    .select({ id: schema.purchases.id })
    .from(schema.purchases)
    .where(eq(schema.purchases.sourceType, "demo_seed"));
  const seededIds = new Set(seededPurchases.map((p) => p.id));
  const visibleClaims = allClaims.filter((c) => {
    const isBuyerClaim = c.ownerEmail.toLowerCase() === perms.email;
    const isMerchantClaim = perms.memberships.some((m) => m.merchantId === c.merchantId) ||
      (perms.canAccessDemoSwitcher && c.merchantId === DEMO_IDS.merchantOrg && seededIds.has(c.purchaseId));

    if (input.scope === "buyer") return isBuyerClaim;
    if (input.scope === "merchant") return isMerchantClaim && c.status !== "draft";
    return isBuyerClaim || (isMerchantClaim && c.status !== "draft");
  });

  const purchaseIds = [...new Set(visibleClaims.map((c) => c.purchaseId))];
  const purchasesMap = new Map<
    string,
    typeof schema.purchases.$inferSelect
  >();
  if (purchaseIds.length > 0) {
    const pRows = await db
      .select()
      .from(schema.purchases)
      .where(inArray(schema.purchases.id, purchaseIds));
    for (const p of pRows) purchasesMap.set(p.id, p);
  }

  const merchantIds = [...new Set(visibleClaims.map((c) => c.merchantId))];
  const merchantsMap = new Map<
    string,
    typeof schema.merchantOrganizations.$inferSelect
  >();
  if (merchantIds.length > 0) {
    const mRows = await db
      .select()
      .from(schema.merchantOrganizations)
      .where(inArray(schema.merchantOrganizations.id, merchantIds));
    for (const m of mRows) merchantsMap.set(m.id, m);
  }

  return visibleClaims.map((c) => {
    const purchase = purchasesMap.get(c.purchaseId) ?? null;
    const merchant = merchantsMap.get(c.merchantId) ?? null;
    return {
      ...c,
      productName: purchase?.productName ?? "Purchase Item",
      amountMinor: purchase?.amountMinor ?? 0,
      currencyCode: purchase?.currencyCode ?? "NGN",
      purchasedAt: purchase?.purchasedAt ?? c.createdAt,
      merchantName: merchant?.name ?? purchase?.merchantName ?? "Merchant",
      demoFlag: Boolean(merchant?.demoFlag),
    };
  });
}

export async function getClaimDomain(
  claimId: string,
  ctx?: ActionRunContext,
  demoActorRole?: "buyer" | "merchant" | undefined,
) {
  const { claim, merchant, isBuyerOwner, isMerchantMember } =
    await assertClaimAccess(claimId, "either", ctx, demoActorRole);
  const db = getDb();

  const [
    purchaseRows,
    policyRows,
    evidenceRows,
    triageRows,
    messageRows,
    offerRows,
    branchRows,
    inventoryRows,
    slotRows,
    reservationRows,
    passRows,
    eventRows,
    approvalRows,
  ] = await Promise.all([
    db
      .select()
      .from(schema.purchases)
      .where(eq(schema.purchases.id, claim.purchaseId))
      .limit(1),
    db
      .select()
      .from(schema.merchantPolicies)
      .where(eq(schema.merchantPolicies.merchantId, claim.merchantId))
      .orderBy(desc(schema.merchantPolicies.version))
      .limit(1),
    db
      .select()
      .from(schema.claimEvidence)
      .where(eq(schema.claimEvidence.claimId, claim.id))
      .orderBy(asc(schema.claimEvidence.createdAt)),
    db
      .select()
      .from(schema.triageResults)
      .where(eq(schema.triageResults.claimId, claim.id))
      .orderBy(desc(schema.triageResults.createdAt)),
    db
      .select()
      .from(schema.claimMessages)
      .where(eq(schema.claimMessages.claimId, claim.id))
      .orderBy(asc(schema.claimMessages.sentAt)),
    db
      .select()
      .from(schema.resolutionOffers)
      .where(eq(schema.resolutionOffers.claimId, claim.id))
      .orderBy(desc(schema.resolutionOffers.version)),
    db
      .select()
      .from(schema.branches)
      .where(eq(schema.branches.merchantId, claim.merchantId)),
    db
      .select()
      .from(schema.inventory)
      .where(eq(schema.inventory.merchantId, claim.merchantId)),
    db
      .select()
      .from(schema.slots)
      .where(eq(schema.slots.merchantId, claim.merchantId)),
    db
      .select()
      .from(schema.reservations)
      .where(eq(schema.reservations.claimId, claim.id))
      .orderBy(desc(schema.reservations.createdAt)),
    db
      .select()
      .from(schema.returnPasses)
      .where(eq(schema.returnPasses.claimId, claim.id))
      .orderBy(desc(schema.returnPasses.createdAt)),
    db
      .select()
      .from(schema.claimEvents)
      .where(eq(schema.claimEvents.claimId, claim.id))
      .orderBy(asc(schema.claimEvents.createdAt)),
    db
      .select()
      .from(schema.pendingApprovals)
      .where(
        and(
          eq(schema.pendingApprovals.claimId, claim.id),
          eq(schema.pendingApprovals.status, "pending"),
        ),
      )
      .orderBy(desc(schema.pendingApprovals.createdAt)),
  ]);

  const purchase = purchaseRows[0] ?? null;
  const policy = policyRows[0] ?? null;
  const attachmentIds = evidenceRows.flatMap((e) =>
    e.attachmentId ? [e.attachmentId] : [],
  );
  const attachments = attachmentIds.length
    ? await db
        .select()
        .from(schema.attachments)
        .where(inArray(schema.attachments.id, attachmentIds))
    : [];

  const evidence = await Promise.all(evidenceRows.map(async (e) => {
    const attachment = attachments.find((a) => a.id === e.attachmentId);
    const fixture = attachment?.storageKey.startsWith("fixture://") === true;
    const isUploaded = attachment ? isStoredEvidence(attachment.storageKey) : false;
    const disclosed = attachment?.disclosedToMerchant ?? fixture;
    const canSeePrivateAttachment = isBuyerOwner || disclosed;

    const effectiveAttachmentId =
      canSeePrivateAttachment && (fixture || isUploaded)
        ? e.attachmentId
        : null;

    return {
      ...e,
      attachmentId: effectiveAttachmentId,
      disclosedToMerchant: disclosed,
      fileName: canSeePrivateAttachment ? (attachment?.fileName ?? null) : null,
      mimeType: canSeePrivateAttachment ? (attachment?.mimeType ?? null) : null,
      dataUrl: canSeePrivateAttachment && attachment && isUploaded ? await readEvidence(attachment) : null,
      isVerified: false,
      confidence: 0,
      storageStatus: !canSeePrivateAttachment
        ? ("undisclosed_private" as const)
        : fixture
          ? ("demo_fixture" as const)
          : isUploaded
            ? ("uploaded_media" as const)
            : e.mediaKind === "diagnostic_note"
              ? ("written_note" as const)
              : ("metadata_only" as const),
    };
  }));

  const coverage = purchase
    ? computePolicyCoverage(purchase.purchasedAt, policy)
    : null;
  const latestTriage = triageRows[0]
    ? {
        ...triageRows[0],
        missingItems: JSON.parse(
          triageRows[0].missingItemsJson || "[]",
        ) as string[],
        stockSnapshot: JSON.parse(
          triageRows[0].stockSnapshotJson || "[]",
        ) as Array<{
          branchId: string;
          branchName: string;
          available: number;
          onHand: number;
          reserved: number;
        }>,
        recommendedRemedies: JSON.parse(
          triageRows[0].recommendedRemediesJson || "[]",
        ) as string[],
        sourceRefs: JSON.parse(
          triageRows[0].sourceRefsJson || "[]",
        ) as string[],
      }
    : null;

  const activeOffer = offerRows[0] ?? null;
  const pendingApprovals = [
    ...approvalRows.map((a) => ({
      id: a.id,
      claimId: a.claimId,
      actorRole: a.actorRole as "buyer" | "merchant",
      actionName: a.actionName,
      title: a.title,
      summary: a.summary,
      payload: JSON.parse(a.payloadJson || "{}"),
      idempotencyKey: a.idempotencyKey,
      createdAt: a.createdAt,
    })),
  ];

  if (
    claim.status === "draft" &&
    !pendingApprovals.some((p) => p.actionName === "submit-claim")
  ) {
    pendingApprovals.push({
      id: `draft-approval-${claim.id}`,
      claimId: claim.id,
      actorRole: "buyer",
      actionName: "submit-claim",
      title: "Approve Return Passport Dispatch",
      summary: `Staged Claim #${claim.claimCode} is ready in draft. Buyer sign-off is required to disclose attachments and send to ${merchant?.name ?? "merchant"}.`,
      payload: { claimId: claim.id },
      idempotencyKey: `approve-submit-${claim.id}-v${claim.version}`,
      createdAt: claim.updatedAt,
    });
  } else if (
    activeOffer &&
    activeOffer.state === "offered" &&
    !pendingApprovals.some((p) => p.actionName === "accept-resolution")
  ) {
    const proposerIsBuyer =
      activeOffer.createdByRole === "buyer_ui" ||
      activeOffer.createdByRole === "buyer_agent";
    pendingApprovals.push({
      id: `offer-approval-${activeOffer.id}`,
      claimId: claim.id,
      actorRole: proposerIsBuyer ? "merchant" : "buyer",
      actionName: "accept-resolution",
      title: `Approve Offer v${activeOffer.version} (${activeOffer.remedyType.replace(/_/g, " ")})`,
      summary: `${proposerIsBuyer ? "Buyer counteroffer" : "Merchant offer"} v${activeOffer.version} awaits ${proposerIsBuyer ? "merchant" : "buyer"} human approval.`,
      payload: {
        claimId: claim.id,
        offerId: activeOffer.id,
        expectedVersion: activeOffer.version,
      },
      idempotencyKey: `approve-offer-${activeOffer.id}-v${activeOffer.version}`,
      createdAt: activeOffer.createdAt,
    });
  }

  return {
    claim,
    viewerRole: isBuyerOwner && !isMerchantMember ? "buyer" : isMerchantMember && !isBuyerOwner ? "merchant" : "both",
    purchase,
    merchant,
    policy: policy
      ? {
          ...policy,
          conditions: JSON.parse(policy.conditionsJson || "{}"),
        }
      : null,
    coverage,
    evidence,
    latestTriage,
    triageHistory: triageRows,
    messages: messageRows,
    offers: offerRows,
    activeOffer,
    requiredDecisions: pendingApprovals,
    branches: branchRows.map((b) => {
      const branchInv = inventoryRows.filter(
        (i) =>
          i.branchId === b.id &&
          Boolean(purchase?.sku) &&
          i.productSku === purchase?.sku,
      );
      const branchSlots = slotRows.filter((s) => s.branchId === b.id);
      const totalAvailableUnits = branchInv.reduce(
        (acc, item) => acc + Math.max(0, item.onHand - item.reserved),
        0,
      );
      return {
        ...b,
        services: JSON.parse(b.servicesJson || "[]") as string[],
        availableUnits: totalAvailableUnits,
        inventory: branchInv,
        slots: branchSlots,
      };
    }),
    reservation: reservationRows[0] ?? null,
    returnPass: passRows[0]
      ? {
          id: passRows[0].id,
          claimId: passRows[0].claimId,
          reservationId: passRows[0].reservationId,
          publicToken: passRows[0].publicToken,
          expiresAt: passRows[0].expiresAt,
          inspectedAt: passRows[0].inspectedAt,
          inspectionNote: passRows[0].inspectionNote,
          redeemedAt: passRows[0].redeemedAt,
          handoverNote: passRows[0].handoverNote,
          invalidatedAt: passRows[0].invalidatedAt,
          createdAt: passRows[0].createdAt,
        }
      : null,
    events: eventRows,
  };
}

export async function triageMerchantClaimDomain(
  input: {
    claimId: string;
    demoActorRole?: "buyer" | "merchant" | undefined;
  },
  ctx?: ActionRunContext,
) {
  const { claim, perms } = await assertClaimAccess(
    input.claimId,
    "merchant",
    ctx,
    input.demoActorRole,
  );
  const detail = await getClaimDomain(claim.id, ctx, input.demoActorRole ?? "merchant");
  const db = getDb();
  const now = new Date().toISOString();
  const actorSource = resolveActorSource("merchant", ctx);
  const lastChangedBy =
    actorSource === "merchant_agent" ? "Merchant Agent" : "Merchant";

  const stock = detail.branches.map((b) => {
    const matching = detail.purchase?.sku
      ? b.inventory.filter((i) => i.productSku === detail.purchase?.sku)
      : [];
    const onHand = matching.reduce((n, i) => n + i.onHand, 0);
    const reserved = matching.reduce((n, i) => n + i.reserved, 0);
    return {
      branchId: b.id,
      branchName: b.name,
      onHand,
      reserved,
      available: Math.max(0, onHand - reserved),
    };
  });
  const {
    policyMatch,
    daysSincePurchase,
    missingItems,
    stockSnapshot,
    recommendedRemedies,
    reasoningSummary,
    sourceRefs,
  } = checkClaimPolicy({
    issueTitle: claim.issueTitle,
    issueDescription: claim.issueDescription,
    policy: detail.policy,
    coverage: detail.coverage,
    purchase: detail.purchase,
    evidence: detail.evidence,
    stock,
  });
  const totalStock = stock.reduce((n, b) => n + b.available, 0);

  const triageId = randomUUID();
  await db.insert(schema.triageResults).values({
    id: triageId,
    claimId: claim.id,
    actorType: actorSource,
    policyMatch,
    daysSincePurchase,
    missingItemsJson: JSON.stringify(missingItems),
    stockSnapshotJson: JSON.stringify(stockSnapshot),
    recommendedRemediesJson: JSON.stringify(recommendedRemedies),
    reasoningSummary,
    sourceRefsJson: JSON.stringify(sourceRefs),
    createdAt: now,
  });

  const currentStatus = claimStatusMachine.parseState(claim.status);
  const nextStatus =
    claim.status === "submitted"
      ? claimStatusMachine.transition(currentStatus, "start_review")
      : currentStatus;

  await db
    .update(schema.claims)
    .set({
      status: nextStatus,
      lastChangedBy,
      lastActionSource: actorSource,
      updatedAt: now,
      version: claim.version + 1,
    })
    .where(eq(schema.claims.id, claim.id));

  await db.insert(schema.claimEvents).values({
    id: randomUUID(),
    claimId: claim.id,
    actorUserId: perms.user.id,
    actorRole: "merchant",
    actorSource,
    actionType: "triage-merchant-claim",
    summary: `${lastChangedBy} ran policy & stock triage (${policyMatch.toUpperCase()})`,
    payloadRedactedJson: JSON.stringify({
      triageId,
      policyMatch,
      daysSincePurchase,
      missingItemsCount: missingItems.length,
      totalStock,
    }),
    createdAt: now,
  });

  return {
    id: triageId,
    claimId: claim.id,
    policyMatch,
    daysSincePurchase,
    missingItems,
    stockSnapshot,
    recommendedRemedies,
    reasoningSummary,
    sourceRefs,
    status: nextStatus,
    nextRequiredAction:
      missingItems.length > 0 ? "request-evidence" : "propose-resolution",
    message: reasoningSummary,
  };
}

export async function requestEvidenceDomain(
  input: {
    claimId: string;
    requestedItem: string;
    note: string;
    idempotencyKey?: string | undefined;
    demoActorRole?: "buyer" | "merchant" | undefined;
  },
  ctx?: ActionRunContext,
) {
  const { claim, perms } = await assertClaimAccess(
    input.claimId,
    "merchant",
    ctx,
    input.demoActorRole,
  );
  const db = getDb();
  const now = new Date().toISOString();
  const actorSource = resolveActorSource("merchant", ctx);
  const lastChangedBy =
    actorSource === "merchant_agent" ? "Merchant Agent" : "Merchant";

  if (input.idempotencyKey) {
    const existingEv = await db
      .select()
      .from(schema.claimEvents)
      .where(eq(schema.claimEvents.idempotencyKey, input.idempotencyKey))
      .limit(1);
    if (existingEv[0]) {
      return {
        id: existingEv[0].id,
        claimId: claim.id,
        status: claim.status as ClaimStatus,
        replayed: true,
        message: `Already requested "${input.requestedItem.trim()}" from buyer.`,
      };
    }
  }

  const currentStatus = claimStatusMachine.parseState(claim.status);
  if (!claimStatusMachine.can(currentStatus, "request_evidence")) {
    throw new NoWriteError("Evidence cannot be requested in this state.", {
      errorCode: "invalid_evidence_request",
      statusCode: 409,
    });
  }
  const nextStatus = claimStatusMachine.can(currentStatus, "request_evidence")
    ? claimStatusMachine.transition(currentStatus, "request_evidence")
    : "awaiting_evidence";

  await db
    .update(schema.claims)
    .set({
      status: nextStatus,
      lastChangedBy,
      lastActionSource: actorSource,
      updatedAt: now,
      version: claim.version + 1,
    })
    .where(eq(schema.claims.id, claim.id));

  const msgId = randomUUID();
  await db.insert(schema.claimMessages).values({
    id: msgId,
    claimId: claim.id,
    senderUserId: perms.user.id,
    senderRole: actorSource,
    body: `Evidence requested (${input.requestedItem.trim()}): ${input.note.trim()}`,
    kind: "human",
    sentAt: now,
  });

  await db.insert(schema.claimEvents).values({
    id: randomUUID(),
    claimId: claim.id,
    actorUserId: perms.user.id,
    actorRole: "merchant",
    actorSource,
    actionType: "request-evidence",
    summary: `${lastChangedBy} requested additional evidence: ${input.requestedItem.trim()}`,
    payloadRedactedJson: JSON.stringify({
      requestedItem: input.requestedItem.trim(),
      status: nextStatus,
    }),
    createdAt: now,
    idempotencyKey: input.idempotencyKey ?? null,
  });

  return {
    id: msgId,
    claimId: claim.id,
    status: nextStatus,
    message: `Requested "${input.requestedItem.trim()}" from buyer. Claim #${claim.claimCode} is now awaiting evidence.`,
  };
}

export async function proposeResolutionDomain(
  input: {
    claimId: string;
    remedyType:
      | "inspection"
      | "repair"
      | "replacement"
      | "full_refund_request"
      | "partial_keep_item_refund";
    logisticsType: "drop_off" | "pickup";
    branchId?: string | null | undefined;
    slotId?: string | null | undefined;
    refundPercent?: number | null | undefined;
    note: string;
    idempotencyKey?: string | undefined;
    demoActorRole?: "buyer" | "merchant" | undefined;
  },
  ctx?: ActionRunContext,
) {
  const { claim, perms } = await assertClaimAccess(
    input.claimId,
    "merchant",
    ctx,
    input.demoActorRole,
  );
  const detail = await getClaimDomain(claim.id, ctx, input.demoActorRole ?? "merchant");
  const db = getDb();
  const now = new Date().toISOString();
  const actorSource = resolveActorSource("merchant", ctx);
  const lastChangedBy =
    actorSource === "merchant_agent" ? "Merchant Agent" : "Merchant";

  if (input.idempotencyKey) {
    const existingEv = await db
      .select()
      .from(schema.claimEvents)
      .where(eq(schema.claimEvents.idempotencyKey, input.idempotencyKey))
      .limit(1);
    if (existingEv[0] && detail.activeOffer) {
      return {
        id: detail.activeOffer.id,
        offerId: detail.activeOffer.id,
        claimId: claim.id,
        version: detail.activeOffer.version,
        status: claim.status as ClaimStatus,
        remedyType: detail.activeOffer.remedyType as any,
        logisticsType: detail.activeOffer.logisticsType as any,
        refundMinor: detail.activeOffer.refundMinor,
        refundPercent: detail.activeOffer.refundPercent,
        replayed: true,
        message: `Offer v${detail.activeOffer.version} was already proposed.`,
      };
    }
  }

  if (
    !claimStatusMachine.can(
      claimStatusMachine.parseState(claim.status),
      "propose_offer",
    )
  ) {
    throw new NoWriteError(
      "This claim cannot receive an offer in its current state.",
      { errorCode: "invalid_offer_state", statusCode: 409 },
    );
  }
  const allowed = detail.policy?.conditions.allowedRemedies;
  if (!Array.isArray(allowed) || !allowed.includes(input.remedyType)) {
    throw new NoWriteError(
      "This remedy is not covered by a stored merchant policy.",
      { errorCode: "remedy_needs_review", statusCode: 400 },
    );
  }
  if (
    input.remedyType === "partial_keep_item_refund" &&
    (input.refundPercent == null ||
      input.refundPercent <= 0 ||
      input.refundPercent >
        (detail.policy?.conditions.maxPartialKeepRefundPercent ?? 0))
  ) {
    throw new NoWriteError(
      "Refund proposal exceeds the stored policy or has no explicit percentage.",
      { errorCode: "refund_policy_limit", statusCode: 400 },
    );
  }

  const selectedBranchId =
    input.branchId ??
    detail.claim.preferredBranchId ??
    detail.branches[0]?.id ??
    null;
  const branch = detail.branches.find((b) => b.id === selectedBranchId);

  if (
    input.remedyType === "replacement" &&
    (!branch || branch.availableUnits <= 0)
  ) {
    throw new NoWriteError(
      `Cannot propose replacement at ${branch?.name ?? "selected branch"}: 0 units available in stock.`,
      {
        errorCode: "out_of_stock",
        statusCode: 400,
      },
    );
  }

  if (
    !branch ||
    (input.slotId && !branch.slots.some((s) => s.id === input.slotId))
  ) {
    throw new NoWriteError("Select a branch and slot belonging to this store.", {
      errorCode: "invalid_offer_location",
      statusCode: 400,
    });
  }

  const selectedSlotId = input.slotId ?? branch?.slots[0]?.id ?? null;
  const selectedSlot = branch.slots.find((s) => s.id === selectedSlotId);
  if (selectedSlot && Date.parse(selectedSlot.startAt) <= Date.now()) {
    throw new NoWriteError(
      "Cannot propose an appointment slot in the past. Please choose an upcoming slot.",
      { errorCode: "past_appointment_slot", statusCode: 400 },
    );
  }

  const purchaseAmountMinor = detail.purchase?.amountMinor ?? 0;
  let refundMinor: number | null = null;
  let refundPercent: number | null = null;

  if (input.remedyType === "partial_keep_item_refund") {
    refundPercent = input.refundPercent ?? 25;
    refundMinor = computePartialRefundMinor(purchaseAmountMinor, refundPercent);
  } else if (input.remedyType === "full_refund_request") {
    refundPercent = 100;
    refundMinor = purchaseAmountMinor;
  }

  const priorOffers = await db
    .select()
    .from(schema.resolutionOffers)
    .where(eq(schema.resolutionOffers.claimId, claim.id))
    .orderBy(desc(schema.resolutionOffers.version));

  const nextVersion = (priorOffers[0]?.version ?? 0) + 1;

  for (const old of priorOffers) {
    if (old.state === "offered" || old.state === "draft") {
      await db
        .update(schema.resolutionOffers)
        .set({ state: "withdrawn" })
        .where(eq(schema.resolutionOffers.id, old.id));
    }
  }

  const offerId = randomUUID();

  await db.insert(schema.resolutionOffers).values({
    id: offerId,
    claimId: claim.id,
    createdByRole: actorSource,
    remedyType: input.remedyType,
    logisticsType: input.logisticsType,
    refundMinor,
    refundPercent,
    currency: detail.purchase?.currencyCode ?? "NGN",
    branchId: selectedBranchId,
    slotId: selectedSlotId,
    note: input.note.trim(),
    conditionsJson: JSON.stringify({
      requiresInspectionOnArrival: true,
      noLiveMoneyTransferInMvp: true,
      branchName: branch?.name ?? "Central Branch",
    }),
    state: "offered",
    version: nextVersion,
    createdAt: now,
    expiresAt: new Date(Date.now() + 72 * 3600_000).toISOString(),
  });

  const currentStatus = claimStatusMachine.parseState(claim.status);
  const nextStatus = claimStatusMachine.can(currentStatus, "propose_offer")
    ? claimStatusMachine.transition(currentStatus, "propose_offer")
    : "offer_pending";

  await db
    .update(schema.claims)
    .set({
      status: nextStatus,
      lastChangedBy,
      lastActionSource: actorSource,
      updatedAt: now,
      version: claim.version + 1,
    })
    .where(eq(schema.claims.id, claim.id));

  await db.insert(schema.claimMessages).values({
    id: randomUUID(),
    claimId: claim.id,
    senderUserId: perms.user.id,
    senderRole: actorSource,
    body: `Offer v${nextVersion} proposed by ${lastChangedBy}: ${input.remedyType.replace(/_/g, " ")} (${input.logisticsType.replace(/_/g, " ")}) at ${branch?.name ?? "Central Branch"}${refundMinor ? ` · Proposed amount: ₦${(refundMinor / 100).toLocaleString()} (${refundPercent}%)` : ""}. ${input.note.trim()}`,
    kind: "human",
    sentAt: now,
  });

  await db.insert(schema.claimEvents).values({
    id: randomUUID(),
    claimId: claim.id,
    actorUserId: perms.user.id,
    actorRole: "merchant",
    actorSource,
    actionType: "propose-resolution",
    summary: `${lastChangedBy} proposed Offer v${nextVersion} (${input.remedyType.replace(/_/g, " ")} · ${input.logisticsType.replace(/_/g, " ")})`,
    payloadRedactedJson: JSON.stringify({
      offerId,
      version: nextVersion,
      remedyType: input.remedyType,
      logisticsType: input.logisticsType,
      refundMinor,
      refundPercent,
      branchId: selectedBranchId,
      slotId: selectedSlotId,
    }),
    createdAt: now,
    idempotencyKey: input.idempotencyKey ?? null,
  });

  return {
    id: offerId,
    offerId,
    claimId: claim.id,
    version: nextVersion,
    status: nextStatus,
    remedyType: input.remedyType,
    logisticsType: input.logisticsType,
    refundMinor,
    refundPercent,
    message: `Proposed Offer v${nextVersion} (${input.remedyType.replace(/_/g, " ")}) for Claim #${claim.claimCode}.`,
  };
}

export async function counterResolutionDomain(
  input: {
    claimId: string;
    remedyType?:
      | "inspection"
      | "repair"
      | "replacement"
      | "full_refund_request"
      | "partial_keep_item_refund"
      | undefined;
    logisticsType: "drop_off" | "pickup";
    branchId?: string | null | undefined;
    slotId?: string | null | undefined;
    refundPercent?: number | null | undefined;
    note: string;
    idempotencyKey?: string | undefined;
    demoActorRole?: "buyer" | "merchant" | undefined;
  },
  ctx?: ActionRunContext,
) {
  const { claim, perms } = await assertClaimAccess(
    input.claimId,
    "buyer",
    ctx,
    input.demoActorRole,
  );
  const detail = await getClaimDomain(claim.id, ctx, input.demoActorRole ?? "buyer");
  const db = getDb();
  const now = new Date().toISOString();
  const actorSource = resolveActorSource("buyer", ctx);
  const lastChangedBy =
    actorSource === "buyer_agent" ? "Buyer Agent" : "Buyer";

  if (input.idempotencyKey) {
    const existingEv = await db
      .select()
      .from(schema.claimEvents)
      .where(eq(schema.claimEvents.idempotencyKey, input.idempotencyKey))
      .limit(1);
    if (existingEv[0] && detail.activeOffer) {
      return {
        id: detail.activeOffer.id,
        offerId: detail.activeOffer.id,
        claimId: claim.id,
        version: detail.activeOffer.version,
        remedyType: detail.activeOffer.remedyType,
        logisticsType: detail.activeOffer.logisticsType as any,
        refundMinor: detail.activeOffer.refundMinor,
        refundPercent: detail.activeOffer.refundPercent,
        replayed: true,
        message: `Counteroffer v${detail.activeOffer.version} was already submitted.`,
      };
    }
  }

  const activeOffer = detail.activeOffer;
  if (
    !activeOffer ||
    activeOffer.state !== "offered" ||
    !claimStatusMachine.can(
      claimStatusMachine.parseState(claim.status),
      "counter_offer",
    )
  ) {
    throw new NoWriteError(
      "There is no active offer on this claim to counter.",
      {
        errorCode: "no_active_offer",
        statusCode: 400,
      },
    );
  }

  const remedyType = input.remedyType ?? (activeOffer.remedyType as any);
  const purchaseAmountMinor = detail.purchase?.amountMinor ?? 4_500_000;

  let refundMinor: number | null = activeOffer.refundMinor;
  let refundPercent: number | null = activeOffer.refundPercent;
  if (remedyType === "partial_keep_item_refund") {
    refundPercent = input.refundPercent ?? 30;
    refundMinor = computePartialRefundMinor(purchaseAmountMinor, refundPercent);
  } else if (
    remedyType === "replacement" ||
    remedyType === "repair" ||
    remedyType === "inspection"
  ) {
    refundMinor = null;
    refundPercent = null;
  }

  const targetBranch = detail.branches.find(
    (b) => b.id === (input.branchId ?? activeOffer.branchId),
  );
  const targetSlot = input.slotId ?? activeOffer.slotId;
  const matchedSlot = targetBranch?.slots.find((s) => s.id === targetSlot);
  if (!targetBranch || !matchedSlot) {
    throw new NoWriteError("Select a branch and slot belonging to this store.", {
      errorCode: "invalid_counter_location",
      statusCode: 400,
    });
  }

  if (Date.parse(matchedSlot.startAt) <= Date.now()) {
    throw new NoWriteError(
      "Cannot request an appointment slot in the past. Please choose a future slot.",
      { errorCode: "past_appointment_slot", statusCode: 400 },
    );
  }

  await db
    .update(schema.resolutionOffers)
    .set({ state: "countered" })
    .where(eq(schema.resolutionOffers.id, activeOffer.id));

  const nextVersion = activeOffer.version + 1;
  const newOfferId = randomUUID();
  const branchId = targetBranch.id;
  const slotId = targetSlot;

  await db.insert(schema.resolutionOffers).values({
    id: newOfferId,
    claimId: claim.id,
    createdByRole: actorSource,
    remedyType,
    logisticsType: input.logisticsType,
    refundMinor,
    refundPercent,
    currency: activeOffer.currency,
    branchId,
    slotId,
    note: input.note.trim(),
    conditionsJson: activeOffer.conditionsJson,
    state: "offered",
    version: nextVersion,
    createdAt: now,
    expiresAt: new Date(Date.now() + 72 * 3600_000).toISOString(),
  });

  await db
    .update(schema.claims)
    .set({
      preferredLogistics: input.logisticsType,
      preferredBranchId: branchId,
      preferredSlotId: slotId,
      lastChangedBy,
      lastActionSource: actorSource,
      updatedAt: now,
      version: claim.version + 1,
    })
    .where(eq(schema.claims.id, claim.id));

  await db.insert(schema.claimMessages).values({
    id: randomUUID(),
    claimId: claim.id,
    senderUserId: perms.user.id,
    senderRole: actorSource,
    body: `Counteroffer v${nextVersion} from ${lastChangedBy}: requests ${remedyType.replace(/_/g, " ")} with ${input.logisticsType.replace(/_/g, " ")}${refundMinor ? ` · Counter amount: ₦${(refundMinor / 100).toLocaleString()} (${refundPercent}%)` : ""}. Note: ${input.note.trim()}`,
    kind: "human",
    sentAt: now,
  });

  await db.insert(schema.claimEvents).values({
    id: randomUUID(),
    claimId: claim.id,
    actorUserId: perms.user.id,
    actorRole: "buyer",
    actorSource,
    actionType: "counter-resolution",
    summary: `${lastChangedBy} countered with Offer v${nextVersion} (${remedyType.replace(/_/g, " ")} · ${input.logisticsType.replace(/_/g, " ")})`,
    payloadRedactedJson: JSON.stringify({
      previousOfferId: activeOffer.id,
      newOfferId,
      version: nextVersion,
      remedyType,
      logisticsType: input.logisticsType,
      refundMinor,
      refundPercent,
      slotId,
    }),
    createdAt: now,
    idempotencyKey: input.idempotencyKey ?? null,
  });

  return {
    id: newOfferId,
    offerId: newOfferId,
    claimId: claim.id,
    version: nextVersion,
    remedyType,
    logisticsType: input.logisticsType,
    refundMinor,
    refundPercent,
    message: `Submitted Counteroffer v${nextVersion} (${input.logisticsType.replace(/_/g, " ")}).`,
  };
}

export async function acceptResolutionDomain(
  input: {
    claimId: string;
    offerId: string;
    expectedVersion?: number | undefined;
    idempotencyKey: string;
    demoActorRole?: "buyer" | "merchant" | undefined;
  },
  ctx?: ActionRunContext,
) {
  const { claim: authorizedClaim, perms, isBuyerOwner, isMerchantMember } =
    await assertClaimAccess(
      input.claimId,
      "either",
      ctx,
      input.demoActorRole,
    );
  const db = getDb();

  return await db.transaction(async (tx) => {
    const [claim] = await tx
      .select()
      .from(schema.claims)
      .where(eq(schema.claims.id, authorizedClaim.id))
      .for("update");
    if (!claim) {
      throw new NoWriteError("Claim no longer exists.", {
        errorCode: "claim_not_found",
        statusCode: 404,
      });
    }

    const existingEvent = await tx
      .select()
      .from(schema.claimEvents)
      .where(eq(schema.claimEvents.idempotencyKey, input.idempotencyKey))
      .limit(1);

    if (existingEvent[0] && (existingEvent[0].claimId !== claim.id || existingEvent[0].actionType !== "accept-resolution")) throw new NoWriteError("This retry key belongs to another operation.", { errorCode: "idempotency_conflict", statusCode: 409 });
    if (
      existingEvent[0] ||
      claim.status === "agreed" ||
      claim.status === "appointment_confirmed"
    ) {
      const [accepted] = await tx.select().from(schema.resolutionOffers).where(and(eq(schema.resolutionOffers.claimId, claim.id), eq(schema.resolutionOffers.state, "accepted"))).orderBy(desc(schema.resolutionOffers.version)).limit(1);
      if (!accepted || accepted.id !== input.offerId || (input.expectedVersion !== undefined && accepted.version !== input.expectedVersion)) throw new NoWriteError("This retry does not match the accepted offer.", { errorCode: "stale_offer_version", statusCode: 409 });
      return {
        id: input.offerId,
        offerId: input.offerId,
        claimId: claim.id,
        status: claim.status as ClaimStatus,
        replayed: true,
        nextRequiredAction: "confirm-slot-and-reserve",
        message: `Offer for Claim #${claim.claimCode} is already accepted.`,
      };
    }

    const offerRows = await tx
      .select()
      .from(schema.resolutionOffers)
      .where(
        and(
          eq(schema.resolutionOffers.id, input.offerId),
          eq(schema.resolutionOffers.claimId, claim.id),
        ),
      )
      .for("update");

    const offer = offerRows[0];
    if (!offer) {
      throw new NoWriteError("Specified resolution offer was not found.", {
        errorCode: "offer_not_found",
        statusCode: 404,
      });
    }

    if (
      input.expectedVersion !== undefined &&
      offer.version !== input.expectedVersion
    ) {
      throw new NoWriteError(
        `Stale offer version: expected v${input.expectedVersion}, but latest is v${offer.version}. Please review the updated terms.`,
        {
          errorCode: "stale_offer_version",
          statusCode: 409,
        },
      );
    }

    if (offer.state !== "offered") {
      throw new NoWriteError(
        `Offer v${offer.version} is in state "${offer.state}" and cannot be accepted.`,
        {
          errorCode: "offer_not_active",
          statusCode: 409,
        },
      );
    }

    const proposerIsBuyer =
      offer.createdByRole === "buyer_ui" ||
      offer.createdByRole === "buyer_agent";
    if (
      (proposerIsBuyer && !isMerchantMember) ||
      (!proposerIsBuyer && !isBuyerOwner)
    ) {
      throw new NoWriteError("The other party must accept this offer.", {
        errorCode: "offer_self_acceptance",
        statusCode: 403,
      });
    }
    if (offer.expiresAt && Date.parse(offer.expiresAt) <= Date.now()) {
      throw new NoWriteError("This offer has expired.", {
        errorCode: "offer_expired",
        statusCode: 409,
      });
    }

    const nextOfferState = offerStateMachine.transition(
      offerStateMachine.parseState(offer.state),
      "accept",
    );
    const nextClaimStatus = claimStatusMachine.transition(
      claimStatusMachine.parseState(claim.status),
      "accept_offer",
    );

    const role = proposerIsBuyer ? "merchant" : "buyer";
    const actorSource = resolveActorSource(role, ctx);
    const lastChangedBy =
      actorSource === "buyer_agent"
        ? "Buyer Agent"
        : actorSource === "merchant_agent"
          ? "Merchant Agent"
          : role === "buyer"
            ? "Buyer"
            : "Merchant";
    const now = new Date().toISOString();

    await tx
      .update(schema.resolutionOffers)
      .set({ state: nextOfferState })
      .where(eq(schema.resolutionOffers.id, offer.id));

    await tx
      .update(schema.claims)
      .set({
        status: nextClaimStatus,
        lastChangedBy,
        lastActionSource: actorSource,
        updatedAt: now,
        version: claim.version + 1,
      })
      .where(eq(schema.claims.id, claim.id));

    await tx
      .update(schema.pendingApprovals)
      .set({ status: "approved", resolvedAt: now })
      .where(
        and(
          eq(schema.pendingApprovals.claimId, claim.id),
          eq(schema.pendingApprovals.actionName, "accept-resolution"),
          eq(schema.pendingApprovals.status, "pending"),
        ),
      );

    await tx.insert(schema.claimMessages).values({
      id: randomUUID(),
      claimId: claim.id,
      senderUserId: perms.user.id,
      senderRole: actorSource,
      body: `Offer v${offer.version} accepted by ${lastChangedBy}: ${offer.remedyType.replace(/_/g, " ")} (${offer.logisticsType.replace(/_/g, " ")}). Ready to lock branch appointment & issue Return Pass.`,
      kind: "system",
      sentAt: now,
    });

    await tx.insert(schema.claimEvents).values({
      id: randomUUID(),
      claimId: claim.id,
      actorUserId: perms.user.id,
      actorRole: role,
      actorSource,
      actionType: "accept-resolution",
      summary: `${lastChangedBy} accepted Offer v${offer.version} (${offer.remedyType.replace(/_/g, " ")})`,
      payloadRedactedJson: JSON.stringify({
        offerId: offer.id,
        version: offer.version,
        remedyType: offer.remedyType,
        logisticsType: offer.logisticsType,
        refundMinor: offer.refundMinor,
      }),
      createdAt: now,
      idempotencyKey: input.idempotencyKey,
    });

    return {
      id: offer.id,
      offerId: offer.id,
      claimId: claim.id,
      status: nextClaimStatus,
      replayed: false,
      nextRequiredAction: "confirm-slot-and-reserve",
      message: `Accepted Offer v${offer.version}. Confirm branch slot to reserve inventory and generate your QR Return Pass.`,
    };
  });
}

export async function confirmSlotAndReserveDomain(
  input: {
    claimId: string;
    branchId?: string | undefined;
    slotId?: string | undefined;
    idempotencyKey: string;
    demoActorRole?: "buyer" | "merchant" | undefined;
  },
  ctx?: ActionRunContext,
) {
  const { claim: authorizedClaim, perms, isMerchantMember } = await assertClaimAccess(
    input.claimId,
    "merchant",
    ctx,
    input.demoActorRole,
  );
  await releaseExpiredReservationsForClaim(input.claimId);
  const db = getDb();
  return await db.transaction(async (tx) => {
    const [claim] = await tx
      .select()
      .from(schema.claims)
      .where(eq(schema.claims.id, authorizedClaim.id))
      .for("update");
    if (!claim) {
      throw new NoWriteError("Claim no longer exists.", {
        errorCode: "claim_not_found",
        statusCode: 404,
      });
    }
    const existingList = await tx
      .select()
      .from(schema.reservations)
      .where(eq(schema.reservations.claimId, claim.id))
      .orderBy(desc(schema.reservations.createdAt));
    const existing = existingList.find((r) => r.status === "confirmed");
    if (existing) {
      const [pass] = await tx
        .select()
        .from(schema.returnPasses)
        .where(eq(schema.returnPasses.reservationId, existing.id));
      if (
        existing.status !== "confirmed" ||
        !pass ||
        pass.invalidatedAt ||
        pass.redeemedAt ||
        Date.parse(pass.expiresAt) <= Date.now()
      ) {
        throw new NoWriteError("This reservation is no longer active.", {
          errorCode: "inactive_reservation",
          statusCode: 409,
        });
      }
      return {
        id: existing.id,
        reservationId: existing.id,
        passId: pass.id,
        claimId: claim.id,
        status: claim.status,
        publicToken: pass.publicToken,
        expiresAt: pass.expiresAt,
        replayed: true,
        message:
          "Appointment already confirmed; no additional stock or slot was reserved.",
      };
    }
    if (claim.status !== "agreed") {
      throw new NoWriteError(
        "An accepted resolution is required before booking.",
        { errorCode: "offer_required_before_reservation", statusCode: 409 },
      );
    }
    const [offer] = await tx
      .select()
      .from(schema.resolutionOffers)
      .where(
        and(
          eq(schema.resolutionOffers.claimId, claim.id),
          eq(schema.resolutionOffers.state, "accepted"),
        ),
      )
      .orderBy(desc(schema.resolutionOffers.version));
    if (!offer) {
      throw new NoWriteError("An accepted offer is required.", {
        errorCode: "accepted_offer_required",
        statusCode: 409,
      });
    }
    const branchId = input.branchId ?? offer.branchId;
    const slotId = input.slotId ?? offer.slotId;
    if (
      !branchId ||
      !slotId ||
      branchId !== offer.branchId ||
      slotId !== offer.slotId
    ) {
      throw new NoWriteError(
        "Booking must match the accepted offer. Agree a new offer to change branch or slot.",
        { errorCode: "booking_terms_mismatch", statusCode: 409 },
      );
    }
    const [branch] = await tx
      .select()
      .from(schema.branches)
      .where(
        and(
          eq(schema.branches.id, branchId),
          eq(schema.branches.merchantId, claim.merchantId),
        ),
      );
    const [slot] = await tx
      .select()
      .from(schema.slots)
      .where(
        and(
          eq(schema.slots.id, slotId),
          eq(schema.slots.branchId, branchId),
          eq(schema.slots.merchantId, claim.merchantId),
        ),
      );
    if (!branch || !slot) {
      throw new NoWriteError("Branch and slot do not belong to this store.", {
        errorCode: "invalid_booking_location",
        statusCode: 400,
      });
    }
    if (slot.serviceType !== offer.logisticsType) {
      throw new NoWriteError("The slot service does not match the accepted offer. Agree a matching appointment.", { errorCode: "booking_service_mismatch", statusCode: 409 });
    }
    if (Date.parse(slot.startAt) <= Date.now()) {
      throw new NoWriteError(
        "Cannot confirm an appointment slot in the past. Please agree on a future slot.",
        { errorCode: "past_appointment_slot", statusCode: 400 },
      );
    }
    const now = new Date().toISOString();
    let inventoryId: string | null = null;
    if (offer.remedyType === "replacement") {
      const [purchase] = await tx
        .select()
        .from(schema.purchases)
        .where(eq(schema.purchases.id, claim.purchaseId));
      const [inventory] = purchase?.sku
        ? await tx
            .select()
            .from(schema.inventory)
            .where(
              and(
                eq(schema.inventory.branchId, branchId),
                eq(schema.inventory.merchantId, claim.merchantId),
                eq(schema.inventory.productSku, purchase.sku),
              ),
            )
        : [];
      if (!inventory) {
        throw new NoWriteError(
          "No matching replacement stock is recorded for this product.",
          { errorCode: "insufficient_branch_inventory", statusCode: 409 },
        );
      }
      const reserved = await tx
        .update(schema.inventory)
        .set({ reserved: sql`${schema.inventory.reserved} + 1`, updatedAt: now })
        .where(
          and(
            eq(schema.inventory.id, inventory.id),
            sql`${schema.inventory.onHand} > ${schema.inventory.reserved}`,
          ),
        )
        .returning({ id: schema.inventory.id });
      if (!reserved.length) {
        throw new NoWriteError(
          "No replacement stock is available at this branch.",
          { errorCode: "insufficient_branch_inventory", statusCode: 409 },
        );
      }
      inventoryId = inventory.id;
    }
    const booked = await tx
      .update(schema.slots)
      .set({ reservedCount: sql`${schema.slots.reservedCount} + 1` })
      .where(
        and(
          eq(schema.slots.id, slot.id),
          sql`${schema.slots.reservedCount} < ${schema.slots.capacity}`,
        ),
      )
      .returning({ id: schema.slots.id });
    if (!booked.length) {
      throw new NoWriteError(
        "This appointment slot is full. Agree a different slot with the buyer.",
        { errorCode: "slot_capacity_exceeded", statusCode: 409 },
      );
    }
    const expiresAt = new Date(Date.now() + 7 * 86_400_000).toISOString();
    const reservationId = randomUUID();
    const passId = randomUUID();
    const publicToken = `RTP-${randomBytes(16).toString("hex").toUpperCase()}`;
    await tx.insert(schema.reservations).values({
      id: reservationId,
      claimId: claim.id,
      offerId: offer.id,
      inventoryId,
      slotId: slot.id,
      branchId,
      status: "confirmed",
      expiresAt,
      createdAt: now,
    });
    await tx.insert(schema.returnPasses).values({
      id: passId,
      claimId: claim.id,
      reservationId,
      publicToken,
      hashedToken: hashPassToken(publicToken),
      expiresAt,
      createdAt: now,
    });
    const actorSide = isMerchantMember ? "merchant" : "buyer";
    const actorSource = resolveActorSource(actorSide, ctx);
    const lastChangedBy =
      actorSource === "merchant_agent"
        ? "Merchant Agent"
        : actorSource === "buyer_agent"
          ? "Buyer Agent"
          : isMerchantMember
            ? "Merchant"
            : "Buyer";
    await tx
      .update(schema.claims)
      .set({
        status: "appointment_confirmed",
        preferredBranchId: branchId,
        preferredSlotId: slot.id,
        lastChangedBy,
        lastActionSource: actorSource,
        updatedAt: now,
        version: claim.version + 1,
      })
      .where(eq(schema.claims.id, claim.id));
    await tx.insert(schema.claimMessages).values({
      id: randomUUID(),
      claimId: claim.id,
      senderUserId: perms.user.id,
      senderRole: actorSource,
      body: `Appointment confirmed at ${branch.name} (${formatAppointmentWindow(slot)}). An app-issued check-in pass is available.`,
      kind: "system",
      sentAt: now,
    });
    await tx.insert(schema.claimEvents).values({
      id: randomUUID(),
      claimId: claim.id,
      actorUserId: perms.user.id,
      actorRole: "merchant",
      actorSource,
      actionType: "confirm-slot-and-reserve",
      summary: `${lastChangedBy} reserved ${formatAppointmentWindow(slot)} at ${branch.name}`,
      payloadRedactedJson: JSON.stringify({
        reservationId,
        passId,
        branchId,
        slotId: slot.id,
        inventoryReserved: Boolean(inventoryId),
      }),
      createdAt: now,
      idempotencyKey: input.idempotencyKey,
    });
    return {
      id: reservationId,
      reservationId,
      passId,
      claimId: claim.id,
      status: "appointment_confirmed",
      publicToken,
      expiresAt,
      replayed: false,
      message: `Appointment confirmed at ${branch.name} (${formatAppointmentWindow(slot)}). Return pass issued for merchant check-in; no carrier booking was made.`,
    };
  });
}

export async function generateReturnPassDomain(
  input: { claimId: string },
  ctx?: ActionRunContext,
) {
  const detail = await getClaimDomain(input.claimId, ctx);
  if (detail.returnPass && !detail.returnPass.invalidatedAt) {
    return {
      id: detail.returnPass.id,
      claimId: detail.claim.id,
      publicToken: detail.returnPass.publicToken,
      expiresAt: detail.returnPass.expiresAt,
      message: `Return Pass ${detail.returnPass.publicToken} is active.`,
    };
  }
  throw new NoWriteError(
    "The merchant must confirm the agreed appointment before a return pass is available.",
    { errorCode: "reservation_required", statusCode: 409 },
  );
}

export async function verifyReturnPassDomain(
  input: {
    token: string;
    recordInspection?: boolean | undefined;
    inspectionNote?: string | undefined;
    demoActorRole?: "buyer" | "merchant" | undefined;
  },
  ctx?: ActionRunContext,
) {
  await ensureSeededDemoData();
  const db = getDb();
  const cleanToken = input.token.trim().toUpperCase();
  const hashed = hashPassToken(cleanToken);

  const passRows = await db
    .select()
    .from(schema.returnPasses)
    .where(
      or(
        eq(schema.returnPasses.hashedToken, hashed),
        eq(schema.returnPasses.publicToken, cleanToken),
      ),
    )
    .limit(1);

  const pass = passRows[0];
  if (!pass) {
    throw new NoWriteError(`Return Pass token "${cleanToken}" is invalid.`, {
      errorCode: "invalid_return_pass",
      statusCode: 404,
    });
  }

  const { claim, perms } = await assertClaimAccess(
    pass.claimId,
    "merchant",
    ctx,
    input.demoActorRole,
  );

  if (pass.invalidatedAt) {
    throw new NoWriteError(
      `Return Pass ${pass.publicToken} was invalidated.`,
      {
        errorCode: "pass_invalidated",
        statusCode: 409,
      },
    );
  }

  if (Date.parse(pass.expiresAt) < Date.now()) {
    throw new NoWriteError(`Return Pass ${pass.publicToken} has expired.`, {
      errorCode: "pass_expired",
      statusCode: 410,
    });
  }

  const now = new Date().toISOString();
  const actorSource = resolveActorSource("merchant", ctx);
  const lastChangedBy =
    actorSource === "merchant_agent" ? "Merchant Agent" : "Merchant";

  let nextStatus = claimStatusMachine.parseState(claim.status);
  if (pass.redeemedAt) {
    throw new NoWriteError("This return pass has already been redeemed.", {
      errorCode: "pass_redeemed",
      statusCode: 409,
    });
  }
  if (input.recordInspection === true && !pass.inspectedAt) {
    if (!claimStatusMachine.can(nextStatus, "record_inspection")) {
      throw new NoWriteError(
        "This claim cannot be inspected in its current state.",
        { errorCode: "invalid_inspection_state", statusCode: 409 },
      );
    }
    if (claimStatusMachine.can(nextStatus, "record_inspection")) {
      nextStatus = claimStatusMachine.transition(
        nextStatus,
        "record_inspection",
      );
    }

    await db
      .update(schema.returnPasses)
      .set({
        inspectedAt: pass.inspectedAt ?? now,
        inspectionNote:
          input.inspectionNote?.trim() ||
          "Merchant recorded inspection completion; no automated diagnosis.",
      })
      .where(eq(schema.returnPasses.id, pass.id));

    await db
      .update(schema.claims)
      .set({
        status: nextStatus,
        lastChangedBy,
        lastActionSource: actorSource,
        updatedAt: now,
        version: claim.version + 1,
      })
      .where(eq(schema.claims.id, claim.id));

    await db.insert(schema.claimEvents).values({
      id: randomUUID(),
      claimId: claim.id,
      actorUserId: perms.user.id,
      actorRole: "merchant",
      actorSource,
      actionType: "verify-return-pass",
      summary: `${lastChangedBy} verified Return Pass ${pass.publicToken} & recorded Inspection completed`,
      payloadRedactedJson: JSON.stringify({
        passId: pass.id,
        publicToken: pass.publicToken,
        inspectedAt: now,
        status: nextStatus,
      }),
      createdAt: now,
    });
  }

  const updatedDetail = await getClaimDomain(
    claim.id,
    ctx,
    input.demoActorRole ?? "merchant",
  );

  return {
    id: pass.id,
    claimId: claim.id,
    claimCode: claim.claimCode,
    publicToken: pass.publicToken,
    status: nextStatus,
    inspectedAt: updatedDetail.returnPass?.inspectedAt ?? null,
    redeemedAt: updatedDetail.returnPass?.redeemedAt ?? null,
    productName: updatedDetail.purchase?.productName ?? "Wireless Headphones",
    merchantName: updatedDetail.merchant?.name ?? "Northline Audio",
    branchName:
      updatedDetail.branches.find(
        (b) => b.id === updatedDetail.reservation?.branchId,
      )?.name ?? "Central Branch",
    message: updatedDetail.returnPass?.inspectedAt
      ? `Pass validated. Merchant inspection recorded for Claim #${claim.claimCode}.`
      : "Pass validated. No inspection has been recorded.",
  };
}

export async function recordHandoverDomain(
  input: {
    claimId: string;
    handoverNote?: string | undefined;
    idempotencyKey?: string | undefined;
    demoActorRole?: "buyer" | "merchant" | undefined;
  },
  ctx?: ActionRunContext,
) {
  const { claim: authorized, perms } = await assertClaimAccess(
    input.claimId,
    "merchant",
    ctx,
    input.demoActorRole,
  );
  return await getDb().transaction(async (tx) => {
    const [claim] = await tx
      .select()
      .from(schema.claims)
      .where(eq(schema.claims.id, authorized.id))
      .for("update");
    if (!claim) {
      throw new NoWriteError("Claim no longer exists.", {
        errorCode: "claim_not_found",
        statusCode: 404,
      });
    }
    const [pass] = await tx
      .select()
      .from(schema.returnPasses)
      .where(eq(schema.returnPasses.claimId, claim.id))
      .orderBy(desc(schema.returnPasses.createdAt));
    if (pass?.redeemedAt) {
      return {
        id: claim.id,
        claimId: claim.id,
        status: claim.status,
        message: "Handover was already recorded; stock was not changed again.",
      };
    }
    if (!pass || pass.invalidatedAt || Date.parse(pass.expiresAt) <= Date.now()) {
      throw new NoWriteError("An active return pass is required.", {
        errorCode: "pass_required_for_handover",
        statusCode: 409,
      });
    }
    if (!pass.inspectedAt || claim.status !== "inspection") {
      throw new NoWriteError(
        "Record the merchant inspection before handover.",
        { errorCode: "inspection_required", statusCode: 409 },
      );
    }
    const [reservation] = await tx
      .select()
      .from(schema.reservations)
      .where(eq(schema.reservations.id, pass.reservationId));
    if (!reservation || reservation.status !== "confirmed") {
      throw new NoWriteError("An active reservation is required.", {
        errorCode: "reservation_required",
        statusCode: 409,
      });
    }
    const now = new Date().toISOString();
    if (reservation.inventoryId) {
      const changed = await tx
        .update(schema.inventory)
        .set({
          onHand: sql`${schema.inventory.onHand} - 1`,
          reserved: sql`${schema.inventory.reserved} - 1`,
          updatedAt: now,
        })
        .where(
          and(
            eq(schema.inventory.id, reservation.inventoryId),
            sql`${schema.inventory.onHand} > 0`,
            sql`${schema.inventory.reserved} > 0`,
          ),
        )
        .returning({ id: schema.inventory.id });
      if (!changed.length) {
        throw new NoWriteError(
          "Reserved stock is inconsistent; merchant review is required.",
          { errorCode: "stock_conflict", statusCode: 409 },
        );
      }
    }
    const actorSource = resolveActorSource("merchant", ctx);
    const note =
      input.handoverNote?.trim() || "Merchant recorded physical handover.";
    await tx
      .update(schema.returnPasses)
      .set({ redeemedAt: now, handoverNote: note })
      .where(eq(schema.returnPasses.id, pass.id));
    await tx
      .update(schema.reservations)
      .set({ status: "redeemed" })
      .where(eq(schema.reservations.id, reservation.id));
    await tx
      .update(schema.claims)
      .set({
        status: "fulfilled",
        lastChangedBy:
          actorSource === "merchant_agent" ? "Merchant Agent" : "Merchant",
        lastActionSource: actorSource,
        updatedAt: now,
        version: claim.version + 1,
      })
      .where(eq(schema.claims.id, claim.id));
    await tx.insert(schema.claimMessages).values({
      id: randomUUID(),
      claimId: claim.id,
      senderUserId: perms.user.id,
      senderRole: actorSource,
      body: `Handover recorded: ${note} Awaiting buyer confirmation.`,
      kind: "system",
      sentAt: now,
    });
    await tx.insert(schema.claimEvents).values({
      id: randomUUID(),
      claimId: claim.id,
      actorUserId: perms.user.id,
      actorRole: "merchant",
      actorSource,
      actionType: "record-handover",
      summary: "Merchant recorded physical handover",
      payloadRedactedJson: JSON.stringify({
        passId: pass.id,
        status: "fulfilled",
        handoverNote: note,
      }),
      createdAt: now,
      idempotencyKey: input.idempotencyKey ?? null,
    });
    return {
      id: claim.id,
      claimId: claim.id,
      status: "fulfilled",
      message: "Handover recorded. Waiting for buyer confirmation.",
    };
  });
}

export async function confirmResolutionReceivedDomain(
  input: {
    claimId: string;
    feedbackNote?: string | undefined;
    idempotencyKey?: string | undefined;
    demoActorRole?: "buyer" | "merchant" | undefined;
  },
  ctx?: ActionRunContext,
) {
  const { claim, perms } = await assertClaimAccess(
    input.claimId,
    "buyer",
    ctx,
    input.demoActorRole,
  );
  const db = getDb();
  const now = new Date().toISOString();
  const actorSource = resolveActorSource("buyer", ctx);
  const lastChangedBy =
    actorSource === "buyer_agent" ? "Buyer Agent" : "Buyer";

  if (claim.status === "closed") {
    return {
      id: claim.id,
      claimId: claim.id,
      status: "closed" as const,
      resolvedAt: claim.resolvedAt ?? now,
      replayed: true,
      message: `Claim #${claim.claimCode} is already closed.`,
    };
  }

  const currentStatus = claimStatusMachine.parseState(claim.status);
  if (!claimStatusMachine.can(currentStatus, "confirm_completed")) {
    throw new NoWriteError(
      `Claim #${claim.claimCode} cannot be marked completed from status "${claim.status}".`,
      {
        errorCode: "invalid_completion_transition",
        statusCode: 400,
      },
    );
  }

  const nextStatus = claimStatusMachine.transition(
    currentStatus,
    "confirm_completed",
  );

  await db
    .update(schema.claims)
    .set({
      status: nextStatus,
      resolvedAt: now,
      lastChangedBy,
      lastActionSource: actorSource,
      updatedAt: now,
      version: claim.version + 1,
    })
    .where(eq(schema.claims.id, claim.id));

  await db.insert(schema.claimMessages).values({
    id: randomUUID(),
    claimId: claim.id,
    senderUserId: perms.user.id,
    senderRole: actorSource,
    body: `Buyer confirmed resolution received${input.feedbackNote ? `: "${input.feedbackNote.trim()}"` : ""}. Case #${claim.claimCode} is now closed.`,
    kind: "system",
    sentAt: now,
  });

  await db.insert(schema.claimEvents).values({
    id: randomUUID(),
    claimId: claim.id,
    actorUserId: perms.user.id,
    actorRole: "buyer",
    actorSource,
    actionType: "confirm-resolution-received",
    summary: `${lastChangedBy} confirmed resolution received - Claim #${claim.claimCode} closed`,
    payloadRedactedJson: JSON.stringify({
      status: nextStatus,
      resolvedAt: now,
      feedbackNote: input.feedbackNote?.trim() || null,
    }),
    createdAt: now,
    idempotencyKey: input.idempotencyKey ?? null,
  });

  return {
    id: claim.id,
    claimId: claim.id,
    status: nextStatus,
    resolvedAt: now,
    message: `Buyer confirmed resolution received. Claim #${claim.claimCode} is now closed.`,
  };
}

export async function sendCaseMessageDomain(
  input: {
    claimId: string;
    body: string;
    senderSide?: "buyer" | "merchant" | undefined;
  },
  ctx?: ActionRunContext,
) {
  const { claim, perms, isBuyerOwner, isMerchantMember } =
    await assertClaimAccess(
      input.claimId,
      "either",
      ctx,
      input.senderSide,
    );
  const db = getDb();
  const now = new Date().toISOString();

  const side: "buyer" | "merchant" =
    input.senderSide === "merchant" && isMerchantMember
      ? "merchant"
      : isBuyerOwner
        ? "buyer"
        : "merchant";

  const actorSource = resolveActorSource(side, ctx);
  const msgId = randomUUID();

  await db.insert(schema.claimMessages).values({
    id: msgId,
    claimId: claim.id,
    senderUserId: perms.user.id,
    senderRole: actorSource,
    body: input.body.trim(),
    kind:
      actorSource === "buyer_agent" || actorSource === "merchant_agent"
        ? "agent-draft"
        : "human",
    sentAt: now,
  });

  await db.insert(schema.claimEvents).values({
    id: randomUUID(),
    claimId: claim.id,
    actorUserId: perms.user.id,
    actorRole: side,
    actorSource,
    actionType: "send-case-message",
    summary: `New case message posted in #${claim.claimCode}`,
    payloadRedactedJson: JSON.stringify({
      messageId: msgId,
      senderRole: actorSource,
    }),
    createdAt: now,
  });

  return {
    id: msgId,
    claimId: claim.id,
    sentAt: now,
    message: "Message sent to Shared Resolution Room.",
  };
}

export async function updateMerchantSettingsDomain(
  input: {
    returnDays: number | null;
    warrantyDays: number | null;
    returnRule: string;
    warrantyRule: string;
    branchId?: string | undefined;
    stockOnHand?: number | undefined;
  },
  ctx?: ActionRunContext,
) {
  const perms = await getViewerPermissions(ctx);
  const merchant = perms.memberMerchants[0] ?? (perms.canAccessDemoSwitcher ? perms.demoMerchant : null);
  if (!merchant) throw new NoWriteError("Merchant membership is required to change store settings.", { errorCode: "merchant_membership_required", statusCode: 403 });
  for (const days of [input.returnDays, input.warrantyDays]) {
    if (days !== null && (!Number.isSafeInteger(days) || days < 0)) throw new NoWriteError("Enter valid policy days.", { errorCode: "invalid_policy", statusCode: 400 });
  }
  if (input.stockOnHand !== undefined && (!Number.isSafeInteger(input.stockOnHand) || input.stockOnHand < 0)) throw new NoWriteError("Enter a nonnegative stock count.", { errorCode: "invalid_stock", statusCode: 400 });
  return await getDb().transaction(async (tx) => {
    await tx.select().from(schema.merchantOrganizations).where(eq(schema.merchantOrganizations.id, merchant.id)).for("update");
    let inventoryId: string | null = null;
    if (input.branchId) {
      const [branch] = await tx.select().from(schema.branches).where(and(eq(schema.branches.id, input.branchId), eq(schema.branches.merchantId, merchant.id)));
      if (!branch) throw new NoWriteError("Branch not found in this store.", { errorCode: "invalid_branch", statusCode: 403 });
      if (input.stockOnHand !== undefined) {
        const inventory = await tx.select().from(schema.inventory).where(and(eq(schema.inventory.branchId, branch.id), eq(schema.inventory.merchantId, merchant.id))).for("update");
        if (inventory.length !== 1) throw new NoWriteError("This editor requires one product inventory record at the selected branch.", { errorCode: "inventory_review_required", statusCode: 409 });
        if (input.stockOnHand < inventory[0]!.reserved) throw new NoWriteError("Stock cannot be lower than the reserved count.", { errorCode: "stock_below_reserved", statusCode: 409 });
        inventoryId = inventory[0]!.id;
      }
    } else if (input.stockOnHand !== undefined) throw new NoWriteError("Select a branch before changing stock.", { errorCode: "branch_required", statusCode: 400 });
    const [prior] = await tx.select().from(schema.merchantPolicies).where(eq(schema.merchantPolicies.merchantId, merchant.id)).orderBy(desc(schema.merchantPolicies.version)).limit(1);
    const version = (prior?.version ?? 0) + 1;
    const id = randomUUID();
    const now = new Date().toISOString();
    await tx.insert(schema.merchantPolicies).values({ id, merchantId: merchant.id, version, returnDays: input.returnDays, warrantyDays: input.warrantyDays, conditionsJson: JSON.stringify({ returnRule: input.returnRule.trim(), warrantyRule: input.warrantyRule.trim(), requiresReceipt: true, requiresFaultMedia: true, allowedRemedies: ["inspection", "replacement", "repair", "partial_keep_item_refund", "full_refund_request"], maxPartialKeepRefundPercent: 35 }), effectiveAt: now });
    if (inventoryId && input.stockOnHand !== undefined) await tx.update(schema.inventory).set({ onHand: input.stockOnHand, updatedAt: now }).where(eq(schema.inventory.id, inventoryId));
    return { id, version, message: `Saved Merchant Policy v${version} for ${merchant.name}.` };
  });
}

export async function resetDemoScenarioDomain(
  input: { mode?: "submitted" | "fresh_vault" | undefined },
  ctx?: ActionRunContext,
) {
  const perms = await getViewerPermissions(ctx);
  if (!perms.canAccessDemoSwitcher) throw new NoWriteError("Enter the demo before resetting its scenario.", { errorCode: "demo_access_required", statusCode: 403 });
  const mode = input.mode ?? "submitted";
  await seedDemoScenarioInternal(mode, perms.email);
  return {
    id: DEMO_IDS.claimHeadphones,
    mode,
    claimId: mode === "submitted" ? DEMO_IDS.claimHeadphones : null,
    purchaseId: DEMO_IDS.purchaseHeadphones,
    message:
      mode === "submitted"
        ? "Reset demo: RT-1042 has a stored replacement offer awaiting buyer approval."
        : "Reset demo scenario: Maya's Purchase Vault is ready with Wireless Headphones (no active claim yet).",
  };
}
