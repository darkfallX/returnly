import {
  useActionMutation,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import { useSendToAgentChat } from "@agent-native/toolkit/app/chat/composer/use-send-to-agent-chat";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock,
  Eye,
  EyeOff,
  FileText,
  Film,
  Image as ImageIcon,
  MessageSquare,
  Percent,
  QrCode,
  Send,
  ShieldCheck,
  Store,
  Upload,
  UserCheck,
  Video,
  XCircle,
} from "lucide-react";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";

import {
  CLAIM_STATUS_LABELS,
  formatMoneyMinor,
  formatRelativeDate,
  LOGISTICS_LABELS,
  MOTION,
  REMEDY_LABELS,
} from "@/lib/motion-tokens";
import { cn } from "@/lib/utils";

import { formatAppointmentWindow } from "../../../shared/appointment-time";
import { ActionMorphButton } from "./ActionMorphButton";
import { BranchMapStage } from "./BranchMapStage";
import { ProgressRail } from "./ProgressRail";
import { RefundOfferSlider } from "./RefundOfferSlider";
import { ReturnPassReveal } from "./ReturnPassReveal";

interface ResolutionRoomProps {
  claimId: string;
  role: "buyer" | "merchant";
  compact?: boolean;
  demoPresentation?: boolean;
}

