import { motion, useReducedMotion } from "framer-motion";
import {
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  QrCode,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

import { MOTION } from "@/lib/motion-tokens";
import { cn } from "@/lib/utils";

interface ReturnPassRevealProps {
  publicToken: string;
  claimCode: string;
  productName: string;
  merchantName: string;
  branchName: string;
  slotLabel: string;
  remedyLabel: string;
  expiresAt: string;
  invalidatedAt?: string | null;
  inspectedAt?: string | null;
  redeemedAt?: string | null;
  canVerify?: boolean;
  className?: string;
}

export function ReturnPassReveal({
  publicToken,
  claimCode,
  productName,
  merchantName,
  branchName,
  slotLabel,
  remedyLabel,
  expiresAt,
  invalidatedAt,
  inspectedAt,
  redeemedAt,
  canVerify = false,
  className,
}: ReturnPassRevealProps) {
  const reduced = useReducedMotion();
  const isRedeemed = Boolean(redeemedAt);
  const isInspected = Boolean(inspectedAt);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const delay = new Date(expiresAt).getTime() - Date.now();
    if (delay <= 0 || delay > 2_147_483_647) return;
    const timer = setTimeout(() => setNow(Date.now()), delay + 10);
    return () => clearTimeout(timer);
  }, [expiresAt]);
  const isExpired = new Date(expiresAt).getTime() <= now;
  const isActive = !invalidatedAt && !isExpired && !isRedeemed;
  const inactiveLabel = isRedeemed
    ? "Completed"
    : invalidatedAt
      ? "Cancelled"
      : "Expired";

  return (
    <motion.div
      initial={reduced ? { opacity: 1 } : { opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={MOTION.springHero}
      className={cn(
        "returnly-obsidian-grid relative min-w-0 overflow-hidden rounded-[24px] border border-[#18181B] p-4 text-white sm:p-5",
        className,
      )}
    >
      {/* Top Pass Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/15 pb-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#18181B]">
            <QrCode className="size-4.5" />
          </span>
          <div className="min-w-0">
            <span className="text-xs font-semibold text-zinc-300">
              Return Pass · #{claimCode}
            </span>
            <h3 className="break-words text-base font-semibold text-white">
              {productName} · {merchantName}
            </h3>
          </div>
        </div>

        {!isActive ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-[13px] font-bold text-[#18181B]">
            {isRedeemed ? (
              <CheckCircle2 className="size-3.5" />
            ) : invalidatedAt ? (
              <XCircle className="size-3.5" />
            ) : (
              <Clock className="size-3.5" />
            )}
            {inactiveLabel}
          </span>
        ) : isInspected ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-200 px-3 py-1 text-[13px] font-bold text-[#18181B]">
            <ShieldCheck className="size-3.5 text-[#52525B]" />
            Verified
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[13px] font-bold text-white">
            <ShieldCheck className="size-3.5" />
            Active Pass
          </span>
        )}
      </div>

      {/* Main Pass Body */}
      <div className="mt-4 flex flex-wrap items-center gap-5">
        {/* Animated SVG QR Matrix */}
        <div className="mx-auto flex shrink-0 flex-col items-center rounded-2xl bg-white p-3 text-[#18181B]">
          {isActive ? (
            <QRCodeSVG
              value={publicToken}
              size={160}
              level="M"
              marginSize={4}
              title="Return pass check-in token"
            />
          ) : (
            <p className="p-6 text-sm font-semibold">{inactiveLabel}</p>
          )}
          <span className="mt-1.5 max-w-40 break-all text-center font-mono text-[11px] font-bold tracking-wider text-[#18181B] tabular-nums">
            {isActive ? publicToken : claimCode}
          </span>
        </div>

        {/* Pass Metadata & Actions */}
        <div className="min-w-0 flex-1 basis-52 space-y-4">
          <div className="space-y-3">
            <div>
              <span className="text-xs font-medium text-zinc-300">
                Appointment
              </span>
              <p className="mt-0.5 text-[13px] font-bold text-white">
                {branchName}
              </p>
              <p className="break-words text-xs text-zinc-300">{slotLabel}</p>
            </div>

            <div>
              <span className="text-xs font-medium text-zinc-300">
                Resolution
              </span>
              <p className="mt-0.5 text-[13px] font-bold text-white">
                {remedyLabel}
              </p>
              <p className="text-xs text-zinc-300">Single-use check-in</p>
            </div>
          </div>

          {isActive ? (
            <p className="text-xs text-zinc-300">
              Expires{" "}
              {new Date(expiresAt).toLocaleString("en-GB", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Africa/Lagos",
              })}{" "}
              WAT
            </p>
          ) : null}

          {isActive ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(publicToken);
                    toast.success("Pass code copied");
                  } catch {
                    toast.error(
                      "Could not copy. Select the pass code to copy it manually.",
                    );
                  }
                }}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/20"
              >
                <Copy className="size-3.5" />
                Copy Code
              </button>

              {canVerify ? (
                <Link
                  to={`/pass/${encodeURIComponent(publicToken)}`}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-sm font-semibold text-[#18181B] transition-colors hover:bg-zinc-200"
                >
                  <ExternalLink className="size-3.5" />
                  Verify Pass
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}
