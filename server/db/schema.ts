import { sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  integer,
  pgTable,
  text,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  ownerEmail: text("owner_email").notNull().unique(),
  displayName: text("display_name").notNull(),
  preferredRole: text("preferred_role").notNull().default("buyer"),
  preferredCurrency: text("preferred_currency").notNull().default("NGN"),
  notificationsOptIn: boolean("notifications_opt_in").notNull().default(true),
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
  demoMode: boolean("demo_mode").notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`now()`),
});

export const merchantOrganizations = pgTable("merchant_organizations", {
  id: text("id").primaryKey(),
  ownerEmail: text("owner_email").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull().default("Consumer Electronics"),
  supportContact: text("support_contact").notNull(),
  demoFlag: boolean("demo_flag").notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`now()`),
});

export const merchantMemberships = pgTable("merchant_memberships", {
  id: text("id").primaryKey(),
  memberUserId: text("member_user_id").notNull(),
  ownerEmail: text("owner_email").notNull(),
  merchantId: text("merchant_id").notNull(),
  role: text("role").notNull().default("owner"), // 'owner' | 'staff'
  createdAt: text("created_at").notNull().default(sql`now()`),
});

export const merchantPolicies = pgTable("merchant_policies", {
  id: text("id").primaryKey(),
  merchantId: text("merchant_id").notNull(),
  version: integer("version").notNull().default(1),
  returnDays: integer("return_days"),
  warrantyDays: integer("warranty_days"),
  conditionsJson: text("conditions_json").notNull(),
  effectiveAt: text("effective_at").notNull().default(sql`now()`),
});

