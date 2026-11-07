import {
  useActionMutation,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import { ArrowLeft, CheckCircle2, PackageCheck, QrCode } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router";
import { toast } from "sonner";

import { ActionMorphButton } from "@/components/returnly/ActionMorphButton";
import { AnimatedHeading } from "@/components/returnly/AnimatedHeading";
import { Btn } from "@/components/returnly/Btn";

export function meta() {
  return [{ title: "Verify Pass - Returnly" }];
}

export default function PassVerifyRoute() {
  const { token = "" } = useParams();
  const { data: viewer } = useActionQuery("get-viewer-context", {});
  const demoActorRole = viewer?.user.demoMode
    ? ("merchant" as const)
    : undefined;
  const [inspectionNote, setInspectionNote] = useState("");
  const [handoverNote, setHandoverNote] = useState("");
  const [verifiedData, setVerifiedData] = useState<any | null>(null);

  const verifyMut = useActionMutation("verify-return-pass", {
    onSuccess: (res) => {
      setVerifiedData(res);
      toast.success(res.message);
    },
    onError: (err) => toast.error(err.message),
  });

  const handoverMut = useActionMutation("record-handover", {
    onSuccess: (res) => {
      toast.success(res.message);
      setVerifiedData((prev: any) =>
        prev ? { ...prev, status: res.status } : prev,
      );
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="returnly-grid-backdrop returnly-workspace min-h-full px-4 py-5 sm:px-6 sm:py-6">
      <div className="mx-auto max-w-2xl space-y-4">
        <Btn
          to={
            demoActorRole
              ? "/demo"
              : viewer?.hasRealMerchantMembership
                ? "/merchant/claims"
                : "/buyer/home"
          }
          variant="soft"
          size="sm"
          icon={<ArrowLeft className="size-3.5" />}
        >
          {demoActorRole
            ? "Back to demo"
            : viewer?.hasRealMerchantMembership
              ? "Back to inbox"
              : "Back to purchases"}
        </Btn>

        <div className="returnly-obsidian-grid overflow-hidden rounded-[24px] border border-[#18181B] p-5 text-white sm:p-6">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#18181B]">
              <QrCode className="size-5" />
            </span>
            <div className="min-w-0">
              {demoActorRole && (
                <span className="text-xs font-semibold text-zinc-300">
                  Demo preview
                </span>
              )}
              <AnimatedHeading
                text="Verify return pass"
                className="text-xl text-white sm:text-2xl"
              />
            </div>
          </div>
          <p className="mt-3 break-all font-mono text-xs text-zinc-300">
            {token}
          </p>

          <div className="mt-5 space-y-3 rounded-2xl border border-white/15 bg-white/5 p-4">
            <div>
              <label
                htmlFor="pass-inspection"
                className="block text-[13px] font-semibold text-zinc-200"
              >
                Inspection Note
              </label>
              <input
                id="pass-inspection"
                type="text"
                placeholder="Bench inspection completed"
                value={inspectionNote}
                onChange={(e) => setInspectionNote(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/30 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-zinc-400 focus:border-white focus:outline-none"
              />
            </div>

            <div className="flex justify-end">
              <ActionMorphButton
                state={
                  verifiedData
                    ? "committed"
                    : verifyMut.isPending
                      ? "submitting"
                      : "idle"
                }
                idleLabel="Validate Pass"
                disabled={!viewer || !inspectionNote.trim()}
                submittingLabel="Verifying…"
                committedLabel="Verified"
                variant="outline"
                size="sm"
                onClick={() =>
                  verifyMut.mutate({
                    token,
                    recordInspection: true,
                    inspectionNote,
                    demoActorRole,
                  })
                }
              />
            </div>
          </div>
          {verifyMut.error && (
            <p
              role="alert"
              className="mt-3 rounded-xl border border-red-300/40 bg-red-950/50 p-3 text-sm text-red-100"
            >
              {verifyMut.error.message}
            </p>
          )}

          {verifiedData ? (
            <div className="mt-4 space-y-3 rounded-2xl border border-white/30 bg-white/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="break-words text-sm font-semibold text-white">
                    #{verifiedData.claimCode} · {verifiedData.productName}
                  </h3>
                  <p className="text-[12px] text-white/75">
                    {verifiedData.branchName}
                  </p>
                </div>
                <CheckCircle2 className="size-5 shrink-0 text-white" />
              </div>

              <div>
                <label
                  htmlFor="pass-handover"
                  className="block text-[13px] font-semibold text-zinc-200"
                >
                  Handover Note
                </label>
                <input
                  id="pass-handover"
                  type="text"
                  placeholder="Replacement unit handed over"
                  value={handoverNote}
                  onChange={(e) => setHandoverNote(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/30 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-zinc-400 focus:border-white focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <Btn
                  to={`/merchant/claims/${verifiedData.claimId}`}
                  variant="light"
                  size="sm"
                >
                  Open Room
                </Btn>

                <ActionMorphButton
                  state={
                    verifiedData.redeemedAt ||
                    verifiedData.status === "fulfilled"
                      ? "committed"
                      : handoverMut.isPending
                        ? "submitting"
                        : "idle"
                  }
                  idleLabel="Record Handover"
                  disabled={!handoverNote.trim()}
                  submittingLabel="Recording…"
                  committedLabel="Handed Over"
                  variant="outline"
                  size="sm"
                  icon={<PackageCheck className="size-3.5" />}
                  onClick={() =>
                    handoverMut.mutate({
                      claimId: verifiedData.claimId,
                      handoverNote,
                      demoActorRole,
                    })
                  }
                />
              </div>
              {handoverMut.error && (
                <p
                  role="alert"
                  className="rounded-xl border border-red-300/40 bg-red-950/50 p-3 text-sm text-red-100"
                >
                  {handoverMut.error.message}
                </p>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