export function ResolutionRoom({
  claimId,
  role,
  compact = false,
  demoPresentation = false,
}: ResolutionRoomProps) {
  const reduced = useReducedMotion();
  const noteInputId = useId();
  const fileUploadId = useId();
  const auditLogId = useId();
  const { send: sendToAgent, codeRequiredDialog } = useSendToAgentChat();

  const demoActorRole = demoPresentation ? role : undefined;

  const {
    data: detail,
    isLoading,
    error,
    refetch,
  } = useActionQuery("get-claim", {
    id: claimId,
    ...(demoActorRole ? { demoActorRole } : {}),
  });

  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [selectedSlotId, setSelectedSlotId] = useState<string>("");
  const [messageDraft, setMessageDraft] = useState<string>("");
  const [evidenceNote, setEvidenceNote] = useState("");
  const [evidenceKind, setEvidenceKind] = useState<
    "diagnostic_note" | "photo" | "video" | "receipt"
  >("diagnostic_note");
  const [uploadedDataUrl, setUploadedDataUrl] = useState<string>("");
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const [uploadedMimeType, setUploadedMimeType] = useState<string>("");
  const [discloseUpload, setDiscloseUpload] = useState<boolean>(true);
  const [showPartialRefundBuilder, setShowPartialRefundBuilder] =
    useState<boolean>(false);
  const [showAuditLog, setShowAuditLog] = useState<boolean>(false);

  useEffect(() => {
    if (!detail) return;
    if (!selectedBranchId) {
      const defaultBranch =
        detail.activeOffer?.branchId ||
        detail.claim?.preferredBranchId ||
        detail.branches?.[0]?.id ||
        "";
      setSelectedBranchId(defaultBranch);
    }
    if (!selectedSlotId) {
      const defaultSlot =
        detail.activeOffer?.slotId ||
        detail.claim?.preferredSlotId ||
        detail.branches?.[0]?.slots?.[0]?.id ||
        "";
      setSelectedSlotId(defaultSlot);
    }
  }, [detail, selectedBranchId, selectedSlotId]);

  const submitClaimMut = useActionMutation("submit-claim", {
    onSuccess: (res) => toast.success(res.message),
    onError: (err) => toast.error(err.message),
  });

  const triageMut = useActionMutation("triage-merchant-claim", {
    onSuccess: (res) =>
      toast.success("Triage complete: " + res.policyMatch.toUpperCase()),
    onError: (err) => toast.error(err.message),
  });

  const requestEvidenceMut = useActionMutation("request-evidence", {
    onSuccess: (res) => toast.success(res.message),
    onError: (err) => toast.error(err.message),
  });

  const addEvidenceMut = useActionMutation("add-claim-evidence", {
    onSuccess: (res) => {
      setEvidenceNote("");
      setUploadedDataUrl("");
      setUploadedFileName("");
      setEvidenceKind("diagnostic_note");
      toast.success(res.message);
    },
    onError: (err) => toast.error(err.message),
  });

  const disclosureMut = useActionMutation("set-evidence-disclosure", {
    onSuccess: (res) => toast.success(res.message),
    onError: (err) => toast.error(err.message),
  });

  const proposeMut = useActionMutation("propose-resolution", {
    onSuccess: (res) => {
      toast.success(res.message);
      setShowPartialRefundBuilder(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const counterMut = useActionMutation("counter-resolution", {
    onSuccess: (res) => {
      toast.success(res.message);
      setShowPartialRefundBuilder(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const acceptMut = useActionMutation("accept-resolution", {
    onSuccess: (res) => toast.success(res.message),
    onError: (err) => toast.error(err.message),
  });

  const reserveMut = useActionMutation("confirm-slot-and-reserve", {
    onSuccess: (res) => toast.success(res.message),
    onError: (err) => toast.error(err.message),
  });

  const cancelReservationMut = useActionMutation("cancel-reservation", {
    onSuccess: (res) => toast.success(res.message),
    onError: (err) => toast.error(err.message),
  });

  const verifyPassMut = useActionMutation("verify-return-pass", {
    onSuccess: (res) => toast.success(res.message),
    onError: (err) => toast.error(err.message),
  });

  const handoverMut = useActionMutation("record-handover", {
    onSuccess: (res) => toast.success(res.message),
    onError: (err) => toast.error(err.message),
  });

  const confirmReceivedMut = useActionMutation("confirm-resolution-received", {
    onSuccess: (res) => toast.success(res.message),
    onError: (err) => toast.error(err.message),
  });

  const sendMessageMut = useActionMutation("send-case-message", {
    onSuccess: () => {
      setMessageDraft("");
      toast.success("Message sent");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleEvidenceFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Please select a file under 4 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setUploadedDataUrl(reader.result);
        setUploadedFileName(file.name);
        setUploadedMimeType(file.type || "application/octet-stream");
        if (file.type.startsWith("video/")) {
          setEvidenceKind("video");
        } else if (file.type === "application/pdf") {
          setEvidenceKind("receipt");
        } else {
          setEvidenceKind("photo");
        }
        if (!evidenceNote.trim()) {
          setEvidenceNote(`Uploaded ${file.name} for inspection.`);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  if (isLoading) {
    return (
      <div role="status" aria-label="Loading claim" className="space-y-4">
        <div className="h-24 animate-pulse rounded-[24px] bg-[#E4E4E7]/60" />
        <div className={cn("grid gap-4", !compact && "lg:grid-cols-2")}>
          <div className="h-60 animate-pulse rounded-[24px] bg-[#E4E4E7]/60" />
          <div className="h-60 animate-pulse rounded-[24px] bg-[#E4E4E7]/60" />
        </div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="rounded-[24px] border border-[#E4E4E7] bg-white p-6 text-center">
        <AlertTriangle className="mx-auto size-7 text-[#52525B]" />
        <h3
          role="alert"
          className="mt-2 break-words text-sm font-bold text-[#18181B]"
        >
          {error instanceof Error ? error.message : "Claim not found"}
        </h3>
        <ActionMorphButton
          className="mt-4"
          idleLabel="Try again"
          state="idle"
          variant="outline"
          onClick={() => void refetch()}
        />
      </div>
    );
  }

  const {
    claim,
    purchase,
    merchant,
    coverage,
    evidence = [],
    latestTriage,
    messages = [],
    activeOffer,
    branches = [],
    reservation,
    returnPass,
    events = [],
  } = detail;

  const statusMeta = CLAIM_STATUS_LABELS[claim.status] ?? {
    label: claim.status,
    tone: "neutral",
    description: "",
  };

  const pickupChoice = branches
    .flatMap((branch: any) =>
      branch.slots.map((slot: any) => ({ branchId: branch.id, slot })),
    )
    .find(
      ({ slot }: any) =>
        slot.serviceType === "pickup" &&
        Date.parse(slot.startAt) > Date.now() &&
        slot.reservedCount < slot.capacity,
    );

  const hasVideoEvidence = evidence.some(
    (e: any) => e.mediaKind === "video" && Boolean(e.attachmentId),
  );
  const isCompleted = claim.status === "closed" || claim.status === "completed";
  const CaseHeading = compact ? "h2" : "h1";

  return (
    <div className="min-w-0 space-y-4">
      {codeRequiredDialog}

      {/* Compact Case Header Card */}
      <motion.div
        layout={!reduced}
        transition={MOTION.springSoft}
        className="overflow-hidden rounded-[24px] border border-[#E4E4E7] bg-white p-4 shadow-xs sm:p-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#18181B] px-2.5 py-0.5 font-mono text-[13px] font-bold text-white">
                #{claim.claimCode}
              </span>
              <span className="rounded-full border border-[#E4E4E7] bg-[#F4F4F5] px-2.5 py-0.5 text-[13px] font-bold text-[#18181B]">
                {statusMeta.label}
              </span>
            </div>

            <CaseHeading className="mt-2 break-words text-lg font-semibold tracking-tight text-[#18181B] sm:text-xl">
              {purchase?.productName ?? "Purchase"}
            </CaseHeading>
            <p className="mt-1 break-words text-sm text-[#52525B]">
              {claim.issueTitle}
            </p>
          </div>

          <div className="shrink-0 pt-0.5">
            <span
              aria-label="Purchase price"
              className="text-base font-semibold text-[#18181B] tabular-nums"
            >
              {formatMoneyMinor(purchase?.amountMinor, purchase?.currencyCode)}
            </span>
          </div>
        </div>

        <details className="mt-3 border-t border-[#E4E4E7] text-sm text-[#52525B]">
          <summary className="min-h-11 cursor-pointer py-3 font-medium text-[#3F3F46] focus-visible:rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#18181B]">
            Purchase details
          </summary>
          <dl className="grid gap-2 pb-1 text-xs">
            <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
              <dt>Store</dt>
              <dd className="font-medium text-[#18181B]">
                {merchant?.name ?? "Store needs review"}
              </dd>
            </div>
            <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
              <dt>Purchased</dt>
              <dd className="font-medium text-[#18181B]">
                {formatRelativeDate(purchase?.purchasedAt)}
              </dd>
            </div>
            <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
              <dt>Returns</dt>
              <dd className="font-medium text-[#18181B]">
                {coverage?.returnLabel ?? "Return policy unknown"}
              </dd>
            </div>
            <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
              <dt>Warranty</dt>
              <dd className="font-medium text-[#18181B]">
                {coverage?.warrantyLabel ?? "Warranty unknown"}
              </dd>
            </div>
            <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
              <dt>Serial</dt>
              <dd className="break-all font-medium text-[#18181B]">
                {purchase?.serial || "Not provided"}
              </dd>
            </div>
          </dl>
        </details>
      </motion.div>

      {/* Role Action Stage (Dark Zinc Card) */}
      <motion.div
        layout={!reduced}
        transition={MOTION.springSoft}
        className="returnly-obsidian-grid overflow-hidden rounded-[24px] border border-[#18181B] p-4 text-white shadow-md sm:p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/15 pb-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex size-8 items-center justify-center rounded-xl bg-white text-[#18181B]">
              {role === "buyer" ? (
                <UserCheck className="size-4" />
              ) : (
                <Store className="size-4" />
              )}
            </span>
            <div>
              <h3 className="text-sm font-bold text-white">
                {statusMeta.description}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              const prompt =
                role === "merchant"
                  ? `Review claim #${claim.claimCode} (${claim.id}), run triage-merchant-claim if needed, and recommend the next offer.`
                  : `Inspect my claim #${claim.claimCode} (${claim.id}) and advise me on the next step.`;
              void sendToAgent({
                message: prompt,
                submit: true,
                openSidebar: true,
                context: JSON.stringify({
                  claimId: claim.id,
                  workspaceSide: role,
                }),
              });
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[13px] font-semibold text-white transition-colors hover:bg-white hover:text-[#18181B]"
          >
            <MessageSquare className="size-3.5" />
            <span>Assistant</span>
          </button>
        </div>

        {/* Dynamic Stage Controls */}
        <div className="mt-3.5 space-y-3">
          {/* 1. Draft State -> Buyer approves & dispatches */}
          {claim.status === "draft" && role === "buyer" ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/20 bg-white/5 p-3.5">
              <div>
                <p className="text-[13px] font-bold text-white">
                  Ready to send
                </p>
                <p className="text-xs text-zinc-300">
                  Approve to disclose selected evidence and dispatch to{" "}
                  {merchant?.name ?? "the merchant"}&apos;s inbox.
                </p>
              </div>
              <ActionMorphButton
                state={submitClaimMut.isPending ? "submitting" : "idle"}
                idleLabel="Approve & Send Claim"
                submittingLabel="Sending…"
                variant="outline"
                size="sm"
                onClick={() =>
                  submitClaimMut.mutate({
                    claimId: claim.id,
                    idempotencyKey: `submit-${claim.id}-v${claim.version}`,
                    buyerApproved: true,
                    demoActorRole,
                  })
                }
              />
            </div>
          ) : null}

          {/* 2. Merchant Triage & Offer Controls */}
          {role === "merchant" &&
          (claim.status === "submitted" ||
            claim.status === "under_review" ||
            claim.status === "awaiting_evidence" ||
            claim.status === "offer_pending") ? (
            <div className="space-y-3">
              {latestTriage ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5">
                  <div className="flex flex-wrap items-center gap-2 text-[13px]">
                    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-extrabold uppercase text-[#18181B]">
                      {latestTriage.policyMatch}
                    </span>
                    <span className="text-white/85">
                      {latestTriage.daysSincePurchase == null
                        ? "Purchase age unknown"
                        : `${latestTriage.daysSincePurchase} days since purchase`}{" "}
                      ·{" "}
                      {latestTriage.stockSnapshot.reduce(
                        (n: number, b: any) => n + b.available,
                        0,
                      )}{" "}
                      units available
                    </span>
                  </div>
                  <ActionMorphButton
                    state={triageMut.isPending ? "submitting" : "idle"}
                    idleLabel="Policy checked"
                    submittingLabel="Checking…"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      triageMut.mutate({ claimId: claim.id, demoActorRole })
                    }
                  />
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5">
                  <span className="text-[13px] font-semibold text-white">
                    Check policy window & branch stock
                  </span>
                  <ActionMorphButton
                    state={triageMut.isPending ? "submitting" : "idle"}
                    idleLabel="Check policy"
                    submittingLabel="Checking…"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      triageMut.mutate({ claimId: claim.id, demoActorRole })
                    }
                  />
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                {!hasVideoEvidence && claim.status !== "awaiting_evidence" ? (
                  <ActionMorphButton
                    state={requestEvidenceMut.isPending ? "submitting" : "idle"}
                    idleLabel="Request evidence"
                    submittingLabel="Requesting…"
                    variant="outline"
                    size="sm"
                    icon={<Video className="size-3.5" />}
                    onClick={() =>
                      requestEvidenceMut.mutate({
                        claimId: claim.id,
                        requestedItem: "Issue clip or fault details",
                        note: "Please upload a short clip/photo or describe when the fault occurs.",
                        idempotencyKey: `req-ev-${claim.id}-v${claim.version}`,
                        demoActorRole,
                      })
                    }
                  />
                ) : null}

                <ActionMorphButton
                  state={proposeMut.isPending ? "submitting" : "idle"}
                  idleLabel="Offer replacement"
                  submittingLabel="Sending…"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    proposeMut.mutate({
                      claimId: claim.id,
                      remedyType: "replacement",
                      logisticsType: "drop_off",
                      branchId: selectedBranchId || branches[0]?.id,
                      slotId: selectedSlotId || branches[0]?.slots?.[0]?.id,
                      note: "Replacement proposed, subject to inspection at the selected branch.",
                      idempotencyKey: `propose-rep-${claim.id}-v${claim.version}`,
                      demoActorRole,
                    })
                  }
                />

                <button
                  type="button"
                  onClick={() => setShowPartialRefundBuilder((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-white/20"
                >
                  <Percent className="size-3.5 text-zinc-300" />
                  <span>
                    {showPartialRefundBuilder
                      ? "Hide Refund"
                      : "Partial Refund"}
                  </span>
                </button>

                {activeOffer &&
                activeOffer.state === "offered" &&
                (activeOffer.createdByRole === "buyer_ui" ||
                  activeOffer.createdByRole === "buyer_agent") ? (
                  <ActionMorphButton
                    state={acceptMut.isPending ? "submitting" : "idle"}
                    idleLabel={`Approve Counteroffer (${LOGISTICS_LABELS[activeOffer.logisticsType] ?? activeOffer.logisticsType})`}
                    submittingLabel="Approving…"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      acceptMut.mutate({
                        claimId: claim.id,
                        offerId: activeOffer.id,
                        expectedVersion: activeOffer.version,
                        idempotencyKey: `merchant-accept-${activeOffer.id}-v${activeOffer.version}`,
                        demoActorRole,
                      })
                    }
                  />
                ) : null}
              </div>
            </div>
          ) : null}

          {/* 3. Buyer Evidence Upload (with Disclosure Permission) & Counter/Accept Controls */}
          {role === "buyer" && claim.status !== "draft" ? (
            <div className="space-y-2.5">
              {activeOffer && activeOffer.state === "offered" ? (
                <div className="rounded-xl border border-white/25 bg-white/10 p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-extrabold uppercase text-[#18181B]">
                        Offer v{activeOffer.version}
                      </span>
                      <h4 className="mt-1 text-sm font-bold text-white">
                        {REMEDY_LABELS[activeOffer.remedyType] ??
                          activeOffer.remedyType}{" "}
                        ·{" "}
                        {LOGISTICS_LABELS[activeOffer.logisticsType] ??
                          activeOffer.logisticsType}
                        {activeOffer.refundMinor
                          ? ` (${formatMoneyMinor(activeOffer.refundMinor, activeOffer.currency)})`
                          : ""}
                      </h4>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <ActionMorphButton
                        state={acceptMut.isPending ? "submitting" : "idle"}
                        idleLabel="Accept Offer"
                        submittingLabel="Accepting…"
                        variant="lime"
                        size="sm"
                        onClick={() =>
                          acceptMut.mutate({
                            claimId: claim.id,
                            offerId: activeOffer.id,
                            expectedVersion: activeOffer.version,
                            idempotencyKey: `buyer-accept-${activeOffer.id}-v${activeOffer.version}`,
                            demoActorRole,
                          })
                        }
                      />

                      {activeOffer.logisticsType === "drop_off" &&
                      pickupChoice ? (
                        <ActionMorphButton
                          state={counterMut.isPending ? "submitting" : "idle"}
                          idleLabel={`Request pickup · ${formatAppointmentWindow(pickupChoice.slot)}`}
                          submittingLabel="Countering…"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            counterMut.mutate({
                              claimId: claim.id,
                              remedyType: "replacement",
                              logisticsType: "pickup",
                              branchId: pickupChoice.branchId,
                              slotId: pickupChoice.slot.id,
                              note: `Requesting pickup at ${formatAppointmentWindow(pickupChoice.slot)}.`,
                              idempotencyKey: `buyer-counter-${activeOffer.id}-v${activeOffer.version}`,
                              demoActorRole,
                            });
                          }}
                        />
                      ) : null}

                      <button
                        type="button"
                        onClick={() => setShowPartialRefundBuilder((v) => !v)}
                        className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-white/20"
                      >
                        {showPartialRefundBuilder
                          ? "Hide refund"
                          : "Suggest refund"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {(claim.status === "awaiting_evidence" || !hasVideoEvidence) &&
              !isCompleted ? (
                <details
                  open={claim.status === "awaiting_evidence" ? true : undefined}
                  className="rounded-xl border border-white/20 bg-white/10 px-3.5"
                >
                  <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-white focus-visible:rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                    Add evidence
                  </summary>
                  <div className="space-y-2.5 pb-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label htmlFor={noteInputId} className="sr-only">
                        Evidence note
                      </label>
                      <div className="flex min-w-0 items-center gap-2 rounded-full focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-white">
                        <label
                          htmlFor={fileUploadId}
                          className="inline-flex min-h-11 min-w-0 cursor-pointer items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/20"
                        >
                          <Upload className="size-3.5 shrink-0" />
                          <span className="break-all">
                            {uploadedFileName
                              ? `File: ${uploadedFileName}`
                              : "Choose a file"}
                          </span>
                        </label>
                        <input
                          id={fileUploadId}
                          type="file"
                          accept="image/*,video/*,application/pdf"
                          onChange={handleEvidenceFileSelect}
                          className="sr-only"
                        />
                      </div>
                    </div>

                    <textarea
                      id={noteInputId}
                      value={evidenceNote}
                      onChange={(e) => setEvidenceNote(e.target.value)}
                      placeholder="Describe the fault and what you tried"
                      className="w-full rounded-xl border border-white/30 bg-black/20 p-3 text-sm text-white placeholder:text-zinc-300"
                    />

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-xs text-zinc-200">
                        <input
                          type="checkbox"
                          checked={discloseUpload}
                          onChange={(e) => setDiscloseUpload(e.target.checked)}
                          className="size-4 shrink-0 rounded accent-white"
                        />
                        <span>
                          Disclose uploaded media to{" "}
                          {merchant?.name ?? "merchant"}
                        </span>
                      </label>

                      <ActionMorphButton
                        state={addEvidenceMut.isPending ? "submitting" : "idle"}
                        idleLabel={
                          uploadedDataUrl ? "Upload Evidence" : "Add Note"
                        }
                        submittingLabel="Saving…"
                        variant="outline"
                        size="sm"
                        disabled={!evidenceNote.trim()}
                        onClick={() =>
                          addEvidenceMut.mutate({
                            claimId: claim.id,
                            label: uploadedFileName
                              ? `Buyer ${evidenceKind}: ${uploadedFileName}`
                              : "Buyer diagnostic note",
                            mediaKind: uploadedDataUrl
                              ? evidenceKind
                              : "diagnostic_note",
                            note: evidenceNote.trim(),
                            ...(uploadedDataUrl
                              ? {
                                  fileName: uploadedFileName,
                                  mimeType: uploadedMimeType,
                                  dataUrl: uploadedDataUrl,
                                  discloseToMerchant: discloseUpload,
                                }
                              : {}),
                            demoActorRole,
                          })
                        }
                      />
                    </div>
                  </div>
                </details>
              ) : null}
            </div>
          ) : null}

          {/* 4. Agreed State -> Lock Branch Slot & Issue QR Pass */}
          {role === "merchant" &&
          claim.status === "agreed" &&
          (!returnPass || returnPass.invalidatedAt) ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/30 bg-white/10 p-3.5">
              <span className="text-[13px] font-bold text-white">
                Terms agreed - confirm the appointment
              </span>
              <ActionMorphButton
                state={reserveMut.isPending ? "submitting" : "idle"}
                idleLabel="Confirm Slot & Get QR Pass"
                submittingLabel="Issuing pass…"
                variant="lime"
                size="sm"
                icon={<QrCode className="size-3.5" />}
                onClick={() =>
                  reserveMut.mutate({
                    claimId: claim.id,
                    branchId:
                      activeOffer?.branchId ||
                      selectedBranchId ||
                      branches[0]?.id,
                    slotId:
                      activeOffer?.slotId ||
                      selectedSlotId ||
                      branches[0]?.slots?.[0]?.id,
                    idempotencyKey: `reserve-${claim.id}-v${claim.version}`,
                    demoActorRole,
                  })
                }
              />
            </div>
          ) : null}

          {/* 4b. Active Reservation Cancellation & Recovery */}
          {reservation?.status === "confirmed" &&
          claim.status === "appointment_confirmed" &&
          !isCompleted ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/20 bg-white/5 px-3.5 py-2.5">
              <span className="text-[12px] text-white/85">
                Cancel this appointment to choose another time.
              </span>
              <ActionMorphButton
                state={cancelReservationMut.isPending ? "submitting" : "idle"}
                idleLabel="Cancel & Release Slot"
                submittingLabel="Releasing…"
                variant="outline"
                size="sm"
                icon={<XCircle className="size-3.5" />}
                onClick={() =>
                  cancelReservationMut.mutate({
                    claimId: claim.id,
                    reason: `${role === "buyer" ? "Buyer" : "Merchant"} requested appointment reschedule.`,
                    idempotencyKey: `cancel-res-${reservation.id}`,
                    demoActorRole,
                  })
                }
              />
            </div>
          ) : null}

          {/* 5. Pass Issued -> Merchant Verification & Handover Controls */}
          {returnPass &&
          !returnPass.invalidatedAt &&
          role === "merchant" &&
          !isCompleted ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/25 bg-white/10 p-3.5">
              <span className="break-all text-[13px] font-bold text-white">
                Pass {returnPass.publicToken} ·{" "}
                {returnPass.redeemedAt
                  ? "Handed over"
                  : returnPass.inspectedAt
                    ? "Verified"
                    : "Ready for check-in"}
              </span>
              <div className="flex flex-wrap gap-2">
                {!returnPass.inspectedAt ? (
                  <ActionMorphButton
                    state={verifyPassMut.isPending ? "submitting" : "idle"}
                    idleLabel="Record inspection"
                    submittingLabel="Verifying…"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      verifyPassMut.mutate({
                        token: returnPass.publicToken,
                        recordInspection: true,
                        inspectionNote:
                          "Merchant recorded inspection completion; no automated diagnosis.",
                        demoActorRole,
                      })
                    }
                  />
                ) : null}

                {!returnPass.redeemedAt && returnPass.inspectedAt ? (
                  <ActionMorphButton
                    state={handoverMut.isPending ? "submitting" : "idle"}
                    idleLabel="Record Handover"
                    submittingLabel="Recording…"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      handoverMut.mutate({
                        claimId: claim.id,
                        handoverNote: "Replacement unit handed over.",
                        idempotencyKey: `handover-${claim.id}`,
                        demoActorRole,
                      })
                    }
                  />
                ) : null}
              </div>
            </div>
          ) : null}

          {/* 6. Handover Recorded -> Buyer Final Confirmation */}
          {role === "buyer" && claim.status === "fulfilled" && !isCompleted ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/30 bg-white/10 p-3.5">
              <span className="text-[13px] font-bold text-white">
                Handover recorded - confirm you received your replacement
              </span>
              <ActionMorphButton
                state={confirmReceivedMut.isPending ? "submitting" : "idle"}
                idleLabel="Confirm Received"
                submittingLabel="Closing…"
                variant="lime"
                size="sm"
                onClick={() =>
                  confirmReceivedMut.mutate({
                    claimId: claim.id,
                    feedbackNote: "Buyer confirmed receipt.",
                    idempotencyKey: `confirm-close-${claim.id}`,
                    demoActorRole,
                  })
                }
              />
            </div>
          ) : null}

          {/* 7. Completed Banner */}
          {isCompleted ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-white/30 bg-white/10 px-4 py-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-white" />
                <span className="text-[13px] font-bold text-white">
                  Resolved & Closed
                </span>
              </div>
              <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-extrabold text-[#18181B]">
                DONE
              </span>
            </div>
          ) : null}
        </div>
      </motion.div>

      <ProgressRail status={claim.status} compact={compact} />

      {/* Optional Partial Keep-Item Refund Slider */}
      {showPartialRefundBuilder ? (
        <RefundOfferSlider
          purchaseAmountMinor={purchase?.amountMinor}
          currencyCode={purchase?.currencyCode ?? "NGN"}
          role={role}
          isPending={proposeMut.isPending || counterMut.isPending}
          onSubmitPercent={(percent, note) => {
            if (role === "merchant") {
              proposeMut.mutate({
                claimId: claim.id,
                remedyType: "partial_keep_item_refund",
                logisticsType: "drop_off",
                refundPercent: percent,
                branchId: selectedBranchId || branches[0]?.id,
                note,
                demoActorRole,
              });
            } else {
              counterMut.mutate({
                claimId: claim.id,
                remedyType: "partial_keep_item_refund",
                logisticsType: "drop_off",
                refundPercent: percent,
                branchId: selectedBranchId || branches[0]?.id,
                note,
                demoActorRole,
              });
            }
          }}
        />
      ) : null}

      {/* QR Return Pass Reveal (when generated and active) */}
      {returnPass ? (
        <ReturnPassReveal
          publicToken={returnPass.publicToken}
          canVerify={role === "merchant"}
          claimCode={claim.claimCode}
          productName={purchase?.productName ?? "Purchase"}
          merchantName={merchant?.name ?? "Merchant"}
          branchName={
            branches.find((b: any) => b.id === reservation?.branchId)?.name ??
            "Branch needs review"
          }
          slotLabel={formatAppointmentWindow(
            branches
              .flatMap((branch: any) => branch.slots)
              .find((slot: any) => slot.id === reservation?.slotId),
          )}
          remedyLabel={
            REMEDY_LABELS[
              activeOffer?.remedyType ?? claim.preferredResolution
            ] ?? "Replacement"
          }
          expiresAt={returnPass.expiresAt}
          invalidatedAt={returnPass.invalidatedAt}
          inspectedAt={returnPass.inspectedAt}
          redeemedAt={returnPass.redeemedAt}
        />
      ) : null}

      {/* Branch Map & Appointment Slot Stage */}
      {branches.length > 0 ? (
        <BranchMapStage
          branches={branches}
          selectedBranchId={selectedBranchId || branches[0].id}
          selectedSlotId={selectedSlotId || branches[0]?.slots?.[0]?.id || ""}
          onSelectBranch={setSelectedBranchId}
          onSelectSlot={setSelectedSlotId}
          reservationConfirmed={reservation?.status === "confirmed"}
          isConfirming={reserveMut.isPending}
          onConfirmReservation={
            role === "merchant" && claim.status === "agreed"
              ? () =>
                  reserveMut.mutate({
                    claimId: claim.id,
                    branchId:
                      activeOffer?.branchId ||
                      selectedBranchId ||
                      branches[0].id,
                    slotId:
                      activeOffer?.slotId ||
                      selectedSlotId ||
                      branches[0]?.slots?.[0]?.id,
                    idempotencyKey: `map-reserve-${claim.id}-v${claim.version}`,
                    demoActorRole,
                  })
              : undefined
          }
        />
      ) : null}

      {/* Evidence Packet + Shared Case Thread Grid */}
      <div
        className={cn(
          "grid min-w-0 items-start gap-4",
          !compact && "lg:grid-cols-2",
        )}
      >
        {/* Compact Evidence List with Disclosure Controls */}
        <div className="rounded-[24px] border border-[#E4E4E7] bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-[#18181B]" />
              <h3 className="text-sm font-bold text-[#18181B]">
                Evidence ({evidence.length})
              </h3>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {evidence.map((item: any) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] px-3 py-2.5"
              >
                <div className="flex min-w-0 flex-1 basis-40 items-center gap-2.5">
                  <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#18181B] text-white">
                    {item.mediaKind === "receipt" ? (
                      <FileText className="size-3.5" />
                    ) : item.mediaKind === "video" ? (
                      <Film className="size-3.5" />
                    ) : (
                      <ImageIcon className="size-3.5" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="break-words text-[13px] font-semibold text-[#18181B]">
                      {item.label}
                    </p>
                    <p className="text-xs text-[#52525B]">
                      {item.mediaKind === "receipt"
                        ? "Receipt attachment"
                        : `${item.mediaKind} · ${item.submittedBy.replace(/_/g, " ")}`}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {role === "buyer" &&
                  item.attachmentId &&
                  item.storageStatus === "uploaded_media" ? (
                    <button
                      type="button"
                      disabled={disclosureMut.isPending}
                      onClick={() =>
                        disclosureMut.mutate({
                          claimId: claim.id,
                          attachmentId: item.attachmentId,
                          disclosedToMerchant: !item.disclosedToMerchant,
                          demoActorRole,
                        })
                      }
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[#E4E4E7] bg-white px-3 py-2 text-xs font-semibold text-[#18181B] hover:border-[#18181B]"
                    >
                      {item.disclosedToMerchant ? (
                        <>
                          <Eye className="size-3" />
                          <span>Disclosed</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="size-3" />
                          <span>Private</span>
                        </>
                      )}
                    </button>
                  ) : null}

                  <span className="rounded-full bg-[#18181B] px-2 py-0.5 text-[11px] font-bold text-white tabular-nums">
                    {item.storageStatus === "demo_fixture"
                      ? "Demo fixture"
                      : item.storageStatus === "uploaded_media"
                        ? "Uploaded media"
                        : item.storageStatus === "undisclosed_private"
                          ? "Private (Withheld)"
                          : item.storageStatus === "written_note"
                            ? "Written note"
                            : "Unverified"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Compact Activity & Chat */}
        <div className="flex flex-col justify-between rounded-[24px] border border-[#E4E4E7] bg-white p-4 shadow-xs">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="size-4 text-[#18181B]" />
                <h3 className="text-sm font-bold text-[#18181B]">
                  Messages ({messages.length})
                </h3>
              </div>
              <button
                type="button"
                aria-expanded={showAuditLog}
                aria-controls={auditLogId}
                onClick={() => setShowAuditLog((v) => !v)}
                className="inline-flex min-h-11 items-center gap-1 text-xs font-medium text-[#52525B] hover:text-[#18181B]"
              >
                <Clock className="size-3" />
                <span>History</span>
                <ChevronDown
                  className={cn(
                    "size-3 transition-transform",
                    showAuditLog && "rotate-180",
                  )}
                />
              </button>
            </div>

            {showAuditLog ? (
              <div
                id={auditLogId}
                className="mt-2.5 flex flex-wrap gap-1.5 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] p-2.5"
              >
                {events.map((ev: any) => (
                  <span
                    key={ev.id}
                    className="inline-flex max-w-full flex-wrap items-center gap-1 break-all rounded-lg border border-[#E4E4E7] bg-white px-2 py-1 text-xs"
                  >
                    <strong className="font-mono text-[#18181B]">
                      {ev.actionType.startsWith("demo-seed:")
                        ? "Demo setup"
                        : ev.actorSource}
                    </strong>
                    <span className="text-[#71717A]">
                      {ev.actionType.replace("demo-seed:", "")}
                    </span>
                  </span>
                ))}
              </div>
            ) : null}

            <div className="mt-3 max-h-52 space-y-2 overflow-y-auto pr-1">
              {messages.map((msg: any) => (
                <div
                  key={msg.id}
                  className="rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] px-3 py-2 text-[13px]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase text-[#52525B]">
                      {msg.senderRole.replace(/_/g, " ")}
                    </span>
                    <span className="text-[11px] text-[#71717A] tabular-nums">
                      {new Date(msg.sentAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="mt-0.5 break-words text-[#18181B]">
                    {msg.body}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!messageDraft.trim()) return;
              sendMessageMut.mutate({
                claimId: claim.id,
                body: messageDraft.trim(),
                senderSide: role,
              });
            }}
            className="mt-3 flex items-center gap-2 border-t border-[#E4E4E7] pt-2.5"
          >
            <input
              type="text"
              aria-label="Case message"
              value={messageDraft}
              onChange={(e) => setMessageDraft(e.target.value)}
              placeholder="Write a message…"
              className="min-h-11 min-w-0 flex-1 rounded-full border border-[#E4E4E7] bg-[#FAFAFA] px-3.5 py-2 text-sm text-[#18181B] placeholder:text-[#52525B] focus:border-[#18181B] focus:bg-white"
            />
            <button
              type="submit"
              disabled={sendMessageMut.isPending || !messageDraft.trim()}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-[#18181B] text-white transition-transform hover:scale-105 disabled:opacity-50"
              aria-label="Send message"
            >
              <Send className="size-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