export const branches = pgTable("branches", {
  id: text("id").primaryKey(),
  merchantId: text("merchant_id").notNull(),
  name: text("name").notNull(),
  addressText: text("address_text").notNull(),
  city: text("city").notNull().default("Lagos"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  servicesJson: text("services_json").notNull().default('["inspection","replacement","repair","drop_off","pickup"]'),
  verifiedAt: text("verified_at"),
});

export const inventory = pgTable("inventory", {
  id: text("id").primaryKey(),
  merchantId: text("merchant_id").notNull(),
  branchId: text("branch_id").notNull(),
  productSku: text("product_sku").notNull(),
  productName: text("product_name").notNull(),
  onHand: integer("on_hand").notNull().default(0),
  reserved: integer("reserved").notNull().default(0),
  updatedAt: text("updated_at").notNull().default(sql`now()`),
});

export const slots = pgTable("slots", {
  id: text("id").primaryKey(),
  merchantId: text("merchant_id").notNull(),
  branchId: text("branch_id").notNull(),
  startAt: text("start_at").notNull(),
  endAt: text("end_at").notNull(),
  label: text("label").notNull(),
  capacity: integer("capacity").notNull().default(2),
  reservedCount: integer("reserved_count").notNull().default(0),
  serviceType: text("service_type").notNull().default("inspection_or_swap"),
});

export const purchases = pgTable("purchases", {
  id: text("id").primaryKey(),
  buyerUserId: text("buyer_user_id").notNull(),
  ownerEmail: text("owner_email").notNull(),
  merchantId: text("merchant_id"),
  merchantName: text("merchant_name").notNull(),
  branchId: text("branch_id"),
  productName: text("product_name").notNull(),
  category: text("category").notNull().default("Audio"),
  sku: text("sku"),
  serial: text("serial"),
  orderNumber: text("order_number"),
  amountMinor: integer("amount_minor").notNull(),
  currencyCode: text("currency_code").notNull().default("NGN"),
  purchasedAt: text("purchased_at").notNull(),
  sourceType: text("source_type").notNull().default("manual"), // 'manual' | 'receipt_upload' | 'demo_seed'
  receiptId: text("receipt_id"),
  verificationStatus: text("verification_status").notNull().default("user_confirmed"), // 'unknown' | 'extracted' | 'user_confirmed' | 'merchant_verified'
  confidenceJson: text("confidence_json").notNull().default("{}"),
  createdAt: text("created_at").notNull().default(sql`now()`),
});

export const attachments = pgTable("attachments", {
  id: text("id").primaryKey(),
  ownerUserId: text("owner_user_id").notNull(),
  ownerEmail: text("owner_email").notNull(),
  caseId: text("case_id"),
  purchaseId: text("purchase_id"),
  storageKey: text("storage_key").notNull(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull().default(0),
  purpose: text("purpose").notNull().default("evidence"), // 'receipt' | 'defect_photo' | 'defect_video'
  disclosedToMerchant: boolean("disclosed_to_merchant").notNull().default(false),
  dataUrl: text("data_url"),
  uploadedAt: text("uploaded_at").notNull().default(sql`now()`),
  deletedAt: text("deleted_at"),
});

export const claims = pgTable("claims", {
  id: text("id").primaryKey(),
  claimCode: text("claim_code").notNull(),
  purchaseId: text("purchase_id").notNull(),
  buyerUserId: text("buyer_user_id").notNull(),
  ownerEmail: text("owner_email").notNull(),
  merchantId: text("merchant_id").notNull(),
  status: text("status").notNull().default("draft"),
  issueTitle: text("issue_title").notNull(),
  issueDescription: text("issue_description").notNull(),
  preferredResolution: text("preferred_resolution").notNull().default("replacement"), // 'inspection' | 'repair' | 'replacement' | 'full_refund_request' | 'partial_keep_item_refund'
  preferredLogistics: text("preferred_logistics").notNull().default("pickup"), // 'drop_off' | 'pickup'
  preferredBranchId: text("preferred_branch_id"),
  preferredSlotId: text("preferred_slot_id"),
  policyVersionId: text("policy_version_id"),
  lastChangedBy: text("last_changed_by").notNull().default("Buyer"),
  lastActionSource: text("last_action_source").notNull().default("buyer_ui"),
  createdAt: text("created_at").notNull().default(sql`now()`),
  updatedAt: text("updated_at").notNull().default(sql`now()`),
  resolvedAt: text("resolved_at"),
  version: integer("version").notNull().default(1),
});

export const claimEvidence = pgTable("claim_evidence", {
  id: text("id").primaryKey(),
  claimId: text("claim_id").notNull(),
  attachmentId: text("attachment_id"),
  submittedBy: text("submitted_by").notNull().default("buyer"), // 'buyer' | 'buyer_agent' | 'merchant'
  label: text("label").notNull(),
  mediaKind: text("media_kind").notNull().default("photo"), // 'receipt' | 'photo' | 'video' | 'Serial'
  isVerified: boolean("is_verified").notNull().default(false),
  confidence: integer("confidence").notNull().default(95),
  note: text("note").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`now()`),
});

export const triageResults = pgTable("triage_results", {
  id: text("id").primaryKey(),
  claimId: text("claim_id").notNull(),
  actorType: text("actor_type").notNull().default("merchant_agent"),
  policyMatch: text("policy_match").notNull().default("uncertain"), // 'matched' | 'not_matched' | 'uncertain'
  daysSincePurchase: integer("days_since_purchase"),
  missingItemsJson: text("missing_items_json").notNull().default("[]"),
  stockSnapshotJson: text("stock_snapshot_json").notNull().default("[]"),
  recommendedRemediesJson: text("recommended_remedies_json").notNull().default("[]"),
  reasoningSummary: text("reasoning_summary").notNull(),
  sourceRefsJson: text("source_refs_json").notNull().default("[]"),
  createdAt: text("created_at").notNull().default(sql`now()`),
});

export const claimMessages = pgTable("claim_messages", {
  id: text("id").primaryKey(),
  claimId: text("claim_id").notNull(),
  senderUserId: text("sender_user_id"),
  senderRole: text("sender_role").notNull(), // 'buyer' | 'buyer_agent' | 'merchant' | 'merchant_agent' | 'system'
  body: text("body").notNull(),
  kind: text("kind").notNull().default("human"), // 'human' | 'agent-draft' | 'system'
  sentAt: text("sent_at").notNull().default(sql`now()`),
  externalMessageId: text("external_message_id"),
});

export const resolutionOffers = pgTable("resolution_offers", {
  id: text("id").primaryKey(),
  claimId: text("claim_id").notNull(),
  createdByRole: text("created_by_role").notNull(), // 'merchant' | 'merchant_agent' | 'buyer' | 'buyer_agent'
  remedyType: text("remedy_type").notNull(), // 'inspection' | 'repair' | 'replacement' | 'full_refund_request' | 'partial_keep_item_refund'
  logisticsType: text("logistics_type").notNull().default("drop_off"), // 'drop_off' | 'pickup'
  refundMinor: integer("refund_minor"),
  refundPercent: integer("refund_percent"),
  currency: text("currency").notNull().default("NGN"),
  branchId: text("branch_id"),
  slotId: text("slot_id"),
  note: text("note").notNull().default(""),
  conditionsJson: text("conditions_json").notNull().default("{}"),
  state: text("state").notNull().default("offered"), // 'draft' | 'offered' | 'countered' | 'accepted' | 'withdrawn' | 'expired'
  version: integer("version").notNull().default(1),
  createdAt: text("created_at").notNull().default(sql`now()`),
  expiresAt: text("expires_at"),
});

export const reservations = pgTable("reservations", {
  id: text("id").primaryKey(),
  claimId: text("claim_id").notNull(),
  offerId: text("offer_id").notNull(),
  inventoryId: text("inventory_id"),
  slotId: text("slot_id").notNull(),
  branchId: text("branch_id").notNull(),
  status: text("status").notNull().default("confirmed"), // 'confirmed' | 'redeemed' | 'cancelled' | 'expired'
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`now()`),
});

