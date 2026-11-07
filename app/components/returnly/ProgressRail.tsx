import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";

import { MOTION } from "@/lib/motion-tokens";
import { cn } from "@/lib/utils";

export interface RailStep {
  id: string;
  label: string;
}

export const CLAIM_LIFECYCLE_STEPS: RailStep[] = [
  { id: "submitted", label: "Submitted" },
  { id: "under_review", label: "Review" },
  { id: "awaiting_evidence", label: "Evidence" },
  { id: "offered", label: "Offer" },
  { id: "agreed", label: "Agreed" },
  { id: "appointment_confirmed", label: "QR Pass" },
  { id: "fulfilled", label: "Handover" },
  { id: "completed", label: "Done" },
];

const STATUS_INDEX: Record<string, number> = {
  draft: -1,
  submitted: 0,
  under_review: 1,
  awaiting_evidence: 2,
  offered: 3,
  offer_pending: 3,
  agreed: 4,
  appointment_confirmed: 5,
  inspection: 5,
  fulfilled: 6,
  completed: 7,
  closed: 7,
};

interface ProgressRailProps {
  status: string;
  lastChangedBy?: string;
  compact?: boolean;
  className?: string;
}

export function ProgressRail({
  status,
  compact = false,
  className,
}: ProgressRailProps) {
  const reduced = useReducedMotion();
  const activeIdx = STATUS_INDEX[status] ?? 0;

  return (
    <ol
      aria-label="Claim progress"
      className={cn(
        "grid grid-cols-4 gap-x-2 gap-y-3 rounded-2xl border border-[#E4E4E7] bg-white p-3",
        !compact && "xl:grid-cols-8",
        className,
      )}
    >
      {CLAIM_LIFECYCLE_STEPS.map((step, idx) => {
        const isCompletedState = status === "completed" || status === "closed";
        const isDone = idx < activeIdx || isCompletedState;
        const isCurrent = idx === activeIdx && !isCompletedState;
        return (
          <motion.li
            key={step.id}
            aria-current={isCurrent ? "step" : undefined}
            layout={!reduced}
            transition={MOTION.springSoft}
            className={cn(
              "flex min-w-0 flex-col items-center gap-1.5 border-t-2 pt-2 text-center transition-colors",
              isCurrent
                ? "border-[#18181B] text-[#18181B]"
                : isDone
                  ? "border-[#A1A1AA] text-[#3F3F46]"
                  : "border-[#E4E4E7] text-[#52525B]",
            )}
          >
            <span
              className={cn(
                "inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums",
                isCurrent
                  ? "bg-[#18181B] text-white"
                  : isDone
                    ? "bg-[#18181B] text-white"
                    : "bg-[#F4F4F5] text-[#52525B]",
              )}
            >
              {isDone ? <Check className="size-2.5 stroke-[2.5]" /> : idx + 1}
            </span>
            <span className="text-[11px] font-semibold leading-tight">
              {step.label}
            </span>
          </motion.li>
        );
      })}
    </ol>
  );
}
