import { createAuthPlugin } from "@agent-native/core/server";

export default createAuthPlugin({
  workspaceAppPublicPaths: [
    "/",
    "/onboarding",
    "/onboarding/buyer",
    "/onboarding/merchant",
    "/demo",
  ],
  publicPaths: [
    "/",
    "/onboarding",
    "/onboarding/buyer",
    "/onboarding/merchant",
    "/demo",
  ],
  rootAuth: false,
  marketing: false,
});
