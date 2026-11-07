import {
  useActionMutation,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import { ClipboardCheck, Settings, Store } from "lucide-react";
import { toast } from "sonner";

import { ActionMorphButton } from "@/components/returnly/ActionMorphButton";
import { AgentContextBar } from "@/components/returnly/AgentContextBar";
import { AnimatedHeading } from "@/components/returnly/AnimatedHeading";
import { Btn } from "@/components/returnly/Btn";
import { CLAIM_STATUS_LABELS, formatMoneyMinor } from "@/lib/motion-tokens";

export function meta() {
  return [{ title: "Merchant Dashboard - Returnly" }];
}

export default function MerchantHomeRoute() {
  const { data: viewer } = useActionQuery("get-viewer-context", {});
  const {
    data: claims = [],
    isLoading,
    error,
    refetch,
  } = useActionQuery("list-claims", {
    scope: "merchant",
  });

  const triageMut = useActionMutation("triage-merchant-claim", {
    onSuccess: (res) =>
      toast.success("Policy match: " + res.policyMatch.toUpperCase()),
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="returnly-grid-backdrop returnly-workspace min-h-full px-4 py-5 sm:px-6 sm:py-6">
      <div className="mx-auto max-w-5xl space-y-5">
        {/* Merchant Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#18181B] px-3 py-1 text-[12px] font-bold text-white">
                <Store className="size-3.5" />
                {viewer?.activeMerchant?.name || "Store"}
              </span>
              <span className="rounded-full border border-[#E4E4E7] bg-white px-2.5 py-0.5 font-mono text-[11px] font-semibold text-[#52525B]">
                {viewer?.canAccessDemoSwitcher &&
                !viewer?.hasRealMerchantMembership
                  ? "Demo preview"
                  : "Store staff"}
              </span>
            </div>
            <AnimatedHeading
              text="Inbox"
              className="mt-2 text-2xl sm:text-3xl"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Btn
              to="/merchant/settings"
              variant="secondary"
              size="sm"
              icon={<Settings className="size-3.5" />}
            >
              Settings
            </Btn>
            <Btn to="/merchant/claims" variant="primary" size="sm">
              Claims ({claims.length})
            </Btn>
          </div>
        </div>

        {/* AI Context Bar */}
        <AgentContextBar
          suggestedPrompts={[
            {
              label: "Triage all",
              prompt: "Inspect all pending claims and run policy checks.",
            },
            {
              label: "Check inventory",
              prompt: "Inspect branch inventory and appointment slots.",
            },
          ]}
        />

        {/* Incoming Claims Queue */}
        <section aria-label="Incoming claims" className="space-y-3">
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
                    className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-[#18181B] bg-[#18181B] p-4 text-white shadow-sm sm:p-5"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-white px-2.5 py-0.5 font-mono text-[11px] font-bold text-[#18181B]">
                          #{claim.claimCode}
                        </span>
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold text-white">
                          {statusMeta.label}
                        </span>
                        <span className="text-[12px] font-semibold text-zinc-300 tabular-nums">
                          {formatMoneyMinor(
                            claim.amountMinor,
                            claim.currencyCode,
                          )}
                        </span>
                      </div>
                      <h3 className="break-words text-base font-semibold text-white">
                        {claim.productName}
                      </h3>
                      <p className="text-[13px] text-zinc-300">
                        {claim.issueTitle}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <ActionMorphButton
                        state={triageMut.isPending ? "submitting" : "idle"}
                        idleLabel="Check Policy"
                        submittingLabel="Checking…"
                        variant="outline"
                        size="sm"
                        icon={<ClipboardCheck className="size-3.5" />}
                        onClick={() =>
                          triageMut.mutate({
                            claimId: claim.id,
                            ...(viewer?.canAccessDemoSwitcher
                              ? { demoActorRole: "merchant" as const }
                              : {}),
                          })
                        }
                      />
                      <Btn
                        to={`/merchant/claims/${claim.id}`}
                        variant="light"
                        size="sm"
                      >
                        Open Room
                      </Btn>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
