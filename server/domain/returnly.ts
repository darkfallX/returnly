import { formatAppointmentWindow } from "../../shared/appointment-time.ts";
import { createHash, randomUUID } from "node:crypto";
import {
  type ActionRunContext,
  fail,
  NoWriteError,
} from "@agent-native/core/action";
import { getDbExec, withMigrationExecutionRuntime } from "@agent-native/core/db";
import { getRequestUserEmail } from "@agent-native/core/server";
import { and, eq, inArray, notInArray, or } from "drizzle-orm";

import { getDb, schema } from "../db/index.ts";
import {
  RETURNLY_INITIAL_DDL,
  RETURNLY_UNKNOWN_FACTS_DDL,
  RETURNLY_V3_UPGRADE_DDL,
} from "../plugins/db.ts";

export const DEMO_IDS = {
  buyerUser: "11111111-1111-4111-8111-111111111100",
  merchantOrg: "11111111-1111-4111-8111-111111111101",
  policy: "11111111-1111-4111-8111-111111111102",
  centralBranch: "11111111-1111-4111-8111-111111111103",
  eastBranch: "11111111-1111-4111-8111-111111111104",
  slotCentralMorning: "11111111-1111-4111-8111-111111111105",
  slotCentralPickup: "11111111-1111-4111-8111-111111111106",
  slotEastMorning: "11111111-1111-4111-8111-111111111107",
  purchaseHeadphones: "11111111-1111-4111-8111-111111111108",
  purchaseKettle: "11111111-1111-4111-8111-111111111109",
  claimHeadphones: "11111111-1111-4111-8111-111111111110",
  invCentralHeadphones: "11111111-1111-4111-8111-111111111111",
  invEastHeadphones: "11111111-1111-4111-8111-111111111112",
  receiptAttachment: "11111111-1111-4111-8111-111111111113",
  photoAttachment: "11111111-1111-4111-8111-111111111114",
  merchantUser: "11111111-1111-4111-8111-111111111115",
  outsiderUser: "11111111-1111-4111-8111-111111111116",
  offerHeadphones: "11111111-1111-4111-8111-111111111117",
  triageHeadphones: "11111111-1111-4111-8111-111111111118",
} as const;

export const DEMO_BUYER_EMAIL = "maya.demo@returnly.local";
export const DEMO_MERCHANT_EMAIL = "resolve@northline-demo.local";
export const DEMO_OUTSIDER_EMAIL = "alex.outsider@returnly.local";

let schemaInitialized = false;
let schemaInitPromise: Promise<void> | null = null;
let demoSeedCompleted = false;
let demoSeedPromise: Promise<void> | null = null;

export function resetReturnlySchemaCacheForTests(options?: { forceDdl?: boolean }): void {
  schemaInitialized = false;
  schemaInitPromise = null;
  forceDdlOnNextEnsure = Boolean(options?.forceDdl);
}

let forceDdlOnNextEnsure = false;

export async function ensureReturnlySchema(): Promise<void> {
  if (schemaInitialized) return;
  if (schemaInitPromise) return schemaInitPromise;
  schemaInitPromise = withMigrationExecutionRuntime(async () => {
    const exec = getDbExec();
    const skipProbe = forceDdlOnNextEnsure;
    forceDdlOnNextEnsure = false;
    if (!skipProbe) {
      try {
        // raw-sql-ok: fast probe to skip 24 DDL round-trips when tables already exist
        await exec.execute("SELECT 1 FROM pending_approvals LIMIT 1");
        schemaInitialized = true;
        return;
      } catch {
        // Tables not yet initialized; run idempotent DDL bootstrap below
      }
    }
    const statements = `${RETURNLY_INITIAL_DDL}\n${RETURNLY_UNKNOWN_FACTS_DDL}\n${RETURNLY_V3_UPGRADE_DDL}`
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of statements) {
      // raw-sql-ok: idempotent schema bootstrap for CLI/test/dev runs before Nitro plugin
      await exec.execute(stmt);
    }
    schemaInitialized = true;
  }).catch((err) => {
    schemaInitPromise = null;
    throw err;
  });
  return schemaInitPromise;
}

export function resolveCallerEmail(ctx?: ActionRunContext): string {
  const fromCtx = ctx?.userEmail?.trim().toLowerCase();
  if (fromCtx) {
    return fromCtx;
  }
  try {
    const fromReq = getRequestUserEmail()?.trim().toLowerCase();
    if (fromReq) return fromReq;
  } catch {
    // Outside request context (CLI or unit test)
  }
  throw new NoWriteError("Sign in to continue.", {
    errorCode: "authentication_required",
    statusCode: 401,
  });
}

export function resolveActorSource(
  role: "buyer" | "merchant",
  ctx?: ActionRunContext,
  explicitSource?: string,
): "buyer_ui" | "buyer_agent" | "merchant_ui" | "merchant_agent" | "system" {
  if (
    explicitSource === "buyer_ui" ||
    explicitSource === "buyer_agent" ||
    explicitSource === "merchant_ui" ||
    explicitSource === "merchant_agent" ||
    explicitSource === "system"
  ) {
    return explicitSource;
  }
  const isAgentCaller =
    ctx?.caller === "tool" ||
    ctx?.caller === "mcp" ||
    ctx?.caller === "webmcp" ||
    ctx?.caller === "a2a" ||
    ctx?.caller === "cli";
  if (role === "buyer") {
    return isAgentCaller ? "buyer_agent" : "buyer_ui";
  }
  return isAgentCaller ? "merchant_agent" : "merchant_ui";
}

