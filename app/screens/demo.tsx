import {
  useActionMutation,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import {
  ArrowLeft,
  Columns2,
  RotateCcw,
  ShoppingBag,
  Store,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { toast } from "sonner";

import { ActionMorphButton } from "@/components/returnly/ActionMorphButton";
import { ResolutionRoom } from "@/components/returnly/ResolutionRoom";
import { cn } from "@/lib/utils";

const DEMO_CLAIM_ID = "11111111-1111-4111-8111-111111111110";

export function meta() {
  return [{ title: "Split Demo - Returnly" }];
}

export default function SplitDemoRoute() {
  const [mobileRole, setMobileRole] = useState<"buyer" | "merchant">("buyer");
  const {
    data: viewer,
    error: viewerError,
    refetch: refetchViewer,
  } = useActionQuery("get-viewer-context", {});
  const {
    data: claims,
    isLoading: claimsLoading,
    error: claimsError,
    refetch: refetchClaims,
  } = useActionQuery(
    "list-claims",
    { scope: "all" },
    { enabled: Boolean(viewer?.canAccessDemoSwitcher) },
  );
  const [params] = useSearchParams();
  const setupStarted = useRef(false);
  const setup = useActionMutation("complete-onboarding", {
    onError: (error) => toast.error(error.message),
  });
  useEffect(() => {
    if (
      params.get("setup") === "1" &&
      viewer &&
      !viewer.canAccessDemoSwitcher &&
      !setupStarted.current
    ) {
      setupStarted.current = true;
      setup.mutate({ role: "demo" });
    }
  }, [params, viewer, setup]);

  const activeClaimId = DEMO_CLAIM_ID;

  const resetMut = useActionMutation("reset-demo-scenario", {
    onSuccess: (res) => toast.success(res.message),
    onError: (err) => toast.error(err.message),
  });

  const exitLink = (
    <Link
      to="/buyer/home"
      className="inline-flex min-h-11 items-center gap-2 rounded-lg px-1 text-sm font-medium text-[#3F3F46] hover:text-[#090B09]"
    >
      <ArrowLeft className="size-4" />
      Back to purchases
    </Link>
  );

  if (viewerError || claimsError)
    return (
      <div className="returnly-grid-backdrop min-h-full px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-lg space-y-4">
          {exitLink}
          <div
            role="alert"
            className="rounded-2xl border border-[#E4E4E7] bg-white p-5"
          >
            <h1 className="text-lg font-semibold">Couldn't open the demo</h1>
            <p className="mt-2 text-sm text-[#52525B]">
              {viewerError?.message ?? claimsError?.message}
            </p>
            <ActionMorphButton
              className="mt-4"
              idleLabel="Try again"
              variant="outline"
              state="idle"
              onClick={() => {
                void refetchViewer();
                void refetchClaims();
              }}
            />
          </div>
        </div>
      </div>
    );

  if (
    !viewer ||
    setup.isPending ||
    (viewer.canAccessDemoSwitcher && claimsLoading)
  )
    return (
      <div className="returnly-grid-backdrop min-h-full px-4 py-6 sm:px-6">
        {exitLink}
        <p role="status" className="mt-4 text-sm text-[#52525B]">
          Opening demo…
        </p>
      </div>
    );
  if (!viewer.canAccessDemoSwitcher)
    return (
      <div className="returnly-grid-backdrop min-h-full px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-lg space-y-4">
          {exitLink}
          <h1 className="text-2xl font-semibold tracking-tight">
            Resolution demo
          </h1>
          <ActionMorphButton
            idleLabel="Try demo"
            state={setup.isPending ? "submitting" : "idle"}
            onClick={() => setup.mutate({ role: "demo" })}
          />
        </div>
      </div>
    );

  if (claims && !claims.some((claim) => claim.id === DEMO_CLAIM_ID))
    return (
      <div className="returnly-grid-backdrop min-h-full px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-lg space-y-4">
          {exitLink}
          <h1 className="text-2xl font-semibold tracking-tight">
            Resolution demo
          </h1>
          <ActionMorphButton
            idleLabel="Start demo"
            state={resetMut.isPending ? "submitting" : "idle"}
            onClick={() => resetMut.mutate({ mode: "submitted" })}
          />
        </div>
      </div>
    );

  return (
    <div className="returnly-grid-backdrop min-h-full px-3 py-4 sm:px-6">
      <div className="mx-auto max-w-[1600px] space-y-3">
        {exitLink}
        {/* Compact Top Demo Bar */}
        <div className="rounded-2xl border border-[#E4E4E7] bg-white px-4 py-3 text-[#18181B]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex size-8 items-center justify-center rounded-lg bg-[#F4F4F5] text-[#18181B]">
                <Columns2 className="size-4" />
              </span>
              <div>
                <h1 className="text-base font-semibold text-[#18181B]">
                  Resolution demo
                </h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <ActionMorphButton
                state={resetMut.isPending ? "submitting" : "idle"}
                idleLabel="Reset demo"
                submittingLabel="Resetting…"
                variant="outline"
                size="sm"
                icon={<RotateCcw className="size-3.5" />}
                onClick={() => resetMut.mutate({ mode: "submitted" })}
              />
            </div>
          </div>

          {/* Mobile Role Switcher (< 1024px) */}
          <div
            aria-label="Demo perspective"
            className="mt-3 flex items-center gap-1 rounded-xl bg-[#F4F4F5] p-1 lg:hidden"
          >
            <button
              type="button"
              onClick={() => setMobileRole("buyer")}
              aria-pressed={mobileRole === "buyer"}
              className={cn(
                "inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition-colors",
                mobileRole === "buyer"
                  ? "bg-[#18181B] text-white"
                  : "text-[#52525B] hover:bg-white",
              )}
            >
              <ShoppingBag className="size-3.5" />
              <span>Buyer</span>
            </button>
            <button
              type="button"
              onClick={() => setMobileRole("merchant")}
              aria-pressed={mobileRole === "merchant"}
              className={cn(
                "inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition-colors",
                mobileRole === "merchant"
                  ? "bg-[#18181B] text-white"
                  : "text-[#52525B] hover:bg-white",
              )}
            >
              <Store className="size-3.5" />
              <span>Merchant</span>
            </button>
          </div>
        </div>

        {/* Side-by-Side Split Grid */}
        <div className="grid items-start gap-5 lg:grid-cols-2">
          {/* Left Pane: Buyer */}
          <div
            className={cn(
              "min-w-0 space-y-3",
              mobileRole !== "buyer" && "hidden lg:block",
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 px-1 py-1 text-[#18181B]">
              <div className="flex items-center gap-2">
                <ShoppingBag className="size-4 text-[#52525B]" />
                <h2 className="text-sm font-semibold">Buyer</h2>
              </div>
              <span className="text-xs text-[#52525B]">Maya Lin · Demo</span>
            </div>

            <ResolutionRoom
              claimId={activeClaimId}
              role="buyer"
              compact
              demoPresentation
            />
          </div>

          {/* Right Pane: Merchant */}
          <div
            className={cn(
              "min-w-0 space-y-3",
              mobileRole !== "merchant" && "hidden lg:block",
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 px-1 py-1 text-[#18181B]">
              <div className="flex items-center gap-2">
                <Store className="size-4 text-[#52525B]" />
                <h2 className="text-sm font-semibold">Merchant</h2>
              </div>
              <span className="text-xs text-[#52525B]">
                Northline Audio · Demo
              </span>
            </div>

            <ResolutionRoom
              claimId={activeClaimId}
              role="merchant"
              compact
              demoPresentation
            />
          </div>
        </div>
      </div>
    </div>
  );
}
