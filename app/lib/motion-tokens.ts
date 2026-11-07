export const MOTION = {
  easeOutExpo: [0.16, 1, 0.3, 1] as const,
  easeInOutCubic: [0.65, 0, 0.35, 1] as const,
  springSnappy: { type: "spring" as const, stiffness: 360, damping: 30, mass: 0.8 },
  springSoft: { type: "spring" as const, stiffness: 220, damping: 26, mass: 0.95 },
  springHero: { type: "spring" as const, stiffness: 170, damping: 24, mass: 1.05 },
  durationFast: 0.16,
  durationBase: 0.28,
  durationScene: 0.56,
  staggerShort: 0.045,
};

export function formatMoneyMinor(
  amountMinor: number | null | undefined,
  currencyCode = "NGN",
): string {
  if (amountMinor === null || amountMinor === undefined || !Number.isFinite(amountMinor)) {
    return "Unknown";
  }
  const major = amountMinor / 100;
  const symbol =
    currencyCode.toUpperCase() === "NGN"
      ? "₦"
      : currencyCode.toUpperCase() === "USD"
        ? "$"
        : `${currencyCode.toUpperCase()} `;
  return `${symbol}${major.toLocaleString("en-NG", {
    minimumFractionDigits: major % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatRelativeDate(isoString: string | null | undefined): string {
  if (!isoString) return "Recorded date";
  const parsed = Date.parse(isoString);
  if (Number.isNaN(parsed)) return isoString;
  return new Date(parsed).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export const CLAIM_STATUS_LABELS: Record<
  string,
  { label: string; tone: "neutral" | "lime" | "mint" | "amber" | "danger"; description: string }
> = {
  draft: {
    label: "Draft staged",
    tone: "neutral",
    description: "Ready for approval",
  },
  submitted: {
    label: "Claim submitted",
    tone: "lime",
    description: "In merchant inbox",
  },
  under_review: {
    label: "Merchant reviewing",
    tone: "mint",
    description: "In review",
  },
  awaiting_evidence: {
    label: "Evidence requested",
    tone: "amber",
    description: "Details requested",
  },
  offered: {
    label: "Offer received",
    tone: "lime",
    description: "Offer ready",
  },
  offer_pending: {
    label: "Offer received",
    tone: "lime",
    description: "Offer ready",
  },
  agreed: {
    label: "Awaiting your approval",
    tone: "mint",
    description: "Awaiting your approval",
  },
  appointment_confirmed: {
    label: "Appointment confirmed",
    tone: "lime",
    description: "QR pass active",
  },
  inspection: {
    label: "Appointment confirmed",
    tone: "mint",
    description: "Pass verified",
  },
  fulfilled: {
    label: "Handover recorded",
    tone: "mint",
    description: "Handover recorded",
  },
  completed: {
    label: "Buyer confirmed",
    tone: "lime",
    description: "Case closed",
  },
  closed: {
    label: "Buyer confirmed",
    tone: "lime",
    description: "Case closed",
  },
  rejected: {
    label: "Declined",
    tone: "danger",
    description: "Outside policy",
  },
  cancelled: {
    label: "Cancelled",
    tone: "neutral",
    description: "Cancelled",
  },
};

export const REMEDY_LABELS: Record<string, string> = {
  inspection: "Inspection",
  replacement: "Replacement",
  repair: "Repair",
  partial_keep_item_refund: "Partial Refund",
  full_refund_request: "Refund request",
};

export const LOGISTICS_LABELS: Record<string, string> = {
  drop_off: "Branch Drop-Off",
  pickup: "Pickup request",
};