export function computePartialRefundMinor(
  purchaseAmountMinor: number,
  percent: number,
): number {
  if (!Number.isFinite(purchaseAmountMinor) || purchaseAmountMinor < 0) {
    fail("Invalid purchase amount in minor units.", {
      errorCode: "invalid_amount",
      statusCode: 400,
    });
  }
  if (!Number.isFinite(percent) || percent < 1 || percent > 100) {
    fail("Refund percentage must be between 1 and 100.", {
      errorCode: "invalid_refund_percent",
      statusCode: 400,
    });
  }
  return Math.round((purchaseAmountMinor * percent) / 100);
}

export function hashPassToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function buildFutureSlotWindows(now = new Date()) {
  const tomorrowMorningStart = new Date(now.getTime() + 24 * 3600_000);
  tomorrowMorningStart.setUTCHours(9, 0, 0, 0);
  const tomorrowMorningEnd = new Date(
    tomorrowMorningStart.getTime() + 90 * 60_000,
  );
  const tomorrowAfternoonStart = new Date(
    tomorrowMorningStart.getTime() + 4 * 3600_000,
  );
  const tomorrowAfternoonEnd = new Date(
    tomorrowAfternoonStart.getTime() + 90 * 60_000,
  );
  const twoDaysOutStart = new Date(
    tomorrowMorningStart.getTime() + 24 * 3600_000 + 3600_000,
  );
  const twoDaysOutEnd = new Date(twoDaysOutStart.getTime() + 90 * 60_000);

  return {
    tomorrowMorningStart,
    tomorrowMorningEnd,
    tomorrowAfternoonStart,
    tomorrowAfternoonEnd,
    twoDaysOutStart,
    twoDaysOutEnd,
    labelMorning: formatAppointmentWindow({ startAt: tomorrowMorningStart.toISOString(), endAt: tomorrowMorningEnd.toISOString() }),
    labelPickup: formatAppointmentWindow({ startAt: tomorrowAfternoonStart.toISOString(), endAt: tomorrowAfternoonEnd.toISOString() }),
    labelEast: formatAppointmentWindow({ startAt: twoDaysOutStart.toISOString(), endAt: twoDaysOutEnd.toISOString() }),
  };
}

export async function refreshStaleDemoSlots(): Promise<void> {
  const db = getDb();
  const demoSlots = await db
    .select()
    .from(schema.slots)
    .where(eq(schema.slots.merchantId, DEMO_IDS.merchantOrg));
  if (demoSlots.length === 0) return;

  const earliest = Math.min(...demoSlots.map((s) => Date.parse(s.startAt)));
  if (Number.isFinite(earliest) && earliest > Date.now() + 2 * 3600_000) {
    return;
  }

  const committed = await db.select({ slotId: schema.resolutionOffers.slotId }).from(schema.resolutionOffers).innerJoin(schema.claims, eq(schema.claims.id, schema.resolutionOffers.claimId)).where(and(eq(schema.claims.merchantId, DEMO_IDS.merchantOrg), eq(schema.resolutionOffers.state, "accepted")));
  const protectedIds = new Set(committed.map((offer) => offer.slotId));
  const w = buildFutureSlotWindows(new Date());
  const updates = [
    { id: DEMO_IDS.slotCentralMorning, startAt: w.tomorrowMorningStart.toISOString(), endAt: w.tomorrowMorningEnd.toISOString(), label: w.labelMorning },
    { id: DEMO_IDS.slotCentralPickup, startAt: w.tomorrowAfternoonStart.toISOString(), endAt: w.tomorrowAfternoonEnd.toISOString(), label: w.labelPickup },
    { id: DEMO_IDS.slotEastMorning, startAt: w.twoDaysOutStart.toISOString(), endAt: w.twoDaysOutEnd.toISOString(), label: w.labelEast },
  ];
  await Promise.all(updates.filter((slot) => !protectedIds.has(slot.id)).map(({ id, ...values }) => db.update(schema.slots).set(values).where(and(eq(schema.slots.id, id), eq(schema.slots.reservedCount, 0)))));

}

export async function ensureSeededDemoData(callerEmail?: string): Promise<void> {
  await ensureReturnlySchema();
  if (!demoSeedCompleted) {
    if (!demoSeedPromise) {
      demoSeedPromise = (async () => {
        const db = getDb();
        const existingMerchant = await db
          .select()
          .from(schema.merchantOrganizations)
          .where(eq(schema.merchantOrganizations.id, DEMO_IDS.merchantOrg))
          .limit(1);

        if (existingMerchant.length === 0) {
          await seedDemoScenarioInternal("submitted", callerEmail);
        } else {
          await refreshStaleDemoSlots();
        }
        demoSeedCompleted = true;
      })().finally(() => {
        demoSeedPromise = null;
      });
    }
    await demoSeedPromise;
  }
  if (callerEmail) {
    await ensureCallerUserRecord(callerEmail);
  }
}

