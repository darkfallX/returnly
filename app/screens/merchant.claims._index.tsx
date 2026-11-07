import { useActionQuery } from "@agent-native/core/client/hooks";
import { Settings } from "lucide-react";

import { AnimatedHeading } from "@/components/returnly/AnimatedHeading";
import { Btn } from "@/components/returnly/Btn";
import {
  CLAIM_STATUS_LABELS,
  formatMoneyMinor,
  formatRelativeDate,
} from "@/lib/motion-tokens";

export function meta() {
  return [{ title: "Merchant Inbox - Returnly" }];
}

export default function MerchantClaimsIndexRoute() {
  const {
    data: claims = [],
    isLoading,
    error,
    refetch,
  } = useActionQuery("list-claims", {
    scope: "merchant",
  });

  return (
    <div className="returnly-grid-backdrop returnly-workspace min-h-full px-4 py-5 sm:px-6 sm:py-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <AnimatedHeading text="Inbox" className="text-2xl sm:text-3xl" />
          </div>

          <Btn
            to="/merchant/settings"
            variant="secondary"
            size="sm"
            icon={<Settings className="size-3.5" />}
          >
            Settings
          </Btn>
        </div>

        {isLoading ? (
          <div
            role="status"
            aria-label="Loading inbox"
            className="h-32 animate-pulse rounded-[24px] bg-[#E4E4E7]/60"
          />
        ) : error ? (
          <div
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            <p>{error.message}</p>
            <Btn
              onClick={() => void refetch()}
              variant="secondary"
              size="sm"
              icon={null}
              className="mt-3"
            >
              Try again
            </Btn>
          </div>
        ) : claims.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-[#D4D4D8] bg-white p-8 text-center">
            <p className="text-sm font-bold text-[#18181B]">
              No claims in queue
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {claims.map((claim: any) => {
              const statusMeta = CLAIM_STATUS_LABELS[claim.status] ?? {
                label: claim.status,
                tone: "neutral",
                description: "",
              };
              return (
                <div
                  key={claim.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-[#E4E4E7] bg-white p-4 shadow-xs transition-all hover:border-[#18181B] sm:p-5"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#18181B] px-2.5 py-0.5 font-mono text-[11px] font-bold text-white">
                        #{claim.claimCode}
                      </span>
                      <span className="rounded-full border border-[#E4E4E7] bg-[#F4F4F5] px-2 py-0.5 text-[11px] font-bold text-[#18181B]">
                        {statusMeta.label}
                      </span>
                      <span className="text-[11px] text-[#71717A]">
                        {formatRelativeDate(claim.updatedAt)}
                      </span>
                    </div>
                    <h3 className="mt-1 break-words text-base font-semibold text-[#18181B]">
                      {claim.productName}
                    </h3>
                    <p className="text-[12px] text-[#71717A]">
                      {claim.issueTitle}
                    </p>
                  </div>

                  <div className="flex w-full items-center justify-between gap-3 sm:w-auto">
                    <span className="text-sm font-bold text-[#18181B] tabular-nums">
                      {formatMoneyMinor(claim.amountMinor, claim.currencyCode)}
                    </span>
                    <Btn
                      to={`/merchant/claims/${claim.id}`}
                      variant="primary"
                      size="sm"
                    >
                      Review
                    </Btn>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
