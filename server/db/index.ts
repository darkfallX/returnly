import { createGetDb } from "@agent-native/core/db";
import { registerIdentityColumns } from "@agent-native/core/org";

import * as schema from "./schema.ts";

registerIdentityColumns([
  {
    table: "merchant_memberships",
    column: "owner_email",
    emailChange: "rekey",
    offboard: "delete",
    reason:
      "Merchant staff membership is a role grant and should be deleted on member offboarding.",
  },
  {
    table: "agent_permissions",
    column: "owner_email",
    emailChange: "rekey",
    offboard: "delete",
    reason:
      "Bounded agent follow-up permission grants should be removed when a member is offboarded.",
  },
]);

export const getDb = createGetDb(schema);
export { schema };
