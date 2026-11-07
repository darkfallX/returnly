import {
  useActionMutation,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import { ArrowLeft, CheckCircle2, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ActionMorphButton } from "@/components/returnly/ActionMorphButton";
import { AnimatedHeading } from "@/components/returnly/AnimatedHeading";
import { Btn } from "@/components/returnly/Btn";

export function meta() {
  return [{ title: "Store Settings - Returnly" }];
}

export default function MerchantSettingsRoute() {
  const {
    data: viewer,
    isLoading,
    error,
    refetch,
  } = useActionQuery("get-viewer-context", {});

  const [returnDays, setReturnDays] = useState<number>(14);
  const [warrantyDays, setWarrantyDays] = useState<number>(365);
  const [returnRule, setReturnRule] = useState<string>(
    "14-day return or branch replacement for verified faults.",
  );
  const [warrantyRule, setWarrantyRule] = useState<string>(
    "365-day hardware coverage.",
  );
  const [centralStock, setCentralStock] = useState<number>(4);

  useEffect(() => {
    if (!viewer) return;
    if (viewer.policy) {
      setReturnDays(viewer.policy.returnDays ?? 14);
      setWarrantyDays(viewer.policy.warrantyDays ?? 365);
      const conds = JSON.parse(viewer.policy.conditionsJson || "{}");
      if (conds.returnRule) setReturnRule(conds.returnRule);
      if (conds.warrantyRule) setWarrantyRule(conds.warrantyRule);
    }
    if (viewer.inventory?.[0]) {
      setCentralStock(viewer.inventory[0].onHand);
    }
  }, [viewer]);

  const updateMut = useActionMutation("update-merchant-settings", {
    onSuccess: (res) => toast.success(res.message),
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="returnly-workspace px-4 py-5 sm:px-6 sm:py-6">
        <div className="mx-auto max-w-4xl space-y-4">
          <Btn
            to="/merchant/claims"
            variant="soft"
            size="sm"
            icon={<ArrowLeft className="size-3.5" />}
          >
            Back to inbox
          </Btn>
          <div
            role="status"
            aria-label="Loading store settings"
            className="h-64 animate-pulse rounded-[24px] bg-[#E4E4E7]/60"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="returnly-grid-backdrop returnly-workspace min-h-full px-4 py-5 sm:px-6 sm:py-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <Btn
          to="/merchant/claims"
          variant="soft"
          size="sm"
          icon={<ArrowLeft className="size-3.5" />}
        >
          Back to inbox
        </Btn>
        <div>
          <AnimatedHeading
            text="Policy & stock"
            className="text-2xl sm:text-3xl"
          />
          {viewer?.activeMerchant?.name && (
            <p className="mt-1 text-sm text-[#52525B]">
              {viewer.activeMerchant.name}
            </p>
          )}
        </div>

        {error ? (
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
        ) : (
          <>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateMut.mutate({
                  returnDays,
                  warrantyDays,
                  returnRule,
                  warrantyRule,
                  branchId: viewer?.branches?.[0]?.id,
                  stockOnHand: centralStock,
                });
              }}
              className="space-y-4 rounded-[24px] border border-[#E4E4E7] bg-white p-5 shadow-xs"
            >
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label
                    htmlFor="return-days"
                    className="block text-[13px] font-bold text-[#18181B]"
                  >
                    Return Days
                  </label>
                  <input
                    id="return-days"
                    type="number"
                    min={0}
                    max={365}
                    value={returnDays}
                    onChange={(e) => setReturnDays(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] px-3 py-2 text-sm font-bold text-[#18181B] tabular-nums"
                  />
                </div>

                <div>
                  <label
                    htmlFor="warranty-days"
                    className="block text-[13px] font-bold text-[#18181B]"
                  >
                    Warranty Days
                  </label>
                  <input
                    id="warranty-days"
                    type="number"
                    min={0}
                    max={1095}
                    value={warrantyDays}
                    onChange={(e) => setWarrantyDays(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] px-3 py-2 text-sm font-bold text-[#18181B] tabular-nums"
                  />
                </div>

                <div>
                  <label
                    htmlFor="branch-stock"
                    className="block text-[13px] font-bold text-[#18181B]"
                  >
                    Branch Stock
                  </label>
                  <input
                    id="branch-stock"
                    type="number"
                    min={0}
                    max={100}
                    value={centralStock}
                    onChange={(e) => setCentralStock(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] px-3 py-2 text-sm font-bold text-[#18181B] tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="return-policy-rule"
                  className="block text-[13px] font-bold text-[#18181B]"
                >
                  Return policy
                </label>
                <textarea
                  id="return-policy-rule"
                  rows={3}
                  value={returnRule}
                  onChange={(e) => setReturnRule(e.target.value)}
                  className="mt-1 w-full resize-y rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] px-3 py-2 text-sm leading-relaxed text-[#18181B]"
                />
              </div>

              <div>
                <label
                  htmlFor="warranty-policy-rule"
                  className="block text-[13px] font-bold text-[#18181B]"
                >
                  Warranty policy
                </label>
                <textarea
                  id="warranty-policy-rule"
                  rows={2}
                  value={warrantyRule}
                  onChange={(e) => setWarrantyRule(e.target.value)}
                  className="mt-1 w-full resize-y rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] px-3 py-2 text-sm leading-relaxed text-[#18181B]"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E4E4E7] pt-3">
                <span className="text-[13px] font-semibold text-[#71717A]">
                  Policy v{viewer?.policy?.version ?? 1}
                </span>
                <ActionMorphButton
                  type="submit"
                  state={updateMut.isPending ? "submitting" : "idle"}
                  idleLabel="Save Settings"
                  submittingLabel="Saving…"
                  variant="ink"
                  size="sm"
                  icon={<CheckCircle2 className="size-3.5" />}
                />
              </div>
            </form>

            {/* Active Branches */}
            <div className="grid gap-3 md:grid-cols-2">
              {(viewer?.branches ?? []).map((b: any) => (
                <div
                  key={b.id}
                  className="rounded-[20px] border border-[#E4E4E7] bg-white p-4"
                >
                  <div className="flex items-center gap-1.5 text-[13px] font-bold text-[#18181B]">
                    <MapPin className="size-3.5 text-[#52525B]" />
                    <span>{b.name}</span>
                  </div>
                  <p className="mt-1 text-[13px] text-[#71717A]">
                    {b.addressText}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