export async function ensureCallerUserRecord(email: string) {
  const normalized = email.trim().toLowerCase();
  const db = getDb();
  const existing = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.ownerEmail, normalized))
    .limit(1);

  if (existing[0]) return existing[0];

  const isMaya = normalized === DEMO_BUYER_EMAIL;
  const isMerchant = normalized === DEMO_MERCHANT_EMAIL;
  const isOutsider = normalized === DEMO_OUTSIDER_EMAIL;
  const userId = isMaya
    ? DEMO_IDS.buyerUser
    : isMerchant
      ? DEMO_IDS.merchantUser
      : isOutsider
        ? DEMO_IDS.outsiderUser
        : randomUUID();
  const displayName = isMaya
    ? "Maya Lin"
    : isMerchant
      ? "Northline Support"
      : isOutsider
        ? "Alex Rivera"
        : normalized.split("@")[0]?.replace(/[._-]/g, " ") || "Maya Lin";

  const created = {
    id: userId,
    ownerEmail: normalized,
    displayName,
    preferredRole: isMerchant ? "merchant" : "buyer",
    preferredCurrency: "NGN",
    notificationsOptIn: true,
    onboardingCompleted: isMerchant || isOutsider,
    demoMode: isMaya || isMerchant,
    createdAt: new Date().toISOString(),
  };

  await db
    .insert(schema.users)
    .values(created)
    .onConflictDoNothing();

  const reloaded = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.ownerEmail, normalized))
    .limit(1);
  return reloaded[0] ?? created;
}

