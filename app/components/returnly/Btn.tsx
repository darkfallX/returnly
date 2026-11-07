import { ArrowRight, Loader2 } from "lucide-react";
import type React from "react";
import { Link } from "react-router";

import { cn } from "@/lib/utils";

/**
 * Returnly's one button. Styles live in `app/styles/buttons.css`
 * (Magic UI + Uiverse patterns, adapted to Returnly's paper/ink palette).
 *
 * - `variant`: primary (lime) · secondary · soft · light (on dark)
 * - `icon`: rendered inside a round chip on the right. Defaults to an arrow.
 *   Pass `icon={null}` for a text-only pill.
 * - `to` renders a router Link; otherwise a <button>.
 */
export type BtnVariant = "primary" | "secondary" | "soft" | "light";
export type BtnSize = "sm" | "md" | "lg";

interface BtnProps {
  children: React.ReactNode;
  variant?: BtnVariant;
  size?: BtnSize;
  icon?: React.ReactNode | null;
  to?: string;
  onClick?: (event: React.MouseEvent) => void;
  type?: "button" | "submit";
  disabled?: boolean;
  loading?: boolean;
  pulse?: boolean;
  block?: boolean;
  className?: string;
  "aria-label"?: string;
  title?: string;
}

export function Btn({
  children,
  variant = "primary",
  size = "md",
  icon,
  to,
  onClick,
  type = "button",
  disabled,
  loading,
  pulse,
  block,
  className,
  title,
  "aria-label": ariaLabel,
}: BtnProps) {
  const chipContent = loading ? (
    <Loader2 className="animate-spin" />
  ) : icon === undefined ? (
    <ArrowRight />
  ) : (
    icon
  );
  const hasChip = chipContent !== null;
  const classes = cn(
    "rl-btn",
    `rl-btn-${variant}`,
    `rl-btn-${size}`,
    !hasChip && "rl-btn-noicon",
    block && "rl-btn-block",
    pulse && !disabled && "rl-pulse",
    className,
  );
  const inner = (
    <>
      {pulse && !disabled ? (
        <span className="rl-pulse-ring" aria-hidden="true" />
      ) : null}
      <span>{children}</span>
      {hasChip ? (
        <span className="rl-btn-chip" aria-hidden="true">
          {chipContent}
        </span>
      ) : null}
    </>
  );

  if (to && !disabled && !loading) {
    return (
      <Link
        to={to}
        className={classes}
        aria-label={ariaLabel}
        title={title}
        onClick={onClick}
      >
        {inner}
      </Link>
    );
  }
  return (
    <button
      type={type}
      className={classes}
      onClick={onClick}
      disabled={Boolean(disabled || loading)}
      aria-busy={loading || undefined}
      aria-label={ariaLabel}
      title={title}
    >
      {inner}
    </button>
  );
}

/** Big icon-first choice card. */
export function Tile({
  icon,
  title,
  hint,
  to,
  onClick,
  dark,
  className,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  to?: string;
  onClick?: () => void;
  dark?: boolean;
  className?: string;
  disabled?: boolean;
}) {
  const body = (
    <>
      <span className="flex items-start justify-between">
        <span className="rl-tile-icon">{icon}</span>
        <ArrowRight className="size-4 opacity-40" aria-hidden="true" />
      </span>
      <span>
        <span className="block text-[17px] font-extrabold tracking-tight">
          {title}
        </span>
        {hint ? (
          <span
            className={cn(
              "mt-0.5 block text-[12px] font-medium",
              dark ? "text-white/60" : "text-[#71717A]",
            )}
          >
            {hint}
          </span>
        ) : null}
      </span>
    </>
  );
  const classes = cn("rl-tile", dark && "rl-tile-dark", className);
  if (to && !disabled) {
    return (
      <Link to={to} className={classes}>
        {body}
      </Link>
    );
  }
  return (
    <button
      type="button"
      className={classes}
      onClick={onClick}
      disabled={disabled}
    >
      {body}
    </button>
  );
}
