import { useActionQuery } from "@agent-native/core/client/hooks";
import { Plus } from "lucide-react";

import { AgentContextBar } from "@/components/returnly/AgentContextBar";
import { Btn } from "@/components/returnly/Btn";
import {
  CLAIM_STATUS_LABELS,
  formatMoneyMinor,
  formatRelativeDate,
} from "@/lib/motion-tokens";

export function meta() {
  return [{ title: "Purchases - Returnly" }];
}

export default function BuyerHomeRoute() {
  const {
    data: purchases = [],
    isLoading,
    error,
    refetch,
  } = useActionQuery("list-purchases", {});
  const { data: viewer } = useActionQuery("get-viewer-context", {});
  // Demo preview shows its one fixture; normal workspaces retain owned purchases.
  const visible = purchases.filter((purchase) =>
    viewer?.user.demoMode
      ? purchase.id === "11111111-1111-4111-8111-111111111108"
      : purchase.id !== "11111111-1111-4111-8111-111111111109",
  );
  return (
    <div className="returnly-grid-backdrop returnly-workspace min-h-full px-4 py-5 sm:px-6 sm:py-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight text-[#18181B] sm:text-3xl">
            Purchases
          </h1>
          <Btn
            to="/buyer/vault"
            size="sm"
            variant="secondary"
            icon={<Plus className="size-4" />}
          >
            Add purchase
          </Btn>
        </header>
        <AgentContextBar
          suggestedPrompts={[
            {
              label: "Review my claim",
              prompt:
                "Read my open claim and explain the next action. Ask before accepting an offer.",
            },
          ]}
        />
        {isLoading ? (
          <div
            role="status"
            aria-label="Loading purchases"
            className="h-44 animate-pulse rounded-3xl bg-zinc-100"
          />
        ) : error ? (
          <div
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            <p>{error.message}</p>
            <Btn
              variant="secondary"
              size="sm"
              icon={null}
              className="mt-3"
              onClick={() => void refetch()}
            >
              Try again
            </Btn>
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-3xl border border-zinc-200 bg-white p-6">
            <p className="mb-4 font-semibold text-[#18181B]">
              No purchases yet
            </p>
            <Btn to="/buyer/vault" size="sm">
              Add purchase
            </Btn>
          </div>
        ) : (
          <section aria-label="Purchases" className="space-y-4">
            {visible.map((purchase) => {
              const claim =
                purchase.linkedClaims?.find(
                  (item: { status: string }) =>
                    !["closed", "cancelled"].includes(item.status),
                ) ?? purchase.linkedClaims?.[0];
              return (
                <article
                  key={purchase.id}
                  className="rounded-[24px] border border-zinc-200 bg-white p-5 text-[#18181B] sm:p-6"
                >
                  <div className="flex flex-wrap justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm text-zinc-600">
                        {purchase.merchantName}
                      </p>
                      <h2 className="mt-1 break-words text-xl font-semibold">
                        {purchase.productName}
                      </h2>
                      <p className="mt-1 text-sm text-zinc-600">
                        {purchase.orderNumber
                          ? `#${purchase.orderNumber} · `
                          : ""}
                        {formatRelativeDate(purchase.purchasedAt)}
                      </p>
                    </div>
                    <p className="text-xl font-bold tabular-nums">
                      {formatMoneyMinor(
                        purchase.amountMinor,
                        purchase.currencyCode,
                      )}
                    </p>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2 text-xs">
                    {purchase.coverage?.policyKnown ? (
                      <>
                        <span className="rounded-full bg-zinc-100 px-3 py-1.5">
                          Return: {purchase.coverage.returnLabel}
                        </span>
                        <span className="rounded-full bg-zinc-100 px-3 py-1.5">
                          Warranty: {purchase.coverage.warrantyLabel}
                        </span>
                      </>
                    ) : (
                      <span className="rounded-full bg-zinc-100 px-3 py-1.5">
                        Policy unknown
                      </span>
                    )}
                    {claim && (
                      <span className="rounded-full bg-[#DDF2EA] px-3 py-1.5 font-semibold">
                        {CLAIM_STATUS_LABELS[claim.status]?.label ??
                          claim.status}
                      </span>
                    )}
                  </div>
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-4">
                    <Btn
                      to={`/buyer/purchases/${purchase.id}`}
                      size="sm"
                      variant="soft"
                      icon={null}
                    >
                      Details
                    </Btn>
                    <Btn
                      to={
                        claim
                          ? `/buyer/claims/${claim.id}`
                          : `/buyer/purchases/${purchase.id}?report=1`
                      }
                      size="sm"
                    >
                      {claim
                        ? `Open claim #${claim.claimCode}`
                        : "Report a problem"}
                    </Btn>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </div>
  );
}