export async function seedDemoScenarioInternal(
  mode: "submitted" | "fresh_vault" = "submitted",
  callerEmail?: string,
) {
  await ensureReturnlySchema();
  const db = getDb();
  const [otherReservation] = await db.select({ id: schema.reservations.id }).from(schema.reservations).innerJoin(schema.claims, eq(schema.claims.id, schema.reservations.claimId)).where(and(eq(schema.claims.merchantId, DEMO_IDS.merchantOrg), notInArray(schema.claims.purchaseId, [DEMO_IDS.purchaseHeadphones, DEMO_IDS.purchaseKettle]), eq(schema.reservations.status, "confirmed"))).limit(1);
  if (otherReservation) throw new NoWriteError("Other cases have active reservations at this demo store. Finish or cancel them before resetting the fixtures.", { errorCode: "demo_has_active_cases", statusCode: 409 });
  const now = new Date();
  const fiveDaysAgo = new Date(now.getTime() - 5 * 86_400_000).toISOString();
  const eighteenDaysAgo = new Date(
    now.getTime() - 18 * 86_400_000,
  ).toISOString();
  const w = buildFutureSlotWindows(now);

  // Clean existing demo records in reverse dependency order
  const demoClaims = await db
    .select({ id: schema.claims.id })
    .from(schema.claims)
    .where(
      inArray(schema.claims.purchaseId, [DEMO_IDS.purchaseHeadphones, DEMO_IDS.purchaseKettle]),
    );
  const demoClaimIds = demoClaims.map((c) => c.id);
  if (demoClaimIds.length > 0) {
    await db
      .delete(schema.pendingApprovals)
      .where(inArray(schema.pendingApprovals.claimId, demoClaimIds));
    await db
      .delete(schema.returnPasses)
      .where(inArray(schema.returnPasses.claimId, demoClaimIds));
    await db
      .delete(schema.reservations)
      .where(inArray(schema.reservations.claimId, demoClaimIds));
    await db
      .delete(schema.resolutionOffers)
      .where(inArray(schema.resolutionOffers.claimId, demoClaimIds));
    await db
      .delete(schema.claimMessages)
      .where(inArray(schema.claimMessages.claimId, demoClaimIds));
    await db
      .delete(schema.triageResults)
      .where(inArray(schema.triageResults.claimId, demoClaimIds));
    await db
      .delete(schema.claimEvidence)
      .where(inArray(schema.claimEvidence.claimId, demoClaimIds));
    await db
      .delete(schema.claimEvents)
      .where(inArray(schema.claimEvents.claimId, demoClaimIds));
    await db
      .delete(schema.claims)
      .where(inArray(schema.claims.id, demoClaimIds));
  }

  await db
    .delete(schema.attachments)
    .where(
      inArray(schema.attachments.id, [
        DEMO_IDS.receiptAttachment,
        DEMO_IDS.photoAttachment,
      ]),
    );
  await db
    .delete(schema.purchases)
    .where(
      inArray(schema.purchases.id, [
        DEMO_IDS.purchaseHeadphones,
        DEMO_IDS.purchaseKettle,
      ]),
    );
  await db
    .delete(schema.slots)
    .where(eq(schema.slots.merchantId, DEMO_IDS.merchantOrg));
  await db
    .delete(schema.inventory)
    .where(eq(schema.inventory.merchantId, DEMO_IDS.merchantOrg));
  await db
    .delete(schema.branches)
    .where(eq(schema.branches.merchantId, DEMO_IDS.merchantOrg));
  await db
    .delete(schema.merchantPolicies)
    .where(eq(schema.merchantPolicies.merchantId, DEMO_IDS.merchantOrg));
  await db
    .delete(schema.merchantMemberships)
    .where(eq(schema.merchantMemberships.merchantId, DEMO_IDS.merchantOrg));
  await db
    .delete(schema.merchantOrganizations)
    .where(eq(schema.merchantOrganizations.id, DEMO_IDS.merchantOrg));

  // Ensure demo buyer, merchant, and isolated outsider users
  await db
    .insert(schema.users)
    .values([
      {
        id: DEMO_IDS.buyerUser,
        ownerEmail: DEMO_BUYER_EMAIL,
        displayName: "Maya Lin",
        preferredRole: "buyer",
        preferredCurrency: "NGN",
        notificationsOptIn: true,
        onboardingCompleted: false,
        demoMode: true,
        createdAt: now.toISOString(),
      },
      {
        id: DEMO_IDS.merchantUser,
        ownerEmail: DEMO_MERCHANT_EMAIL,
        displayName: "Northline Support",
        preferredRole: "merchant",
        preferredCurrency: "NGN",
        notificationsOptIn: true,
        onboardingCompleted: true,
        demoMode: true,
        createdAt: now.toISOString(),
      },
      {
        id: DEMO_IDS.outsiderUser,
        ownerEmail: DEMO_OUTSIDER_EMAIL,
        displayName: "Alex Rivera",
        preferredRole: "buyer",
        preferredCurrency: "NGN",
        notificationsOptIn: true,
        onboardingCompleted: true,
        demoMode: false,
        createdAt: now.toISOString(),
      },
    ])
    .onConflictDoNothing();

  const normalizedCaller = callerEmail?.trim().toLowerCase();
  const activeBuyerEmail =
    normalizedCaller &&
    normalizedCaller !== DEMO_MERCHANT_EMAIL &&
    normalizedCaller !== DEMO_OUTSIDER_EMAIL
      ? normalizedCaller
      : DEMO_BUYER_EMAIL;
  const callerUser = await ensureCallerUserRecord(activeBuyerEmail);

  // Insert Demo Merchant Organization: Northline Audio (DEMO)
  await db.insert(schema.merchantOrganizations).values({
    id: DEMO_IDS.merchantOrg,
    ownerEmail: DEMO_MERCHANT_EMAIL,
    name: "Northline Audio",
    category: "Consumer Audio & Electronics",
    supportContact: DEMO_MERCHANT_EMAIL,
    demoFlag: true,
    createdAt: now.toISOString(),
  });

  // Explicitly bind Northline Support (DEMO_MERCHANT_EMAIL) as owner of Northline Audio
  await db
    .insert(schema.merchantMemberships)
    .values({
      id: "11111111-1111-4111-8111-111111111117",
      memberUserId: DEMO_IDS.merchantUser,
      ownerEmail: DEMO_MERCHANT_EMAIL,
      merchantId: DEMO_IDS.merchantOrg,
      role: "owner",
      createdAt: now.toISOString(),
    })
    .onConflictDoNothing();

  // Ensure demo merchant policy
  await db.insert(schema.merchantPolicies).values({
    id: DEMO_IDS.policy,
    merchantId: DEMO_IDS.merchantOrg,
    version: 1,
    returnDays: 14,
    warrantyDays: 365,
    conditionsJson: JSON.stringify({
      returnRule:
        "14-day return or branch replacement after inspection for verified hardware or acoustic faults with store receipt.",
      warrantyRule:
        "365-day acoustic driver & battery coverage. Inspection required before replacement or partial keep-item settlement.",
      requiresReceipt: true,
      requiresFaultMedia: true,
      requiresVideoForAudioFaults: true,
      allowedRemedies: [
        "inspection",
        "replacement",
        "repair",
        "partial_keep_item_refund",
        "full_refund_request",
      ],
      maxPartialKeepRefundPercent: 35,
    }),
    effectiveAt: new Date(now.getTime() - 90 * 86_400_000).toISOString(),
  });

  // Branches: Central Branch & East Branch
  await db.insert(schema.branches).values([
    {
      id: DEMO_IDS.centralBranch,
      merchantId: DEMO_IDS.merchantOrg,
      name: "Central Branch",
      addressText: "14 Admiralty Way, Lekki Phase 1, Lagos (DEMO)",
      city: "Lagos",
      latitude: 6.4474,
      longitude: 3.4723,
      servicesJson: JSON.stringify([
        "Acoustic bench inspection",
        "Replacement check-in",
        "Pickup appointment",
        "QR check-in",
      ]),
      verifiedAt: now.toISOString(),
    },
    {
      id: DEMO_IDS.eastBranch,
      merchantId: DEMO_IDS.merchantOrg,
      name: "East Branch",
      addressText: "28 Isaac John Street, Ikeja GRA, Lagos (DEMO)",
      city: "Lagos",
      latitude: 6.5765,
      longitude: 3.3581,
      servicesJson: JSON.stringify([
        "Acoustic bench inspection",
        "In-branch unit swap",
        "Warranty repair drop-off",
      ]),
      verifiedAt: now.toISOString(),
    },
  ]);

  // Inventory: 4 replacement units at Central Branch, 1 at East Branch
  await db.insert(schema.inventory).values([
    {
      id: DEMO_IDS.invCentralHeadphones,
      merchantId: DEMO_IDS.merchantOrg,
      branchId: DEMO_IDS.centralBranch,
      productSku: "NLA-WH-1000",
      productName: "Wireless Headphones",
      onHand: 4,
      reserved: 0,
      updatedAt: now.toISOString(),
    },
    {
      id: DEMO_IDS.invEastHeadphones,
      merchantId: DEMO_IDS.merchantOrg,
      branchId: DEMO_IDS.eastBranch,
      productSku: "NLA-WH-1000",
      productName: "Wireless Headphones",
      onHand: 1,
      reserved: 0,
      updatedAt: now.toISOString(),
    },
  ]);

  // Appointment slots with dynamic future windows
  await db.insert(schema.slots).values([
    {
      id: DEMO_IDS.slotCentralMorning,
      merchantId: DEMO_IDS.merchantOrg,
      branchId: DEMO_IDS.centralBranch,
      startAt: w.tomorrowMorningStart.toISOString(),
      endAt: w.tomorrowMorningEnd.toISOString(),
      label: w.labelMorning,
      capacity: 3,
      reservedCount: 0,
      serviceType: "drop_off",
    },
    {
      id: DEMO_IDS.slotCentralPickup,
      merchantId: DEMO_IDS.merchantOrg,
      branchId: DEMO_IDS.centralBranch,
      startAt: w.tomorrowAfternoonStart.toISOString(),
      endAt: w.tomorrowAfternoonEnd.toISOString(),
      label: w.labelPickup,
      capacity: 2,
      reservedCount: 0,
      serviceType: "pickup",
    },
    {
      id: DEMO_IDS.slotEastMorning,
      merchantId: DEMO_IDS.merchantOrg,
      branchId: DEMO_IDS.eastBranch,
      startAt: w.twoDaysOutStart.toISOString(),
      endAt: w.twoDaysOutEnd.toISOString(),
      label: w.labelEast,
      capacity: 2,
      reservedCount: 0,
      serviceType: "drop_off",
    },
  ]);

  // Attachments (Receipt & Photo fixture)
  await db.insert(schema.attachments).values([
    {
      id: DEMO_IDS.receiptAttachment,
      ownerUserId: callerUser.id,
      ownerEmail: activeBuyerEmail,
      caseId: mode === "submitted" ? DEMO_IDS.claimHeadphones : null,
      purchaseId: DEMO_IDS.purchaseHeadphones,
      storageKey: "fixture://northline-receipt-88412.pdf",
      fileName: "northline-receipt-88412.pdf",
      mimeType: "application/pdf",
      size: 148_200,
      purpose: "receipt",
      disclosedToMerchant: mode === "submitted",
      uploadedAt: fiveDaysAgo,
    },
    {
      id: DEMO_IDS.photoAttachment,
      ownerUserId: callerUser.id,
      ownerEmail: activeBuyerEmail,
      caseId: mode === "submitted" ? DEMO_IDS.claimHeadphones : null,
      purchaseId: DEMO_IDS.purchaseHeadphones,
      storageKey: "fixture://left-earcup-fault-photo.jpg",
      fileName: "left-earcup-fault-photo.jpg",
      mimeType: "image/jpeg",
      size: 312_400,
      purpose: "defect_photo",
      disclosedToMerchant: mode === "submitted",
      uploadedAt: now.toISOString(),
    },
  ]);

  // Purchases in Vault
  await db.insert(schema.purchases).values([
    {
      id: DEMO_IDS.purchaseHeadphones,
      buyerUserId: callerUser.id,
      ownerEmail: activeBuyerEmail,
      merchantId: DEMO_IDS.merchantOrg,
      merchantName: "Northline Audio",
      branchId: DEMO_IDS.centralBranch,
      productName: "Wireless Headphones",
      category: "Personal Audio",
      sku: "NLA-WH-1000",
      serial: null, // Not on receipt - honest unknown state
      orderNumber: "ORD-NL-88412",
      amountMinor: 4_500_000, // ₦45,000.00
      currencyCode: "NGN",
      purchasedAt: fiveDaysAgo,
      sourceType: "demo_seed",
      receiptId: DEMO_IDS.receiptAttachment,
      verificationStatus: "merchant_verified",
      confidenceJson: JSON.stringify({
        merchantName: 99,
        productName: 98,
        amountMinor: 99,
        purchasedAt: 97,
        serial: 0,
      }),
      createdAt: fiveDaysAgo,
    },
    {
      id: DEMO_IDS.purchaseKettle,
      buyerUserId: callerUser.id,
      ownerEmail: activeBuyerEmail,
      merchantId: null, // Unlinked merchant to demonstrate honest 'Check with merchant' unknown policy state
      merchantName: "Kava Home Goods",
      branchId: null,
      productName: "Pour-Over Kettle Pro",
      category: "Kitchen & Barista",
      sku: "KTL-PO-204",
      serial: "SN-KTL-9920",
      orderNumber: "ORD-KV-3019",
      amountMinor: 2_850_000, // ₦28,500.00
      currencyCode: "NGN",
      purchasedAt: eighteenDaysAgo,
      sourceType: "demo_seed",
      receiptId: null,
      verificationStatus: "user_confirmed",
      confidenceJson: JSON.stringify({
        merchantName: 100,
        productName: 100,
        amountMinor: 100,
        purchasedAt: 100,
        serial: 100,
      }),
      createdAt: eighteenDaysAgo,
    },
  ]);

  if (mode === "submitted") {
    await db.insert(schema.claims).values({
      id: DEMO_IDS.claimHeadphones,
      claimCode: "RT-1042",
      purchaseId: DEMO_IDS.purchaseHeadphones,
      buyerUserId: callerUser.id,
      ownerEmail: activeBuyerEmail,
      merchantId: DEMO_IDS.merchantOrg,
      status: "offer_pending",
      issueTitle: "Left speaker stopped working",
      issueDescription:
        "Left speaker stopped working after 4 days of normal indoor listening. Right channel and Bluetooth pairing work normally.",
      preferredResolution: "replacement",
      preferredLogistics: "pickup",
      preferredBranchId: DEMO_IDS.centralBranch,
      preferredSlotId: DEMO_IDS.slotCentralPickup,
      policyVersionId: DEMO_IDS.policy,
      lastChangedBy: "Northline Audio",
      lastActionSource: "merchant_ui",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      version: 1,
    });

    await db.insert(schema.resolutionOffers).values({
      id: DEMO_IDS.offerHeadphones,
      claimId: DEMO_IDS.claimHeadphones,
      createdByRole: "merchant",
      remedyType: "replacement",
      logisticsType: "drop_off",
      refundMinor: null,
      refundPercent: null,
      currency: "NGN",
      branchId: DEMO_IDS.centralBranch,
      slotId: DEMO_IDS.slotCentralMorning,
      note: "Northline Audio verified stock and proposed in-store replacement at Central Branch.",
      conditionsJson: JSON.stringify({
        terms: "Like-for-like replacement under warranty",
      }),
      state: "offered",
      version: 1,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 7 * 86_400_000).toISOString(),
    });

    await db.insert(schema.triageResults).values({
      id: DEMO_IDS.triageHeadphones,
      claimId: DEMO_IDS.claimHeadphones,
      actorType: "merchant_ui",
      policyMatch: "uncertain",
      daysSincePurchase: 5,
      missingItemsJson: JSON.stringify(["Issue recording or merchant inspection required"]),
      stockSnapshotJson: JSON.stringify([
        {
          branchId: DEMO_IDS.centralBranch,
          branchName: "Central Branch",
          onHand: 4,
          reserved: 0,
          available: 4,
        },
        {
          branchId: DEMO_IDS.eastBranch,
          branchName: "East Branch",
          onHand: 1,
          reserved: 0,
          available: 1,
        },
      ]),
      recommendedRemediesJson: JSON.stringify(["replacement"]),
      reasoningSummary:
        "Demo setup: stored coverage and stock support a replacement proposal. Issue recording or merchant inspection is still required; no media analysis has run.",
      sourceRefsJson: JSON.stringify(["Stored merchant policy v1: returns 14 days; warranty 365 days"]),
      createdAt: new Date(now.getTime() - 30_000).toISOString(),
    });

    await db.insert(schema.claimEvidence).values([
      {
        id: randomUUID(),
        claimId: DEMO_IDS.claimHeadphones,
        attachmentId: DEMO_IDS.receiptAttachment,
        submittedBy: "buyer",
        label: "Demo receipt fixture #ORD-NL-88412",
        mediaKind: "receipt",
        isVerified: false,
        confidence: 0,
        note: "Demo setup: example receipt disclosure. No real document was analyzed.",
        createdAt: now.toISOString(),
      },
      {
        id: randomUUID(),
        claimId: DEMO_IDS.claimHeadphones,
        attachmentId: DEMO_IDS.photoAttachment,
        submittedBy: "buyer",
        label: "Demo product photo fixture",
        mediaKind: "photo",
        isVerified: false,
        confidence: 0,
        note: "Demo setup: illustrative photo disclosure. No real photo was analyzed.",
        createdAt: now.toISOString(),
      },
    ]);

    await db.insert(schema.claimMessages).values([
      {
        id: randomUUID(),
        claimId: DEMO_IDS.claimHeadphones,
        senderUserId: callerUser.id,
        senderRole: "buyer",
        body: "Demo setup: Wireless Headphones claim with example receipt and photo references. Replacement requested; inspection is still required.",
        kind: "system",
        sentAt: new Date(now.getTime() - 60_000).toISOString(),
      },
      {
        id: randomUUID(),
        claimId: DEMO_IDS.claimHeadphones,
        senderUserId: DEMO_IDS.merchantUser,
        senderRole: "merchant",
        body: "Demo setup: the store proposes a Central Branch replacement, subject to inspection. Accept or suggest another appointment.",
        kind: "human",
        sentAt: now.toISOString(),
      },
    ]);

    await db.insert(schema.claimEvents).values([
      {
        id: randomUUID(),
        claimId: DEMO_IDS.claimHeadphones,
        actorUserId: callerUser.id,
        actorRole: "buyer",
        actorSource: "buyer_ui",
        actionType: "demo-seed:stage-claim-packet",
        summary: "Buyer Agent staged Return Passport for Wireless Headphones",
        payloadRedactedJson: JSON.stringify({
          claimCode: "RT-1042",
          preferredResolution: "replacement",
          preferredLogistics: "pickup",
          serialStatus: "not_provided",
        }),
        createdAt: new Date(now.getTime() - 120_000).toISOString(),
      },
      {
        id: randomUUID(),
        claimId: DEMO_IDS.claimHeadphones,
        actorUserId: callerUser.id,
        actorRole: "buyer",
        actorSource: "buyer_ui",
        actionType: "demo-seed:submit-claim",
        summary:
          "Buyer Maya approved and dispatched claim #RT-1042 to Northline Audio",
        payloadRedactedJson: JSON.stringify({
          claimCode: "RT-1042",
          merchantName: "Northline Audio",
          status: "submitted",
        }),
        createdAt: new Date(now.getTime() - 60_000).toISOString(),
        idempotencyKey: "seed-submit-rt-1042",
      },
      {
        id: randomUUID(),
        claimId: DEMO_IDS.claimHeadphones,
        actorUserId: DEMO_IDS.merchantUser,
        actorRole: "merchant",
        actorSource: "merchant_ui",
        actionType: "demo-seed:triage-merchant-claim",
        summary: "Merchant Agent verified stored policy and Central Branch stock",
        payloadRedactedJson: JSON.stringify({
          policyMatch: "uncertain",
          stockAvailable: 4,
        }),
        createdAt: new Date(now.getTime() - 30_000).toISOString(),
        idempotencyKey: "seed-triage-rt-1042",
      },
      {
        id: randomUUID(),
        claimId: DEMO_IDS.claimHeadphones,
        actorUserId: DEMO_IDS.merchantUser,
        actorRole: "merchant",
        actorSource: "merchant_ui",
        actionType: "demo-seed:propose-resolution",
        summary: "Northline Audio proposed in-store replacement at Central Branch",
        payloadRedactedJson: JSON.stringify({
          offerId: DEMO_IDS.offerHeadphones,
          remedyType: "replacement",
        }),
        createdAt: now.toISOString(),
        idempotencyKey: "seed-offer-rt-1042",
      },
    ]);
  }
  demoSeedCompleted = true;
}

