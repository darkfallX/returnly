import { defineMachine } from "@agent-native/core/state-machine";

export const CLAIM_STATUSES = [
  "draft",
  "submitted",
  "awaiting_evidence",
  "under_review",
  "offer_pending",
  "agreed",
  "appointment_confirmed",
  "inspection",
  "fulfilled",
  "closed",
  "rejected",
  "cancelled",
] as const;

export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const claimStatusMachine = defineMachine({
  id: "returnly_claim_status",
  states: CLAIM_STATUSES,
  initial: "draft",
  terminal: ["cancelled"],
  transitions: {
    submit: {
      from: ["draft"],
      to: "submitted",
    },
    request_evidence: {
      from: ["submitted", "under_review", "offer_pending"],
      to: "awaiting_evidence",
    },
    provide_evidence: {
      from: ["awaiting_evidence", "submitted", "under_review"],
      to: "under_review",
    },
    start_review: {
      from: ["submitted", "awaiting_evidence", "under_review"],
      to: "under_review",
    },
    propose_offer: {
      from: ["submitted", "awaiting_evidence", "under_review", "offer_pending"],
      to: "offer_pending",
    },
    counter_offer: {
      from: ["offer_pending"],
      to: "offer_pending",
    },
    accept_offer: {
      from: ["offer_pending"],
      to: "agreed",
    },
    confirm_appointment: {
      from: ["agreed", "appointment_confirmed"],
      to: "appointment_confirmed",
    },
    record_inspection: {
      from: ["agreed", "appointment_confirmed", "inspection"],
      to: "inspection",
    },
    record_handover: {
      from: ["agreed", "appointment_confirmed", "inspection"],
      to: "fulfilled",
    },
    confirm_completed: {
      from: ["fulfilled"],
      to: "closed",
    },
    reject_claim: {
      from: ["submitted", "awaiting_evidence", "under_review", "offer_pending"],
      to: "rejected",
    },
    reopen_claim: {
      from: ["rejected", "closed"],
      to: "under_review",
    },
    cancel_claim: {
      from: [
        "draft",
        "submitted",
        "awaiting_evidence",
        "under_review",
        "offer_pending",
        "agreed",
      ],
      to: "cancelled",
    },
  },
});

export const OFFER_STATES = [
  "draft",
  "offered",
  "countered",
  "accepted",
  "withdrawn",
  "expired",
] as const;

export type OfferState = (typeof OFFER_STATES)[number];

export const offerStateMachine = defineMachine({
  id: "returnly_offer_state",
  states: OFFER_STATES,
  initial: "draft",
  terminal: ["countered", "accepted", "withdrawn", "expired"],
  transitions: {
    publish: {
      from: ["draft"],
      to: "offered",
    },
    counter: {
      from: ["offered"],
      to: "countered",
    },
    accept: {
      from: ["offered"],
      to: "accepted",
    },
    withdraw: {
      from: ["draft", "offered"],
      to: "withdrawn",
    },
    expire: {
      from: ["draft", "offered"],
      to: "expired",
    },
  },
});

export const RESERVATION_STATUSES = [
  "confirmed",
  "redeemed",
  "cancelled",
  "expired",
] as const;

export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const reservationStatusMachine = defineMachine({
  id: "returnly_reservation_status",
  states: RESERVATION_STATUSES,
  initial: "confirmed",
  terminal: ["redeemed", "cancelled", "expired"],
  transitions: {
    redeem: {
      from: ["confirmed"],
      to: "redeemed",
    },
    cancel: {
      from: ["confirmed"],
      to: "cancelled",
    },
    expire: {
      from: ["confirmed"],
      to: "expired",
    },
  },
});

export const VERIFICATION_STATUSES = [
  "unknown",
  "extracted",
  "user_confirmed",
  "merchant_verified",
] as const;

export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const verificationStatusMachine = defineMachine({
  id: "returnly_verification_status",
  states: VERIFICATION_STATUSES,
  initial: "unknown",
  terminal: [],
  transitions: {
    extract: {
      from: ["unknown"],
      to: "extracted",
    },
    confirm_by_user: {
      from: ["unknown", "extracted", "user_confirmed"],
      to: "user_confirmed",
    },
    verify_by_merchant: {
      from: ["unknown", "extracted", "user_confirmed", "merchant_verified"],
      to: "merchant_verified",
    },
  },
});
