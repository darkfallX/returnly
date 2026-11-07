import {
  useActionMutation,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import { useSendToAgentChat } from "@agent-native/toolkit/app/chat/composer/use-send-to-agent-chat";
import { useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import {
  Columns2,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  UserCheck,
  UserPlus,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router";
import { toast } from "sonner";

import { MOTION } from "@/lib/motion-tokens";
import { cn } from "@/lib/utils";

export function WorkspaceModeSwitcher() {
  const location = useLocation();
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const queryClient = useQueryClient();
  const { send: sendToAgent } = useSendToAgentChat();

  const { data: viewer } = useActionQuery("get-viewer-context", {});

  const switchAccountMut = useActionMutation("switch-viewer-account", {
    onSuccess: (res) => {
      void queryClient.invalidateQueries();
      toast.success(res.message);
    },
    onError: (err) => toast.error(err.message),
  });

  const resetMutation = useActionMutation("reset-demo-scenario", {
    onSuccess: (res) => {
      void queryClient.invalidateQueries();
      toast.success(res.message);
    },
  });

  const pathname = location.pathname;
  const activeMode =
    pathname.startsWith("/merchant") || pathname.startsWith("/pass")
      ? "merchant"
      : pathname.startsWith("/demo")
        ? "demo"
        : pathname.startsWith("/buyer")
          ? "buyer"
          : "onboarding";

  const activeEmail = viewer?.email || "maya.demo@returnly.local";

  return (
    <div className="returnly-mode-switcher pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-3">
      <motion.div
        layout={!reduced}
        transition={MOTION.springSnappy}
        className="pointer-events-auto flex flex-wrap items-center gap-1.5 rounded-full border border-zinc-800 bg-[#18181B]/95 px-2.5 py-1.5 text-white shadow-[0_18px_45px_-12px_rgba(24,24,27,0.55)] backdrop-blur-md"
      >
        <span
          title={`Signed in as ${activeEmail} - server-side RBAC enforced per account`}
          className="hidden items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-zinc-200 md:inline-flex"
        >
          <ShieldCheck className="size-3 text-white" />
          <span className="max-w-[140px] truncate">
            {viewer?.user?.displayName || activeEmail}
          </span>
        </span>

        {/* Buyer Account (Maya Lin) */}
        <button
          type="button"
          disabled={switchAccountMut.isPending}
          onClick={() => {
            switchAccountMut.mutate(
              { email: "maya.demo@returnly.local", role: "buyer" },
              {
                onSuccess: () => navigate("/buyer/home"),
              },
            );
          }}
          className={cn(
            "relative inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-bold transition-colors",
            activeMode === "buyer" && activeEmail === "maya.demo@returnly.local"
              ? "bg-white text-[#18181B]"
              : "text-white/80 hover:bg-white/10 hover:text-white",
          )}
        >
          <ShoppingBag className="size-3.5" />
          <span>Buyer</span>
        </button>

        {/* Merchant Staff Account (Northline Support) */}
        <button
          type="button"
          disabled={switchAccountMut.isPending}
          onClick={() => {
            switchAccountMut.mutate(
              { email: "resolve@northline-demo.local", role: "merchant" },
              {
                onSuccess: () => navigate("/merchant/home"),
              },
            );
          }}
          className={cn(
            "relative inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-bold transition-colors",
            activeMode === "merchant"
              ? "bg-white text-[#18181B]"
              : "text-white/80 hover:bg-white/10 hover:text-white",
          )}
        >
          <Store className="size-3.5" />
          <span>Merchant</span>
        </button>

        {/* Isolated 2nd Buyer Account (Alex Rivera) */}
        <button
          type="button"
          disabled={switchAccountMut.isPending}
          onClick={() => {
            switchAccountMut.mutate(
              { email: "alex.outsider@returnly.local", role: "buyer" },
              {
                onSuccess: () => navigate("/buyer/vault"),
              },
            );
          }}
          title="Switch to isolated 2nd buyer account (Alex Rivera) to verify cross-account data isolation"
          className={cn(
            "hidden items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-bold transition-colors sm:inline-flex",
            activeEmail === "alex.outsider@returnly.local"
              ? "bg-white text-[#18181B]"
              : "text-white/70 hover:bg-white/10 hover:text-white",
          )}
        >
          <UserCheck className="size-3.5" />
          <span>2nd Buyer</span>
        </button>

        {/* Split Demo View */}
        <Link
          to="/demo"
          className={cn(
            "relative inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-bold transition-colors",
            activeMode === "demo"
              ? "bg-white text-[#18181B]"
              : "text-white/80 hover:bg-white/10 hover:text-white",
          )}
        >
          <Columns2 className="size-3.5" />
          <span>Split</span>
        </Link>

        <div className="mx-0.5 h-4 w-px bg-white/15" />

        <button
          type="button"
          onClick={() => {
            const prompt =
              activeMode === "merchant"
                ? "Inspect the active Northline Audio claim on screen, run policy & stock triage if needed, and summarize recommended next actions."
                : "Inspect my Purchase Vault and active claims on screen, and help me prepare or advance my resolution.";
            void sendToAgent({ message: prompt });
          }}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[13px] font-bold text-white transition-colors hover:bg-white hover:text-[#18181B]"
        >
          <Sparkles className="size-3.5" />
          <span className="hidden sm:inline">Assistant</span>
          <span className="sm:hidden">AI</span>
        </button>

        <button
          type="button"
          disabled={resetMutation.isPending}
          onClick={() => {
            resetMutation.mutate(
              { mode: "submitted" },
              {
                onSuccess: () => {
                  if (
                    pathname !== "/demo" &&
                    !pathname.startsWith("/merchant") &&
                    !pathname.startsWith("/buyer")
                  ) {
                    navigate("/demo");
                  }
                },
              },
            );
          }}
          title="Reset the seeded Maya Lin + Northline Audio scenario"
          aria-label="Reset demo scenario"
          className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold text-white/85 transition-colors hover:bg-white/15 disabled:opacity-50"
        >
          <RotateCcw
            className={cn(
              "size-3.5",
              resetMutation.isPending && "animate-spin",
            )}
          />
        </button>

        <Link
          to="/onboarding?new=1"
          title="Register a new account & view welcome onboarding"
          aria-label="New account"
          className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold text-white/85 transition-colors hover:bg-white/15"
        >
          <UserPlus className="size-3.5" />
        </Link>
      </motion.div>
    </div>
  );
}
