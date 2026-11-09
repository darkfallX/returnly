import { runMigrations } from "@agent-native/core/db";

import "../db/index.ts";

export const RETURNLY_INITIAL_DDL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  owner_email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  preferred_role TEXT NOT NULL DEFAULT 'buyer',
  preferred_currency TEXT NOT NULL DEFAULT 'NGN',
  notifications_opt_in BOOLEAN NOT NULL DEFAULT true,
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  demo_mode BOOLEAN NOT NULL DEFAULT false,
  created_at TEXT NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS merchant_organizations (
  id TEXT PRIMARY KEY,
  owner_email TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Consumer Electronics',
  support_contact TEXT NOT NULL,
  demo_flag BOOLEAN NOT NULL DEFAULT false,
  created_at TEXT NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS merchant_memberships (
  id TEXT PRIMARY KEY,
  member_user_id TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  merchant_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'owner',
  created_at TEXT NOT NULL DEFAULT now(),
  UNIQUE(merchant_id, member_user_id)
);

CREATE TABLE IF NOT EXISTS merchant_policies (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  return_days INTEGER,
  warranty_days INTEGER,
  conditions_json TEXT NOT NULL,
  effective_at TEXT NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS branches (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  address_text TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT 'Lagos',
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  services_json TEXT NOT NULL DEFAULT '["inspection","replacement","repair","drop_off","pickup"]',
  verified_at TEXT
);

CREATE TABLE IF NOT EXISTS inventory (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  product_sku TEXT NOT NULL,
  product_name TEXT NOT NULL,
  on_hand INTEGER NOT NULL DEFAULT 0 CHECK (on_hand >= 0),
  reserved INTEGER NOT NULL DEFAULT 0 CHECK (reserved >= 0 AND reserved <= on_hand),
  updated_at TEXT NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS slots (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  label TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 2 CHECK (capacity >= 0),
  reserved_count INTEGER NOT NULL DEFAULT 0 CHECK (reserved_count >= 0 AND reserved_count <= capacity),
  service_type TEXT NOT NULL DEFAULT 'inspection_or_swap'
);

CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY,
  buyer_user_id TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  merchant_id TEXT,
  merchant_name TEXT NOT NULL,
  branch_id TEXT,
  product_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Audio',
  sku TEXT,
  serial TEXT,
  order_number TEXT,
  amount_minor INTEGER NOT NULL,
  currency_code TEXT NOT NULL DEFAULT 'NGN',
  purchased_at TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'manual',
  receipt_id TEXT,
  verification_status TEXT NOT NULL DEFAULT 'user_confirmed',
  confidence_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  case_id TEXT,
  purchase_id TEXT,
  storage_key TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  purpose TEXT NOT NULL DEFAULT 'evidence',
  uploaded_at TEXT NOT NULL DEFAULT now(),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS claims (
  id TEXT PRIMARY KEY,
  claim_code TEXT NOT NULL,
  purchase_id TEXT NOT NULL,
  buyer_user_id TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  merchant_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  issue_title TEXT NOT NULL,
  issue_description TEXT NOT NULL,
  preferred_resolution TEXT NOT NULL DEFAULT 'replacement',
  preferred_logistics TEXT NOT NULL DEFAULT 'pickup',
  preferred_branch_id TEXT,
  preferred_slot_id TEXT,
  policy_version_id TEXT,
  last_changed_by TEXT NOT NULL DEFAULT 'Buyer',
  last_action_source TEXT NOT NULL DEFAULT 'buyer_ui',
  created_at TEXT NOT NULL DEFAULT now(),
  updated_at TEXT NOT NULL DEFAULT now(),
  resolved_at TEXT,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS claim_evidence (
  id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL,
  attachment_id TEXT,
  submitted_by TEXT NOT NULL DEFAULT 'buyer',
  label TEXT NOT NULL,
  media_kind TEXT NOT NULL DEFAULT 'photo',
  is_verified BOOLEAN NOT NULL DEFAULT false,
  confidence INTEGER NOT NULL DEFAULT 95,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS triage_results (
  id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL,
  actor_type TEXT NOT NULL DEFAULT 'merchant_agent',
  policy_match TEXT NOT NULL DEFAULT 'uncertain',
  days_since_purchase INTEGER NOT NULL DEFAULT 0,
  missing_items_json TEXT NOT NULL DEFAULT '[]',
  stock_snapshot_json TEXT NOT NULL DEFAULT '[]',
  recommended_remedies_json TEXT NOT NULL DEFAULT '[]',
  reasoning_summary TEXT NOT NULL,
  source_refs_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS claim_messages (
  id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL,
  sender_user_id TEXT,
  sender_role TEXT NOT NULL,
  body TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'human',
  sent_at TEXT NOT NULL DEFAULT now(),
  external_message_id TEXT
);

CREATE TABLE IF NOT EXISTS resolution_offers (
  id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL,
  created_by_role TEXT NOT NULL,
  remedy_type TEXT NOT NULL,
  logistics_type TEXT NOT NULL DEFAULT 'drop_off',
  refund_minor INTEGER,
  refund_percent INTEGER,
  currency TEXT NOT NULL DEFAULT 'NGN',
  branch_id TEXT,
  slot_id TEXT,
  note TEXT NOT NULL DEFAULT '',
  conditions_json TEXT NOT NULL DEFAULT '{}',
  state TEXT NOT NULL DEFAULT 'offered',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT now(),
  expires_at TEXT
);

CREATE TABLE IF NOT EXISTS reservations (
  id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL,
  offer_id TEXT NOT NULL,
  inventory_id TEXT,
  slot_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed',
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS return_passes (
  id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL,
  reservation_id TEXT NOT NULL,
  public_token TEXT NOT NULL UNIQUE,
  hashed_token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  inspected_at TEXT,
  inspection_note TEXT,
  redeemed_at TEXT,
  handover_note TEXT,
  invalidated_at TEXT,
  created_at TEXT NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS claim_events (
  id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL,
  actor_user_id TEXT,
  actor_role TEXT NOT NULL,
  actor_source TEXT NOT NULL,
  action_type TEXT NOT NULL,
  summary TEXT NOT NULL,
  payload_redacted_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT now(),
  idempotency_key TEXT UNIQUE
);

CREATE TABLE IF NOT EXISTS agent_permissions (
  id TEXT PRIMARY KEY,
  owner_email TEXT NOT NULL,
  scope TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  expires_at TEXT,
  max_followups_per_case INTEGER NOT NULL DEFAULT 2
);

CREATE INDEX IF NOT EXISTS idx_purchases_owner ON purchases(owner_email);
CREATE INDEX IF NOT EXISTS idx_claims_owner ON claims(owner_email);
CREATE INDEX IF NOT EXISTS idx_claims_merchant ON claims(merchant_id);
CREATE INDEX IF NOT EXISTS idx_claim_events_claim ON claim_events(claim_id);
CREATE INDEX IF NOT EXISTS idx_resolution_offers_claim ON resolution_offers(claim_id);
`;

export const RETURNLY_UNKNOWN_FACTS_DDL = `
ALTER TABLE triage_results ALTER COLUMN days_since_purchase DROP NOT NULL;
ALTER TABLE triage_results ALTER COLUMN days_since_purchase DROP DEFAULT;
UPDATE triage_results SET days_since_purchase = NULL WHERE days_since_purchase < 0;
`;

export const RETURNLY_V3_UPGRADE_DDL = `
ALTER TABLE attachments ADD COLUMN IF NOT EXISTS disclosed_to_merchant BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE attachments ADD COLUMN IF NOT EXISTS data_url TEXT;

CREATE TABLE IF NOT EXISTS pending_approvals (
  id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  action_name TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT now(),
  resolved_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_pending_approvals_claim ON pending_approvals(claim_id);
`;

export const migrateReturnlyDb = runMigrations(
  [
    {
      version: 1,
      name: "initial_returnly_schema",
      sql: RETURNLY_INITIAL_DDL,
    },
    { version: 2, name: "nullable_unknown_purchase_age", sql: RETURNLY_UNKNOWN_FACTS_DDL },
    { version: 3, name: "private_disclosure_and_pending_approvals", sql: RETURNLY_V3_UPGRADE_DDL },
  ],
  { table: "returnly_migrations", runInServerlessRequest: true },
);

export default migrateReturnlyDb;
