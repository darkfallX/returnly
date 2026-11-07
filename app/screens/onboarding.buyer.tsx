import {
  useActionMutation,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import { ArrowLeft, ArrowRight, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

import { ActionMorphButton } from "@/components/returnly/ActionMorphButton";
import { markIntroSeen } from "@/lib/intro-gate";

export function meta() {
  return [{ title: "Buyer Setup - Returnly" }];
}

const fieldClass =
  "mt-2 min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-base text-zinc-900 outline-none transition-colors focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/15";

export default function OnboardingBuyerRoute() {
  const navigate = useNavigate();
  const { data: viewer } = useActionQuery("get-viewer-context", {});
  const [displayName, setDisplayName] = useState(
    viewer?.user?.displayName || "",
  );
  const [preferredCurrency, setPreferredCurrency] = useState(
    viewer?.user?.preferredCurrency || "NGN",
  );

  const completeMut = useActionMutation("complete-onboarding", {
    onSuccess: (res) => {
      markIntroSeen("buyer");
      toast.success(res.message);
      navigate("/buyer/home", { replace: true });
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <main className="min-h-dvh bg-[#FAFAFA] px-4 py-6 text-zinc-900 sm:px-8 sm:py-12">
      <div className="mx-auto w-full max-w-lg">
        <Link
          to="/onboarding?new=1"
          className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-zinc-600 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-900"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to onboarding
        </Link>

        <section
          className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8"
          aria-labelledby="buyer-setup-title"
        >
          <header className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-zinc-900 text-white">
              <ShoppingBag className="size-5" aria-hidden="true" />
            </span>
            <h1
              id="buyer-setup-title"
              className="text-2xl font-bold tracking-tight"
            >
              Set up your account
            </h1>
          </header>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              completeMut.mutate({
                role: "buyer",
                displayName,
                preferredCurrency,
                notificationsOptIn: true,
              });
            }}
            className="mt-7 space-y-5"
          >
            <div>
              <label
                htmlFor="buyer-display-name"
                className="text-sm font-semibold"
              >
                Display name
              </label>
              <input
                id="buyer-display-name"
                autoComplete="name"
                type="text"
                required
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className={fieldClass}
              />
            </div>

            <div>
              <label htmlFor="buyer-currency" className="text-sm font-semibold">
                Currency
              </label>
              <select
                id="buyer-currency"
                value={preferredCurrency}
                onChange={(event) => setPreferredCurrency(event.target.value)}
                className={fieldClass}
              >
                <option value="NGN">NGN (₦)</option>
                <option value="USD">USD ($)</option>
              </select>
            </div>

            {completeMut.error && (
              <p
                role="alert"
                className="rounded-xl bg-red-50 p-3 text-sm text-red-800"
              >
                {completeMut.error.message}
              </p>
            )}

            <ActionMorphButton
              type="submit"
              state={completeMut.isPending ? "submitting" : "idle"}
              idleLabel="Open buyer workspace"
              submittingLabel="Opening…"
              variant="ink"
              size="md"
              className="w-full"
              icon={<ArrowRight className="size-4" />}
            />
          </form>
        </section>
      </div>
    </main>
  );
}