export async function getViewerPermissions(ctx?: ActionRunContext) {
  const email = resolveCallerEmail(ctx);
  await ensureSeededDemoData(email);
  const db = getDb();

  const user = await ensureCallerUserRecord(email);
  const memberships = await db
    .select()
    .from(schema.merchantMemberships)
    .where(eq(schema.merchantMemberships.ownerEmail, email));

  const merchantIds = memberships.map((m) => m.merchantId);
  let memberMerchants: (typeof schema.merchantOrganizations.$inferSelect)[] =
    [];
  if (merchantIds.length > 0) {
    memberMerchants = await db
      .select()
      .from(schema.merchantOrganizations)
      .where(inArray(schema.merchantOrganizations.id, merchantIds));
  }

  const demoMerchants = await db
    .select()
    .from(schema.merchantOrganizations)
    .where(eq(schema.merchantOrganizations.demoFlag, true));

  const hasRealMerchantMembership = memberMerchants.some((m) => !m.demoFlag);

  return {
    email,
    user,
    memberships,
    memberMerchants,
    demoMerchant: demoMerchants[0] ?? null,
    hasRealMerchantMembership,
    canAccessDemoSwitcher: Boolean(
      user.demoMode ||
        email === DEMO_BUYER_EMAIL ||
        email === DEMO_MERCHANT_EMAIL,
    ),
  };
}