export const returnPasses = pgTable("return_passes", {
  id: text("id").primaryKey(),
  claimId: text("claim_id").notNull(),
  reservationId: text("reservation_id").notNull(),
  publicToken: text("public_token").notNull().unique(),
  hashedToken: text("hashed_token").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  inspectedAt: text("inspected_at"),
  inspectionNote: text("inspection_note"),
  redeemedAt: text("redeemed_at"),
  handoverNote: text("handover_note"),
  invalidatedAt: text("invalidated_at"),
  createdAt: text("created_at").notNull().default(sql`now()`),
});

export const claimEvents = pgTable("claim_events", {
  id: text("id").primaryKey(),
  claimId: text("claim_id").notNull(),
  actorUserId: text("actor_user_id"),
  actorRole: text("actor_role").notNull(), // 'buyer' | 'merchant' | 'system'
  actorSource: text("actor_source").notNull(), // 'buyer_ui' | 'buyer_agent' | 'merchant_ui' | 'merchant_agent' | 'system'
  actionType: text("action_type").notNull(),
  summary: text("summary").notNull(),
  payloadRedactedJson: text("payload_redacted_json").notNull().default("{}"),
  createdAt: text("created_at").notNull().default(sql`now()`),
  idempotencyKey: text("idempotency_key"),
});

export const agentPermissions = pgTable("agent_permissions", {
  id: text("id").primaryKey(),
  ownerEmail: text("owner_email").notNull(),
  scope: text("scope").notNull(),
  enabled: boolean("enabled").notNull().default(false),
  expiresAt: text("expires_at"),
  maxFollowupsPerCase: integer("max_followups_per_case").notNull().default(2),
});

export const pendingApprovals = pgTable("pending_approvals", {
  id: text("id").primaryKey(),
  claimId: text("claim_id").notNull(),
  ownerEmail: text("owner_email").notNull(),
  actorRole: text("actor_role").notNull(), // 'buyer' | 'merchant'
  actionName: text("action_name").notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  payloadJson: text("payload_json").notNull().default("{}"),
  status: text("status").notNull().default("pending"), // 'pending' | 'approved' | 'rejected'
  idempotencyKey: text("idempotency_key").notNull().unique(),
  createdAt: text("created_at").notNull().default(sql`now()`),
  resolvedAt: text("resolved_at"),
});
