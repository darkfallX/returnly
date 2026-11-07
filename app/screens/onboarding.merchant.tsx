import { useActionMutation } from "@agent-native/core/client/hooks";
import { ArrowLeft, ArrowRight, Store } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

import { ActionMorphButton } from "@/components/returnly/ActionMorphButton";
import { markIntroSeen } from "@/lib/intro-gate";

export function meta() {
  return [{ title: "Merchant Setup - Returnly" }];
}

const fieldClass =
  "mt-2 min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-base text-zinc-900 outline-none transition-colors focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/15";

export default function OnboardingMerchantRoute() {
  const navigate = useNavigate();
  const [importDemoData, setImportDemoData] = useState(true);
  const [shopName, setShopName] = useState("Northline Audio");
  const [branchName, setBranchName] = useState("Central Branch");
  const [supportContact, setSupportContact] = useState(
    "resolve@northline-demo.local",
  );
  const [branchAddress, setBranchAddress] = useState(
    "14 Admiralty Way, Lekki Phase 1, Lagos (DEMO)",
  );
  const [returnDays, setReturnDays] = useState<number>(14);
  const [warrantyDays, setWarrantyDays] = useState<number>(365);

  const completeMut = useActionMutation("complete-onboarding", {
    onSuccess: (res) => {
      markIntroSeen("merchant");
      toast.success(res.message);
      navigate("/merchant/home", { replace: true });
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <main className="min-h-dvh bg-[#FAFAFA] px-4 py-6 text-zinc-900 sm:px-8 sm:py-12">
      <div className="mx-auto w-full max-w-2xl">
        <Link
          to="/onboarding?new=1"
          className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-zinc-600 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-900"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to onboarding
        </Link>

        <section
          className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8"
          aria-labelledby="merchant-setup-title"
        >
          <header className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-zinc-900 text-white">
              <Store className="size-5" aria-hidden="true" />
            </span>
            <h1
              id="merchant-setup-title"
              className="text-2xl font-bold tracking-tight"
            >
              Set up your store
            </h1>
          </header>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              completeMut.mutate({
                role: "merchant",
                displayName: `${shopName} Team`,
                merchantSetup: {
                  shopName,
                  category: "Consumer Audio & Electronics",
                  supportContact,
                  branchName,
                  branchAddress,
                  returnDays,
                  warrantyDays,
                  policySummary: `${returnDays}-day return or branch replacement for verified faults.`,
                  importDemoData,
                },
              });
            }}
            className="mt-7 space-y-6"
          >
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3.5">
              <input
                type="checkbox"
                checked={importDemoData}
                onChange={(event) => {
                  const demo = event.target.checked;
                  setImportDemoData(demo);
                  setShopName(demo ? "Northline Audio" : "");
                  setBranchName(demo ? "Central Branch" : "");
                  setSupportContact(demo ? "resolve@northline-demo.local" : "");
                  setBranchAddress(
                    demo ? "14 Admiralty Way, Lekki Phase 1, Lagos (DEMO)" : "",
                  );
                }}
                className="size-5 shrink-0 rounded accent-zinc-900"
              />
              <span className="text-sm font-semibold">
                Use Northline Audio demo
              </span>
            </label>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="store-name" className="text-sm font-semibold">
                  Store name
                </label>
                <input
                  id="store-name"
                  type="text"
                  autoComplete="organization"
                  required
                  value={shopName}
                  onChange={(event) => setShopName(event.target.value)}
                  className={fieldClass}
                />
              </div>
              <div>
                <label htmlFor="branch-name" className="text-sm font-semibold">
                  Branch name
                </label>
                <input
                  id="branch-name"
                  type="text"
                  required
                  value={branchName}
                  onChange={(event) => setBranchName(event.target.value)}
                  className={fieldClass}
                />
              </div>
            </div>

            {!importDemoData && (
              <div className="space-y-5">
                <div>
                  <label
                    htmlFor="store-contact"
                    className="text-sm font-semibold"
                  >
                    Support email
                  </label>
                  <input
                    id="store-contact"
                    type="email"
                    autoComplete="email"
                    required
                    value={supportContact}
                    onChange={(event) => setSupportContact(event.target.value)}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label
                    htmlFor="branch-address"
                    className="text-sm font-semibold"
                  >
                    Branch address
                  </label>
                  <input
                    id="branch-address"
                    autoComplete="street-address"
                    required
                    value={branchAddress}
                    onChange={(event) => setBranchAddress(event.target.value)}
                    className={fieldClass}
                  />
                </div>
              </div>
            )}

            <fieldset className="grid gap-5 border-t border-zinc-200 pt-5 sm:grid-cols-2">
              <legend className="px-2 text-sm font-semibold">
                Store policy
              </legend>
              <div>
                <label htmlFor="return-days" className="text-sm font-semibold">
                  Return window (days)
                </label>
                <input
                  id="return-days"
                  type="number"
                  min={0}
                  max={365}
                  value={returnDays}
                  onChange={(event) =>
                    setReturnDays(Number(event.target.value))
                  }
                  className={`${fieldClass} tabular-nums`}
                />
              </div>
              <div>
                <label
                  htmlFor="warranty-days"
                  className="text-sm font-semibold"
                >
                  Warranty (days)
                </label>
                <input
                  id="warranty-days"
                  type="number"
                  min={0}
                  max={1095}
                  value={warrantyDays}
                  onChange={(event) =>
                    setWarrantyDays(Number(event.target.value))
                  }
                  className={`${fieldClass} tabular-nums`}
                />
              </div>
            </fieldset>

            {completeMut.error && (
              <p
                role="alert"
                className="rounded-xl bg-red-50 p-3 text-sm text-red-800"
              >
                {completeMut.error.message}
              </p>
            )}

            <div className="flex sm:justify-end">
              <ActionMorphButton
                type="submit"
                state={completeMut.isPending ? "submitting" : "idle"}
                idleLabel="Open merchant workspace"
                submittingLabel="Saving…"
                variant="ink"
                size="md"
                className="w-full sm:w-auto"
                icon={<ArrowRight className="size-4" />}
              />
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