export async function assertClaimAccess(
  claimId: string,
  requiredSide: "buyer" | "merchant" | "either",
  ctx?: ActionRunContext,
  demoActorRole?: "buyer" | "merchant",
) {
  const perms = await getViewerPermissions(ctx);
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.claims)
    .where(eq(schema.claims.id, claimId))
    .limit(1);

  const claim = rows[0];
  if (!claim) {
    throw new NoWriteError(`Claim ${claimId} was not found.`, {
      errorCode: "claim_not_found",
      statusCode: 404,
    });
  }

  const merchantRows = await db
    .select()
    .from(schema.merchantOrganizations)
    .where(eq(schema.merchantOrganizations.id, claim.merchantId))
    .limit(1);
  const merchant = merchantRows[0] ?? null;

  const [purchase] = await db
    .select()
    .from(schema.purchases)
    .where(eq(schema.purchases.id, claim.purchaseId));
  const isSeededDemo = Boolean(
    merchant?.demoFlag && purchase?.sourceType === "demo_seed",
  );

  // Strict account isolation:
  // - Buyer owner is the ownerEmail of the claim (or demo participant explicitly acting in Split Demo buyer pane)
  // - Merchant member is an explicit member of the merchant org (e.g. resolve@northline-demo.local)
  //   (or demo participant explicitly acting in Split Demo merchant pane)
  const isBuyerOwner =
    demoActorRole !== "merchant" && (claim.ownerEmail.toLowerCase() === perms.email.toLowerCase() ||
    Boolean(
      isSeededDemo &&
        perms.canAccessDemoSwitcher &&
        demoActorRole === "buyer",
    ));

  const isMerchantMember =
    demoActorRole !== "buyer" && (perms.memberships.some((m) => m.merchantId === claim.merchantId) ||
    Boolean(
      isSeededDemo &&
        perms.canAccessDemoSwitcher &&
        demoActorRole === "merchant",
    ));

  if (claim.status === "draft" && !isBuyerOwner) {
    throw new NoWriteError(
      "You do not have permission to view this draft before buyer approval.",
      { errorCode: "private_draft", statusCode: 403 },
    );
  }

  if (requiredSide === "buyer" && !isBuyerOwner) {
    throw new NoWriteError(
      "You do not have buyer permission for this claim.",
      {
        errorCode: "forbidden_buyer_access",
        statusCode: 403,
      },
    );
  }

  if (requiredSide === "merchant" && !isMerchantMember) {
    throw new NoWriteError(
      "You do not have merchant staff permission for this store's claims.",
      {
        errorCode: "forbidden_merchant_access",
        statusCode: 403,
      },
    );
  }

  if (requiredSide === "either" && !isBuyerOwner && !isMerchantMember) {
    throw new NoWriteError(
      "You do not have permission to view or modify this claim.",
      {
        errorCode: "forbidden_claim_access",
        statusCode: 403,
      },
    );
  }

  return { claim, merchant, perms, isBuyerOwner, isMerchantMember };
}

