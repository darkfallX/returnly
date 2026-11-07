import { describe, expect, it } from "vitest";
import { checkClaimPolicy } from "./triage.ts";

const facts = {
  issueTitle: "Audio cuts out", issueDescription: "Left speaker stops",
  policy: { version: 7, returnDays: 3, warrantyDays: 10, conditions: { allowedRemedies: ["replacement", "repair"], requiresVideoForAudioFaults: true } },
  coverage: { daysSincePurchase: 4, returnEligible: "expired", warrantyEligible: "eligible" },
  purchase: { orderNumber: null, verificationStatus: "user_confirmed" },
  evidence: [{ mediaKind: "diagnostic_note", attachmentId: null }],
  stock: [{ branchId: "other", branchName: "West store", available: 2, onHand: 3, reserved: 1 }],
};

describe("Stored policy checks", () => {
  it("uses actual policy and stock without inventing media verification or order references", () => {
    const result = checkClaimPolicy(facts);
    expect(result.policyMatch).toBe("uncertain");
    expect(result.reasoningSummary).toContain("Return window: expired");
    expect(result.reasoningSummary).toContain("not been independently verified");
    expect(result.recommendedRemedies.join(" ")).toContain("West store: 2 available");
    expect(result.sourceRefs.join(" ")).toContain("policy v7");
    expect(result.sourceRefs.join(" ")).not.toMatch(/ORD-NL|Central Branch|14d/);
  });
  it("keeps missing dates and policy unknown", () => {
    const result = checkClaimPolicy({ ...facts, coverage: null, policy: null, stock: [] });
    expect(result.daysSincePurchase).toBeNull();
    expect(result.policyMatch).toBe("uncertain");
    expect(result.reasoningSummary).toContain("Purchase age unknown");
    expect(result.recommendedRemedies).toEqual(["Merchant review; no automated remedy confirmed"]);
  });
  it("does not recommend policy remedies after both coverage windows expire", () => {
    const result = checkClaimPolicy({ ...facts, policy: { ...facts.policy, conditions: { allowedRemedies: ["replacement", "repair"] } }, coverage: { daysSincePurchase: 90, returnEligible: "expired", warrantyEligible: "expired" } });
    expect(result.policyMatch).toBe("not_matched");
    expect(result.recommendedRemedies.join(" ")).not.toMatch(/Replacement review|repair review/);
  });
});
