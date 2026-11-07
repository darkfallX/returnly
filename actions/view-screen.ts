import { defineAction } from "@agent-native/core/action";
import { readAppState } from "@agent-native/core/application-state";
import { z } from "zod";
import {
  getClaimDomain,
  getPurchaseDomain,
  getViewerContextDomain,
  listClaimsDomain,
  listPurchasesDomain,
} from "../server/domain/operations.ts";
import { DEMO_IDS } from "../server/domain/returnly.ts";

export default defineAction({
  description:
    "Read the current Returnly screen state, including navigation, viewer role, and the currently visible purchase or claim record.",
  schema: z.object({}),
  outputSchema: z.any(),
  http: false,
  readOnly: true,
  run: async (_args, ctx) => {
    const navigation = (await readAppState("navigation")) as Record<
      string,
      unknown
    > | null;
    const viewer = await getViewerContextDomain(ctx);

    const screen: Record<string, unknown> = {
      navigation: navigation ?? { view: "landing", path: "/" },
      viewer: {
        email: viewer.email,
        preferredRole: viewer.user.preferredRole,
        demoMode: viewer.user.demoMode,
        onboardingCompleted: viewer.user.onboardingCompleted,
        activeMerchant: viewer.activeMerchant?.name ?? null,
      },
    };

    const purchaseId =
      typeof navigation?.purchaseId === "string"
        ? navigation.purchaseId
        : undefined;
    const claimId =
      typeof navigation?.claimId === "string" ? navigation.claimId : undefined;
    const view = typeof navigation?.view === "string" ? navigation.view : "";

    if (purchaseId) {
      try {
        screen.activePurchase = await getPurchaseDomain(purchaseId, ctx);
      } catch {
        // ignore if not found
      }
    } else if (view.startsWith("buyer")) {
      screen.purchasesSummary = (await listPurchasesDomain(ctx)).map((p) => ({
        id: p.id,
        productName: p.productName,
        merchantName: p.merchantName,
        amountMinor: p.amountMinor,
        returnEligible: p.coverage.returnEligible,
        warrantyEligible: p.coverage.warrantyEligible,
      }));
    }

    if (claimId) {
      try {
        const detail = await getClaimDomain(claimId, ctx);
        screen.activeClaim = {
          id: detail.claim.id,
          claimCode: detail.claim.claimCode,
          status: detail.claim.status,
          issueTitle: detail.claim.issueTitle,
          preferredResolution: detail.claim.preferredResolution,
          preferredLogistics: detail.claim.preferredLogistics,
          lastChangedBy: detail.claim.lastChangedBy,
          evidenceCount: detail.evidence.length,
          latestTriage: detail.latestTriage,
          activeOffer: detail.activeOffer,
          reservation: detail.reservation,
          returnPass: detail.returnPass,
        };
      } catch {
        // ignore
      }
    } else if (view === "demo") {
      try {
        const detail = await getClaimDomain(DEMO_IDS.claimHeadphones, ctx);
        screen.demoClaim = {
          id: detail.claim.id,
          claimCode: detail.claim.claimCode,
          status: detail.claim.status,
          issueTitle: detail.claim.issueTitle,
          activeOffer: detail.activeOffer,
          returnPass: detail.returnPass,
        };
      } catch {
        screen.claimsSummary = await listClaimsDomain({ scope: "all" }, ctx);
      }
    } else if (view.startsWith("merchant")) {
      screen.merchantClaims = await listClaimsDomain(
        { scope: "merchant" },
        ctx,
      );
    }

    return screen;
  },
});