export function computePolicyCoverage(
  purchasedAtIso: string,
  policy: typeof schema.merchantPolicies.$inferSelect | null,
) {
  const purchasedAtMs = Date.parse(purchasedAtIso);
  const nowMs = Date.now();
  const daysSincePurchase = Number.isFinite(purchasedAtMs)
    ? Math.max(0, Math.floor((nowMs - purchasedAtMs) / 86_400_000))
    : null;

  if (!policy || daysSincePurchase === null) {
    return {
      status: "unknown" as const,
      policyKnown: false,
      daysSincePurchase,
      returnDaysTotal: null,
      returnDaysRemaining: null,
      returnEligible: "unknown" as const,
      returnLabel: "Check with merchant - policy not on file",
      warrantyDaysTotal: null,
      warrantyDaysRemaining: null,
      warrantyEligible: "unknown" as const,
      warrantyLabel: "Check with merchant - warranty not on file",
      summaryLabel: "Check with merchant · Coverage not confirmed",
    };
  }

  const returnDaysTotal = policy.returnDays ?? null;
  const returnDaysRemaining =
    returnDaysTotal !== null
      ? Math.max(0, returnDaysTotal - daysSincePurchase)
      : null;
  const returnEligible =
    returnDaysTotal === null
      ? ("unknown" as const)
      : daysSincePurchase <= returnDaysTotal
        ? ("eligible" as const)
        : ("expired" as const);
  const returnLabel =
    returnEligible === "eligible"
      ? `${returnDaysRemaining} of ${returnDaysTotal} days remaining`
      : returnEligible === "expired"
        ? `Return window ended (${returnDaysTotal}d policy)`
        : "Check with merchant";

  const warrantyDaysTotal = policy.warrantyDays ?? null;
  const warrantyDaysRemaining =
    warrantyDaysTotal !== null
      ? Math.max(0, warrantyDaysTotal - daysSincePurchase)
      : null;
  const warrantyEligible =
    warrantyDaysTotal === null
      ? ("unknown" as const)
      : daysSincePurchase <= warrantyDaysTotal
        ? ("eligible" as const)
        : ("expired" as const);
  const warrantyLabel =
    warrantyEligible === "eligible"
      ? `${warrantyDaysRemaining} of ${warrantyDaysTotal} days remaining`
      : warrantyEligible === "expired"
        ? `Warranty ended (${warrantyDaysTotal}d policy)`
        : "Check with merchant";

  const summaryLabel =
    returnEligible === "eligible"
      ? `Return window open (${returnDaysRemaining}d left) · Warranty active`
      : warrantyEligible === "eligible"
        ? `Return window ended · Warranty active (${warrantyDaysRemaining}d left)`
        : "Coverage window expired";

  return {
    status: "verified" as const,
    policyKnown: true,
    daysSincePurchase,
    returnDaysTotal,
    returnDaysRemaining,
    returnEligible,
    returnLabel,
    warrantyDaysTotal,
    warrantyDaysRemaining,
    warrantyEligible,
    warrantyLabel,
    summaryLabel,
  };
}
