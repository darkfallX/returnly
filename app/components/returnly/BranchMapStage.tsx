import { formatAppointmentWindow } from "../../../shared/appointment-time";
import { motion, useReducedMotion } from "framer-motion";
import { Calendar, MapPin, PackageCheck } from "lucide-react";

import { MOTION } from "@/lib/motion-tokens";
import { cn } from "@/lib/utils";

import { ActionMorphButton } from "./ActionMorphButton";

export interface BranchItem {
  id: string;
  name: string;
  addressText: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  services: string[];
  availableUnits: number;
  slots: Array<{
    id: string;
    label: string;
    startAt: string;
    endAt: string;
    capacity: number;
    reservedCount: number;
    serviceType: string;
  }>;
}

interface BranchMapStageProps {
  branches: BranchItem[];
  selectedBranchId: string;
  selectedSlotId: string;
  onSelectBranch: (branchId: string) => void;
  onSelectSlot: (slotId: string) => void;
  onConfirmReservation?: (() => void) | undefined;
  isConfirming?: boolean | undefined;
  reservationConfirmed?: boolean | undefined;
  className?: string | undefined;
}

export function BranchMapStage({
  branches,
  selectedBranchId,
  selectedSlotId,
  onSelectBranch,
  onSelectSlot,
  onConfirmReservation,
  isConfirming = false,
  reservationConfirmed = false,
  className,
}: BranchMapStageProps) {
  const reduced = useReducedMotion();
  const activeBranch =
    branches.find((b) => b.id === selectedBranchId) ?? branches[0];

  if (!activeBranch) return null;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[24px] border border-[#E4E4E7] bg-white shadow-xs",
        className,
      )}
    >
      {/* Stylized Monochrome Vector Map Stage */}
      <div className="returnly-obsidian-grid relative overflow-hidden p-4 text-white">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MapPin className="size-4 text-zinc-300" />
            <h3 className="text-sm font-bold text-white">Branch & Time Slot</h3>
          </div>
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-[13px] font-bold text-white tabular-nums">
            {activeBranch.name} · {activeBranch.availableUnits} in stock
          </span>
        </div>

        {/* Interactive SVG Route & Pin Canvas */}
        <div className="relative mt-3 h-32 w-full overflow-hidden rounded-2xl border border-white/10 bg-[#121215]">
          <svg
            viewBox="0 0 600 160"
            className="h-full w-full"
            aria-label="Illustrative branch layout"
          >
            <path
              d="M 20 120 Q 190 40 360 95 T 580 55"
              fill="none"
              stroke="rgba(255,255,255,0.09)"
              strokeWidth="6"
              strokeLinecap="round"
            />
            <path
              d="M 80 20 Q 250 110 490 130"
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="4"
            />
            <motion.path
              d={
                activeBranch.name.toLowerCase().includes("central")
                  ? "M 110 112 Q 210 52 340 78"
                  : "M 110 112 Q 290 35 470 58"
              }
              fill="none"
              stroke="#FAFAFA"
              strokeWidth="3"
              strokeDasharray="6 6"
              initial={reduced ? { pathLength: 1 } : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.7, ease: MOTION.easeOutExpo }}
            />
            <g transform="translate(110, 112)">
              <circle r="7" fill="#FFFFFF" />
              <circle r="3.5" fill="#18181B" />
              <text
                x="12"
                y="4"
                fill="rgba(255,255,255,0.78)"
                fontSize="11"
                fontWeight="600"
              >
                Illustrative
              </text>
            </g>
          </svg>

          {/* Interactive Branch Pins */}
          <div className="branch-pin-controls absolute inset-0 flex items-center justify-around px-10">
            {branches.map((branch, idx) => {
              const isSelected = branch.id === activeBranch.id;
              return (
                <motion.button
                  key={branch.id}
                  type="button"
                  whileHover={reduced ? { y: 0 } : { y: -2 }}
                  whileTap={reduced ? { scale: 1 } : { scale: 0.97 }}
                  onClick={() => {
                    onSelectBranch(branch.id);
                    if (branch.slots[0]) {
                      onSelectSlot(branch.slots[0].id);
                    }
                  }}
                  style={{
                    marginLeft: idx === 0 ? "70px" : "20px",
                    marginTop: idx === 0 ? "-10px" : "-30px",
                  }}
                  className={cn(
                    "group relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-left text-[13px] font-bold transition-all shadow-lg",
                    isSelected
                      ? "bg-white text-[#18181B] ring-4 ring-white/25"
                      : "bg-[#27272A] text-white border border-white/20 hover:border-white/50",
                  )}
                >
                  <MapPin className="size-3.5 shrink-0" />
                  <span>{branch.name}</span>
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums",
                      isSelected
                        ? "bg-[#18181B] text-white"
                        : "bg-white/10 text-zinc-200",
                    )}
                  >
                    {branch.availableUnits}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Branch Details & Slot Selection */}
      <div className="p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="flex flex-col justify-between rounded-2xl border border-[#E4E4E7] bg-[#FAFAFA] p-3.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="text-sm font-bold text-[#18181B]">
                  {activeBranch.name}
                </h4>
                <p className="mt-0.5 text-[13px] text-[#71717A]">
                  {activeBranch.addressText}
                </p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full border border-[#E4E4E7] bg-white px-2.5 py-0.5 text-[13px] font-bold text-[#18181B] tabular-nums">
                <PackageCheck className="size-3.5" />
                {activeBranch.availableUnits}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-1">
              {activeBranch.services.map((svc) => (
                <span
                  key={svc}
                  className="rounded-full border border-[#E4E4E7] bg-white px-2 py-0.5 text-[11px] font-medium text-[#52525B]"
                >
                  {svc}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-2xl border border-[#E4E4E7] bg-[#FAFAFA] p-3.5">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-[13px] font-bold text-[#18181B]">
                <Calendar className="size-3.5 text-[#52525B]" />
                <span>Select Time Slot</span>
              </div>
              {activeBranch.slots.map((slot) => {
                const remaining = Math.max(
                  0,
                  slot.capacity - slot.reservedCount,
                );
                const isSlotSelected = slot.id === selectedSlotId;
                return (
                  <button
                    key={slot.id}
                    type="button"
                    disabled={remaining === 0 && !reservationConfirmed}
                    onClick={() => onSelectSlot(slot.id)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-[13px] transition-all",
                      isSlotSelected
                        ? "border-[#18181B] bg-[#18181B] text-white"
                        : "border-[#E4E4E7] bg-white text-[#18181B] hover:bg-[#F4F4F5]",
                    )}
                  >
                    <span className="font-semibold">{formatAppointmentWindow(slot)}</span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums",
                        isSlotSelected
                          ? "bg-white text-[#18181B]"
                          : "bg-[#F4F4F5] text-[#3F3F46]",
                      )}
                    >
                      {remaining} left
                    </span>
                  </button>
                );
              })}
            </div>

            {onConfirmReservation ? (
              <div className="mt-3 flex justify-end pt-2 border-t border-[#E4E4E7]">
                <ActionMorphButton
                  state={
                    reservationConfirmed
                      ? "committed"
                      : isConfirming
                        ? "submitting"
                        : "idle"
                  }
                  idleLabel="Lock Slot & Get QR Pass"
                  submittingLabel="Reserving…"
                  committedLabel="Slot Locked"
                  variant="ink"
                  size="sm"
                  onClick={onConfirmReservation}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
