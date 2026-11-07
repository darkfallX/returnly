import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import type React from "react";

import { MOTION } from "@/lib/motion-tokens";
import { cn } from "@/lib/utils";

export type MorphButtonState =
  | "idle"
  | "submitting"
  | "awaiting_approval"
  | "committed"
  | "failed";

interface ActionMorphButtonProps {
  state: MorphButtonState;
  idleLabel: string;
  submittingLabel?: string | undefined;
  awaitingLabel?: string | undefined;
  committedLabel?: string | undefined;
  failedLabel?: string | undefined;
  onClick?: (() => void) | undefined;
  disabled?: boolean | undefined;
  variant?: "lime" | "ink" | "outline" | "teal" | undefined;
  size?: "sm" | "md" | "lg" | undefined;
  className?: string | undefined;
  icon?: React.ReactNode | undefined;
  type?: "button" | "submit" | undefined;
}

export function ActionMorphButton({
  state,
  idleLabel,
  submittingLabel = "Processing…",
  awaitingLabel = "Awaiting approval…",
  committedLabel = "Confirmed",
  failedLabel = "Try again",
  onClick,
  disabled,
  variant = "lime",
  size = "md",
  className,
  icon,
  type = "button",
}: ActionMorphButtonProps) {
  const reduced = useReducedMotion();

  // Keep the same readable variants for direct actions and mutation states.
  const settled = state === "committed" || state === "failed";
  const variantClasses = settled
    ? "rl-btn border"
    : variant === "outline"
      ? "rl-btn rl-btn-secondary"
      : variant === "ink"
        ? "rl-btn rl-btn-ink"
        : variant === "teal"
          ? "rl-btn rl-btn-teal"
          : "rl-btn rl-btn-primary";

  const sizeClasses = {
    sm: "min-h-11 px-4 py-2 text-[13px]",
    md: "min-h-11 px-5 py-2.5 text-sm",
    lg: "min-h-14 px-7 py-3 text-base",
  }[size];

  const activeLabel =
    state === "submitting"
      ? submittingLabel
      : state === "awaiting_approval"
        ? awaitingLabel
        : state === "committed"
          ? committedLabel
          : state === "failed"
            ? failedLabel
            : idleLabel;

  return (
    <motion.button
      type={type}
      aria-busy={state === "submitting"}
      aria-live="polite"
      layout={!reduced}
      whileTap={reduced || disabled ? { scale: 1 } : { scale: 0.98 }}
      transition={MOTION.springSnappy}
      onClick={onClick}
      disabled={Boolean(disabled || state === "submitting")}
      className={cn(
        "relative inline-flex max-w-full items-center justify-center gap-2 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        variantClasses,
        sizeClasses,
        state === "failed" &&
          "border-[#D5544A] bg-[#D5544A]/10 text-[#A1362E] hover:bg-[#D5544A]/15",
        state === "committed" && "bg-[#F4F4F5] border-[#D4D4D8] text-[#18181B]",
        className,
      )}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={state}
          initial={reduced ? { opacity: 1 } : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
          transition={{ duration: reduced ? 0 : MOTION.durationFast }}
          className="inline-flex min-w-0 items-center justify-center gap-2 [&>svg]:shrink-0"
        >
          {state === "submitting" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : state === "committed" ? (
            <Check className="size-4 stroke-[2.5]" />
          ) : state === "failed" ? (
            <AlertCircle className="size-4" />
          ) : (
            icon
          )}
          <span>{activeLabel}</span>
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}
