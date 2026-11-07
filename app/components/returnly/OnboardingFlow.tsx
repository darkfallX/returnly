import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  Columns2,
  Receipt,
  ShoppingBag,
  Store,
  Wrench,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";

import { Btn, Tile } from "./Btn";
import { OnboardingIllustration } from "./OnboardingIllustration";

type Step = 0 | 1 | 2;
const steps = ["Welcome", "How it works", "Workspace"] as const;
const titles = [
  "We can help you resolve this.",
  "How resolution works",
  "Choose your workspace",
] as const;

const workflow = [
  {
    Icon: Receipt,
    label: "Report the item",
    meta: "Select your purchase and describe the fault.",
  },
  {
    Icon: Camera,
    label: "Store review",
    meta: "Store checks warranty, policy, and replacement stock.",
  },
  {
    Icon: Wrench,
    label: "Approve & get pass",
    meta: "Approve the offer, reserve a slot, and get your QR check-in pass.",
  },
] as const;

export function OnboardingFlow({
  onDemo,
  demoPending = false,
}: {
  onDemo: () => void;
  demoPending?: boolean;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const [step, setStep] = useState<Step>(0);
  const [reached, setReached] = useState<Step>(0);
  const [activeWorkflowStage, setActiveWorkflowStage] = useState<number>(0);

  function next() {
    const target = Math.min(2, step + 1) as Step;
    setReached((previous) => Math.max(previous, target) as Step);
    setStep(target);
  }

  return (
    <div className="onboarding-page onboarding-simple">
      <header className="onboarding-header">
        <Link to="/" className="returnly-wordmark" aria-label="Returnly">
          <span>
            <ArrowLeft className="size-4" />
          </span>
          returnly<span className="wordmark-period">.</span>
        </Link>
      </header>
      <main className="onboarding-layout">
        <div className="onboarding-copy">
          <nav className="onboarding-progress" aria-label="Onboarding steps">
            {steps.map((label, index) => (
              <button
                key={label}
                type="button"
                className={`onboarding-step ${index === step ? "is-active" : ""}`}
                disabled={!ready || index > reached}
                aria-current={step === index ? "step" : undefined}
                onClick={() => setStep(index as Step)}
              >
                <span>
                  {index < step ? <Check className="size-3" /> : index + 1}
                </span>
                {label}
              </button>
            ))}
          </nav>
          <section
            key={step}
            className="onboarding-story onboarding-step-enter"
            aria-labelledby="onboarding-title"
          >
            <h1 id="onboarding-title" className="onboarding-title">
              {titles[step]}
            </h1>
            {step === 0 ? (
              <p className="mt-4 max-w-[38ch] text-base leading-relaxed text-[#52525B]">
                Report a faulty purchase. Review the store’s offer. Choose what
                works for you.
              </p>
            ) : step === 1 ? (
              <ol className="mt-6 space-y-2.5">
                {workflow.map(({ Icon, label, meta }, index) => {
                  const active = activeWorkflowStage === index;
                  return (
                    <li key={label}>
                      <button
                        type="button"
                        aria-pressed={active}
                        onMouseEnter={() => setActiveWorkflowStage(index)}
                        onFocus={() => setActiveWorkflowStage(index)}
                        onClick={() => setActiveWorkflowStage(index)}
                        className={`flex w-full cursor-pointer items-center gap-3.5 rounded-[20px] border p-3.5 text-left transition-colors ${
                          active
                            ? "border-[#18181B] bg-white shadow-xs"
                            : "border-[#E4E4E7] bg-white/60 hover:border-[#A1A1AA]"
                        }`}
                      >
                        <span
                          className={`inline-grid size-10 shrink-0 place-items-center rounded-xl transition-colors ${
                            active
                              ? "bg-[#18181B] text-white"
                              : "bg-[#F4F4F5] text-[#18181B]"
                          }`}
                        >
                          <Icon className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <h2 className="text-[14px] font-bold text-[#18181B]">
                            {label}
                          </h2>
                          <p className="mt-1 text-[13px] leading-relaxed text-[#52525B]">
                            {meta}
                          </p>
                        </div>
                        <span
                          className="ml-auto shrink-0 text-xs font-semibold text-[#52525B]"
                          aria-hidden="true"
                        >
                          0{index + 1}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <div className="mt-6 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Tile
                    to="/onboarding/buyer"
                    icon={<ShoppingBag className="size-5" />}
                    title="Buyer"
                    dark
                  />
                  <Tile
                    to="/onboarding/merchant"
                    icon={<Store className="size-5" />}
                    title="Merchant"
                  />
                </div>
                <button
                  type="button"
                  className="rl-btn rl-btn-secondary rl-btn-md rl-btn-block w-full"
                  disabled={!ready || demoPending}
                  aria-busy={demoPending}
                  onClick={onDemo}
                >
                  <Columns2 className="size-4" />
                  <span>{demoPending ? "Opening demo…" : "Try demo"}</span>
                  <ArrowRight className="size-4" />
                </button>
              </div>
            )}
          </section>
          <div className="onboarding-navigation">
            {step > 0 && (
              <Btn
                variant="soft"
                icon={<ArrowLeft className="size-4" />}
                onClick={() => setStep((step - 1) as Step)}
              >
                Back
              </Btn>
            )}
            {step < 2 && (
              <Btn size="lg" disabled={!ready} onClick={next}>
                {step === 0 ? "Get started" : "Continue"}
              </Btn>
            )}
          </div>
        </div>
        <div className="onboarding-art" aria-hidden="true">
          <OnboardingIllustration
            step={step}
            activeWorkflowStage={activeWorkflowStage}
          />
        </div>
      </main>
    </div>
  );
}
