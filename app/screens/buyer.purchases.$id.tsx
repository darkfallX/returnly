import {
  useActionMutation,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import { ArrowLeft, CheckCircle2, Lock, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { ActionMorphButton } from "@/components/returnly/ActionMorphButton";
import { Btn } from "@/components/returnly/Btn";
import { formatMoneyMinor, formatRelativeDate } from "@/lib/motion-tokens";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "coverage", label: "Coverage" },
  { id: "receipt", label: "Receipt" },
] as const;

export function meta() {
  return [{ title: "Purchase - Returnly" }];
}

export default function BuyerPurchaseDetailRoute() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const mediaInput = useRef<HTMLInputElement>(null);

  const {
    data: purchase,
    isLoading,
    error,
    refetch,
  } = useActionQuery("get-purchase", { id });
  const [activeTab, setActiveTab] =
    useState<(typeof TABS)[number]["id"]>("overview");

  const [issueTitle, setIssueTitle] = useState("Left speaker stopped working");
  const [issueDescription, setIssueDescription] = useState(
    "Left earcup audio cuts out during playback.",
  );
  const [preferredResolution, setPreferredResolution] = useState<
    | "inspection"
    | "repair"
    | "replacement"
    | "full_refund_request"
    | "partial_keep_item_refund"
  >("replacement");
  const [preferredLogistics, setPreferredLogistics] = useState<
    "drop_off" | "pickup"
  >("pickup");
  const [attachDataUrl, setAttachDataUrl] = useState<string>("");
  const [attachMimeType, setAttachMimeType] = useState<string>("");
  const [attachFileName, setAttachFileName] = useState<string>("");
  const [discloseAttachmentsToMerchant, setDiscloseAttachmentsToMerchant] =
    useState<boolean>(true);

  const stageMut = useActionMutation("stage-claim-packet", {
    onSuccess: (res) => {
      toast.success("Draft saved");
      navigate(`/buyer/claims/${res.claimId}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const handleMediaFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      toast.error("File size under 4 MB required");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setAttachDataUrl(reader.result);
        setAttachMimeType(file.type || "image/png");
        setAttachFileName(file.name);
        toast.success(`Attached ${file.name}`);
      }
    };
    reader.readAsDataURL(file);
  };

  if (isLoading) {
    return (
      <div className="returnly-workspace px-4 py-5 sm:px-6 sm:py-6">
        <div className="mx-auto max-w-3xl space-y-4">
          <Btn
            to="/buyer/vault"
            variant="soft"
            size="sm"
            icon={<ArrowLeft className="size-3.5" />}
          >
            Back to purchases
          </Btn>
          <div
            role="status"
            aria-label="Loading purchase"
            className="h-72 animate-pulse rounded-[24px] bg-[#E4E4E7]/60"
          />
        </div>
      </div>
    );
  }

  if (!purchase) {
    return (
      <div className="returnly-workspace px-4 py-5 sm:px-6 sm:py-6">
        <div className="mx-auto max-w-3xl space-y-4">
          <Btn
            to="/buyer/vault"
            variant="soft"
            size="sm"
            icon={<ArrowLeft className="size-3.5" />}
          >
            Back to purchases
          </Btn>
          <div
            role={error ? "alert" : undefined}
            className="rounded-2xl border border-[#E4E4E7] bg-white p-5 text-sm text-[#18181B]"
          >
            <p>{error?.message || "Purchase not found"}</p>
            {error && (
              <Btn
                onClick={() => void refetch()}
                variant="secondary"
                size="sm"
                icon={null}
                className="mt-3"
              >
                Try again
              </Btn>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="returnly-grid-backdrop returnly-workspace min-h-full px-4 py-5 sm:px-6 sm:py-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <Btn
          to="/buyer/vault"
          variant="soft"
          size="sm"
          icon={<ArrowLeft className="size-3.5" />}
        >
          Back to purchases
        </Btn>

        {/* Header Card */}
        <div className="rounded-[24px] border border-[#E4E4E7] bg-white p-5 shadow-xs">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="rounded-full border border-[#E4E4E7] bg-[#F4F4F5] px-2.5 py-0.5 text-[12px] font-bold text-[#18181B]">
                {purchase.merchantName}
              </span>
              <h1 className="mt-2 break-words text-xl font-semibold text-[#18181B] sm:text-2xl">
                {purchase.productName}
              </h1>
              <p className="text-[12px] text-[#71717A]">
                #{purchase.orderNumber || "Manual"} ·{" "}
                {formatRelativeDate(purchase.purchasedAt)}
              </p>
            </div>

            <div className="rounded-xl bg-[#18181B] px-3 py-1.5 text-right text-white">
              <span className="text-base font-bold text-white tabular-nums">
                {formatMoneyMinor(purchase.amountMinor, purchase.currencyCode)}
              </span>
            </div>
          </div>

          <div
            aria-label="Purchase details"
            className="mt-4 flex flex-wrap gap-1 border-b border-[#E4E4E7] pb-2"
          >
            {TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  aria-pressed={active}
                  className={cn(
                    "min-h-11 rounded-full px-4 text-[13px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#18181B]",
                    active
                      ? "bg-[#18181B] text-white"
                      : "text-[#52525B] hover:bg-[#F4F4F5] hover:text-[#18181B]",
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab Panels */}
          <div className="mt-3">
            {activeTab === "overview" ? (
              <div className="grid grid-cols-2 gap-2 text-[12px]">
                <div className="rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] p-2.5">
                  <span className="text-[10px] font-bold uppercase text-[#71717A]">
                    Serial
                  </span>
                  <p className="font-semibold text-[#18181B]">
                    {purchase.serial || "Not provided"}
                  </p>
                </div>
                <div className="rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] p-2.5">
                  <span className="text-[10px] font-bold uppercase text-[#71717A]">
                    Active Claims
                  </span>
                  <p className="font-semibold text-[#18181B]">
                    {purchase.linkedClaims?.length || 0}
                  </p>
                </div>
              </div>
            ) : activeTab === "coverage" ? (
              <div className="space-y-2 text-[12px]">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] p-3">
                  <span className="font-bold text-[#18181B]">
                    Return Window
                  </span>
                  <span className="font-semibold text-[#18181B]">
                    {purchase.coverage?.returnLabel || "Unknown"}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] p-3">
                  <span className="font-bold text-[#18181B]">Warranty</span>
                  <span className="font-semibold text-[#18181B]">
                    {purchase.coverage?.warrantyLabel || "Unknown"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="break-all text-[13px] font-semibold text-[#18181B]">
                    {purchase.receiptAttachment?.fileName ||
                      (purchase.receiptId
                        ? "Receipt attached"
                        : "No receipt attached")}
                  </span>
                  {purchase.verificationStatus === "merchant_verified" && (
                    <span className="rounded-full bg-[#18181B] px-2 py-0.5 text-[11px] font-semibold text-white">
                      Purchase verified
                    </span>
                  )}
                </div>
                {purchase.receiptAttachment?.dataUrl?.startsWith(
                  "data:image/",
                ) ? (
                  <img
                    src={purchase.receiptAttachment.dataUrl}
                    alt="Receipt"
                    className="mt-1 max-h-28 rounded-lg border border-[#E4E4E7] object-contain"
                  />
                ) : null}
              </div>
            )}
          </div>
        </div>

        {/* Linked Claim Shortcut */}
        {purchase.linkedClaims?.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] bg-[#18181B] p-4 text-white shadow-sm">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Active Request
              </span>
              <p className="text-sm font-bold text-white">
                #{purchase.linkedClaims[0].claimCode}
              </p>
            </div>
            <Btn
              to={`/buyer/claims/${purchase.linkedClaims[0].id}`}
              variant="light"
              size="sm"
            >
              Open Room
            </Btn>
          </div>
        ) : null}

        {/* Report Problem Form */}
        <div className="rounded-[24px] border border-[#E4E4E7] bg-white p-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E4E4E7] pb-3">
            <h2 className="text-sm font-bold text-[#18181B]">
              Report an Issue
            </h2>
            <Btn
              variant="secondary"
              size="sm"
              icon={<Upload className="size-3.5" />}
              onClick={() => mediaInput.current?.click()}
            >
              {attachFileName ? "Change file" : "Add photo"}
            </Btn>
            <input
              ref={mediaInput}
              aria-label="Issue photo or video"
              tabIndex={-1}
              type="file"
              accept="image/*,video/*"
              onChange={handleMediaFile}
              className="sr-only"
            />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              stageMut.mutate({
                purchaseId: purchase.id,
                issueTitle,
                issueDescription,
                preferredResolution,
                preferredLogistics,
                autoSubmit: false,
                ...(attachDataUrl
                  ? {
                      attachDataUrl,
                      attachMimeType,
                      attachFileName,
                      attachPhotoLabel: attachFileName,
                      discloseAttachmentsToMerchant,
                    }
                  : {}),
              });
            }}
            className="mt-3 space-y-3"
          >
            <div>
              <label
                htmlFor="claim-issue"
                className="block text-[12px] font-bold text-[#18181B]"
              >
                What happened?
              </label>
              <input
                id="claim-issue"
                type="text"
                required
                value={issueTitle}
                onChange={(e) => setIssueTitle(e.target.value)}
                placeholder="e.g. Left earcup cuts out"
                className="mt-1 w-full rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] px-3 py-2 text-[13px] font-medium text-[#18181B]"
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="claim-resolution"
                  className="block text-[12px] font-bold text-[#18181B]"
                >
                  Desired Resolution
                </label>
                <select
                  id="claim-resolution"
                  value={preferredResolution}
                  onChange={(e) =>
                    setPreferredResolution(e.target.value as any)
                  }
                  className="mt-1 w-full rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] px-3 py-2 text-[13px] font-medium text-[#18181B]"
                >
                  <option value="replacement">Replacement Swap</option>
                  <option value="inspection">Inspection & Swap</option>
                  <option value="repair">Repair</option>
                  <option value="partial_keep_item_refund">
                    Partial Refund
                  </option>
                  <option value="full_refund_request">Full Refund</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="claim-handover"
                  className="block text-[12px] font-bold text-[#18181B]"
                >
                  Handover
                </label>
                <select
                  id="claim-handover"
                  value={preferredLogistics}
                  onChange={(e) =>
                    setPreferredLogistics(
                      e.target.value as "drop_off" | "pickup",
                    )
                  }
                  className="mt-1 w-full rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] px-3 py-2 text-[13px] font-medium text-[#18181B]"
                >
                  <option value="pickup">Scheduled Pickup</option>
                  <option value="drop_off">Branch Drop-Off</option>
                </select>
              </div>
            </div>

            {attachDataUrl ? (
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] px-3 py-2 text-[12px] font-semibold text-[#18181B]">
                <input
                  type="checkbox"
                  checked={discloseAttachmentsToMerchant}
                  onChange={(e) =>
                    setDiscloseAttachmentsToMerchant(e.target.checked)
                  }
                  className="size-3.5 rounded accent-[#18181B]"
                />
                <Lock className="size-3.5 text-[#52525B]" />
                <span>Share {attachFileName} with store</span>
              </label>
            ) : null}

            <div className="flex justify-end pt-2">
              <ActionMorphButton
                type="submit"
                state={stageMut.isPending ? "submitting" : "idle"}
                idleLabel="Prepare claim"
                submittingLabel="Preparing…"
                variant="ink"
                size="md"
                icon={<CheckCircle2 className="size-4" />}
              />
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
