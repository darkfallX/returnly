import { motion, useReducedMotion } from "framer-motion";
import { Coins } from "lucide-react";
import { useState } from "react";

import { formatMoneyMinor, MOTION } from "@/lib/motion-tokens";
import { cn } from "@/lib/utils";

import { ActionMorphButton } from "./ActionMorphButton";

interface RefundOfferSliderProps {
  purchaseAmountMinor: number;
  currencyCode?: string;
  initialPercent?: number;
  maxPolicyPercent?: number;
  role: "buyer" | "merchant";
  isPending?: boolean;
  onSubmitPercent: (percent: number, note: string) => void;
  className?: string;
}

const PRESET_PERCENTS = [15, 20, 25, 30, 35];

export function RefundOfferSlider({
  purchaseAmountMinor,
  currencyCode = "NGN",
  initialPercent = 25,
  maxPolicyPercent = 35,
  role,
  isPending = false,
  onSubmitPercent,
  className,
}: RefundOfferSliderProps) {
  const reduced = useReducedMotion();
  const [percent, setPercent] = useState<number>(initialPercent);
  const [note, setNote] = useState<string>(
    role === "buyer"
      ? "Keep item with partial credit"
      : "Keep-item partial credit",
  );

  const computedMinor = Math.round((purchaseAmountMinor * percent) / 100);
  const withinAutoBand = percent <= maxPolicyPercent;

  return (
    <div
      className={cn(
        "rounded-2xl border border-[#E4E4E7] bg-[#FAFAFA] p-4",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-7 items-center justify-center rounded-lg bg-[#18181B] text-white">
            <Coins className="size-3.5" />
          </span>
          <h4 className="text-[13px] font-bold text-[#18181B]">
            Partial Refund
          </h4>
        </div>
        <span className="rounded-full border border-[#E4E4E7] bg-white px-2.5 py-0.5 text-[11px] font-semibold text-[#52525B]">
          {withinAutoBand ? `≤ ${maxPolicyPercent}% policy` : "Owner review"}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <motion.div
          key={computedMinor}
          initial={reduced ? { opacity: 1 } : { scale: 0.96, opacity: 0.7 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={MOTION.springSnappy}
          className="flex items-baseline gap-2"
        >
          <span className="text-2xl font-extrabold tracking-tight text-[#18181B] tabular-nums">
            {formatMoneyMinor(computedMinor, currencyCode)}
          </span>
          <span className="rounded-full bg-[#18181B] px-2 py-0.5 text-[11px] font-bold text-white tabular-nums">
            {percent}%
          </span>
        </motion.div>

        <div className="flex flex-wrap gap-1">
          {PRESET_PERCENTS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setPercent(preset)}
              className={cn(
                "rounded-full px-2.5 py-1 text-[13px] font-bold tabular-nums transition-colors",
                percent === preset
                  ? "bg-[#18181B] text-white"
                  : "bg-white text-[#18181B] border border-[#E4E4E7] hover:bg-[#F4F4F5]",
              )}
            >
              {preset}%
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3">
        <input
          id="partial-refund-range"
          type="range"
          min={10}
          max={50}
          step={5}
          value={percent}
          onChange={(e) => setPercent(Number(e.target.value))}
          aria-label="Partial refund percentage"
          className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-[#E4E4E7] accent-[#18181B]"
        />
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note"
          className="flex-1 rounded-full border border-[#E4E4E7] bg-white px-3.5 py-1.5 text-[13px] text-[#18181B] focus:border-[#18181B] focus:outline-none"
        />
        <ActionMorphButton
          state={isPending ? "submitting" : "idle"}
          idleLabel={
            role === "buyer" ? `Counter ${percent}%` : `Offer ${percent}%`
          }
          submittingLabel="Saving…"
          variant="ink"
          size="sm"
          onClick={() => onSubmitPercent(percent, note)}
        />
      </div>
    </div>
  );
}
