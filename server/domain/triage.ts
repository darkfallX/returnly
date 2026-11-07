interface TriageFacts {
  issueTitle: string;
  issueDescription: string;
  policy: {
    version: number;
    returnDays: number | null;
    warrantyDays: number | null;
    conditions: Record<string, unknown>;
  } | null;
  coverage: {
    daysSincePurchase: number | null;
    returnEligible: string;
    warrantyEligible: string;
  } | null;
  purchase: { orderNumber: string | null; verificationStatus: string } | null;
  evidence: Array<{ mediaKind: string; attachmentId: string | null }>;
  stock: Array<{ branchId: string; branchName: string; available: number; onHand: number; reserved: number }>;
}

/** Stored-policy checks only. The agent interprets these facts; this does not diagnose media. */
export function checkClaimPolicy(facts: TriageFacts) {
  const { policy, coverage, purchase, stock } = facts;
  const conditions = policy?.conditions ?? {};
  const hasMedia = (kind: string) => facts.evidence.some(e => e.mediaKind === kind && Boolean(e.attachmentId));
  const missingItems: string[] = [];
  if (!policy) missingItems.push("Merchant policy is not on file; human review required");
  if (conditions.requiresReceipt === true && !hasMedia("receipt")) missingItems.push("Purchase receipt or merchant-confirmed order reference");
  if (conditions.requiresFaultMedia === true && !hasMedia("photo")) missingItems.push("Product condition photo");
  if (conditions.requiresVideoForAudioFaults === true && /speaker|audio|earcup/i.test(`${facts.issueTitle} ${facts.issueDescription}`) && !hasMedia("video")) missingItems.push("Issue video or audio clip; a diagnostic note is not a recording");
  const daysSincePurchase = coverage?.daysSincePurchase ?? null;
  const eligible = coverage?.returnEligible === "eligible" || coverage?.warrantyEligible === "eligible";
  const bothExpired = coverage?.returnEligible === "expired" && coverage?.warrantyEligible === "expired";
  const policyMatch = !policy || !coverage || missingItems.length > 0 ? "uncertain" as const : eligible ? "matched" as const : bothExpired ? "not_matched" as const : "uncertain" as const;
  const allowed = Array.isArray(conditions.allowedRemedies) ? conditions.allowedRemedies.filter((r): r is string => typeof r === "string") : [];
  const recommendedRemedies: string[] = [];
  if (policy && allowed.includes("inspection")) recommendedRemedies.push("Merchant inspection before confirming the fault");
  if (eligible && allowed.includes("replacement")) {
    for (const branch of stock.filter(b => b.available > 0)) recommendedRemedies.push(`Replacement review at ${branch.branchName}: ${branch.available} available; inspection and merchant approval required`);
  }
  if (eligible && allowed.includes("repair")) recommendedRemedies.push("Merchant repair review under the stored policy");
  if (eligible && allowed.includes("partial_keep_item_refund") && typeof conditions.maxPartialKeepRefundPercent === "number") recommendedRemedies.push(`Human-approved partial-refund proposal up to ${conditions.maxPartialKeepRefundPercent}% under the stored policy; no payment is issued by this app`);
  if (recommendedRemedies.length === 0) recommendedRemedies.push("Merchant review; no automated remedy confirmed");
  const window = !coverage ? "Coverage unknown." : `Return window: ${coverage.returnEligible}. Warranty: ${coverage.warrantyEligible}.`;
  const age = daysSincePurchase === null ? "Purchase age unknown." : `Purchase age: ${daysSincePurchase} days.`;
  const availability = stock.length ? stock.map(b => `${b.branchName}: ${b.available} available`).join("; ") + "." : "No branch stock is confirmed.";
  const reasoningSummary = `${age} ${window} ${availability} ${missingItems.length ? `Needs review: ${missingItems.join("; ")}.` : "Required evidence references are recorded."} Media content has not been independently verified. Human approval is required for a resolution.`;
  const sourceRefs = [
    policy ? `Stored merchant policy v${policy.version}: returns ${policy.returnDays ?? "unknown"} days; warranty ${policy.warrantyDays ?? "unknown"} days` : "Merchant policy: unknown",
    purchase ? `Order reference: ${purchase.orderNumber ?? "not provided"}; verification: ${purchase.verificationStatus}` : "Purchase record: missing",
    ...stock.map(b => `${b.branchName}: ${b.available} available (${b.onHand} on hand, ${b.reserved} reserved)`),
  ];
  return { policyMatch, daysSincePurchase, missingItems, stockSnapshot: stock, recommendedRemedies, reasoningSummary, sourceRefs };
}
