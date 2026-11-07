import {
  ArrowRight,
  FileText,
  Headphones,
  QrCode,
  ShieldCheck,
  ShoppingBag,
  Store,
  UserCheck,
} from "lucide-react";

/** Illustrative, explicitly labeled preview of the seeded demo. */
export function OnboardingIllustration({
  step,
  activeWorkflowStage = 0,
}: {
  step: number;
  activeWorkflowStage?: number;
}) {
  return (
    <div className="flex h-full w-full flex-col justify-center bg-[#FAFAFA] p-5 sm:p-7">
      <div className="overflow-hidden rounded-[20px] border border-[#E4E4E7] bg-white shadow-[0_12px_32px_-12px_rgba(24,24,27,0.08)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E4E4E7] bg-[#FAFAFA] px-4 py-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-[#52525B]">
              {step === 0
                ? "Purchase vault"
                : step === 1
                  ? "Claim review"
                  : "Workspaces"}
            </span>
          </div>
          <span className="rounded-full border border-[#E4E4E7] bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#18181B]">
            Demo preview
          </span>
        </div>

        {/* Step 0: Purchase Vault + Coverage Preview */}
        {step === 0 ? (
          <div className="space-y-3 p-4">
            <div className="flex items-center justify-between rounded-2xl border border-[#E4E4E7] bg-[#FAFAFA] p-3.5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#18181B] text-white">
                  <Headphones className="size-5" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[13px] font-extrabold text-[#18181B]">
                      Wireless Headphones
                    </span>
                    <span className="rounded-full bg-[#18181B] px-2 py-0.5 text-[10px] font-bold text-white">
                      ₦45,000
                    </span>
                  </div>
                  <p className="text-[11px] text-[#71717A]">
                    Northline Audio · #NL-88412
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-xl border border-[#E4E4E7] bg-white p-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#71717A]">
                  Store Policy v1
                </span>
                <p className="mt-1 text-[12px] font-extrabold text-[#18181B]">
                  14d Return · 365d Warranty
                </p>
              </div>
              <div className="rounded-xl border border-[#E4E4E7] bg-white p-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#71717A]">
                  Central Branch
                </span>
                <p className="mt-1 text-[12px] font-extrabold text-[#18181B]">
                  Replacement options
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-[#18181B] bg-[#18181B] px-3.5 py-2.5 text-white">
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-zinc-300" />
                <span className="text-[12px] font-bold">
                  Return Passport #RT-1042
                </span>
              </div>
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold text-white">
                Offer received
              </span>
            </div>
          </div>
        ) : step === 1 ? (
          /* Step 1: Buyer and merchant handoff */
          <div className="space-y-2.5 p-4">
            <div
              className={`rounded-xl border p-3 transition-all ${
                activeWorkflowStage === 0
                  ? "border-[#18181B] bg-[#FAFAFA] shadow-xs"
                  : "border-[#E4E4E7] bg-white"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-[#18181B]">
                  <UserCheck className="size-3.5" />
                  1. Report the item
                </span>
                <span className="rounded-md bg-[#F4F4F5] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#52525B]">
                  Your claim
                </span>
              </div>
              <p className="mt-1 text-[11px] text-[#52525B]">
                Review your report before sharing it with the store.
              </p>
            </div>

            <div className="flex justify-center">
              <div className="h-3 w-px bg-[#D4D4D8]" />
            </div>

            <div
              className={`rounded-xl border p-3 transition-all ${
                activeWorkflowStage === 1
                  ? "border-[#18181B] bg-[#FAFAFA] shadow-xs"
                  : "border-[#E4E4E7] bg-white"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-[#18181B]">
                  <Store className="size-3.5" />
                  2. Store review
                </span>
                <span className="rounded-md bg-[#F4F4F5] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#52525B]">
                  Policy and stock
                </span>
              </div>
              <p className="mt-1 text-[11px] text-[#52525B]">
                The store checks the purchase and proposes a resolution.
              </p>
            </div>

            <div className="flex justify-center">
              <div className="h-3 w-px bg-[#D4D4D8]" />
            </div>

            <div
              className={`rounded-xl border p-3 transition-all ${
                activeWorkflowStage === 2
                  ? "border-[#18181B] bg-[#18181B] text-white shadow-xs"
                  : "border-[#E4E4E7] bg-white text-[#18181B]"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold">
                  <QrCode className="size-3.5" />
                  3. Approve and collect
                </span>
                <span
                  className={`rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                    activeWorkflowStage === 2
                      ? "bg-white/15 text-white"
                      : "bg-[#F4F4F5] text-[#52525B]"
                  }`}
                >
                  Check-in pass
                </span>
              </div>
              <p
                className={`mt-1 text-[11px] ${
                  activeWorkflowStage === 2 ? "text-zinc-300" : "text-[#52525B]"
                }`}
              >
                Agree an appointment and bring your pass.
              </p>
            </div>
          </div>
        ) : (
          /* Step 2: Role-Your workspace Account Preview */
          <div className="space-y-2.5 p-4">
            <div className="flex items-center justify-between rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] p-3">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex size-8 items-center justify-center rounded-lg bg-[#18181B] text-white">
                  <ShoppingBag className="size-4" />
                </span>
                <div>
                  <p className="text-[12px] font-extrabold text-[#18181B]">
                    Buyer
                  </p>
                  <p className="text-[11px] text-[#71717A]">
                    Purchases and claims
                  </p>
                </div>
              </div>
              <span className="rounded-full border border-[#E4E4E7] bg-white px-2 py-0.5 text-[10px] font-bold text-[#18181B]">
                Your workspace
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] p-3">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex size-8 items-center justify-center rounded-lg bg-[#18181B] text-white">
                  <Store className="size-4" />
                </span>
                <div>
                  <p className="text-[12px] font-extrabold text-[#18181B]">
                    Store
                  </p>
                  <p className="text-[11px] text-[#71717A]">
                    Review incoming claims
                  </p>
                </div>
              </div>
              <span className="rounded-full border border-[#E4E4E7] bg-white px-2 py-0.5 text-[10px] font-bold text-[#18181B]">
                Store workspace
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-[#18181B] bg-[#18181B] px-3.5 py-2.5 text-white">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold">
                <ShieldCheck className="size-3.5" />
                Follow both sides in the demo
              </span>
              <ArrowRight className="size-3.5 text-zinc-400" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
