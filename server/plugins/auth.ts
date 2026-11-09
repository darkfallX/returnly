import { createAuthPlugin } from "@agent-native/core/server";

export default createAuthPlugin({
  workspaceAppPublicPaths: [
    "/",
    "/onboarding",
  ],
  publicPaths: [
    "/",
    "/onboarding",
  ],
  rootAuth: false,
  marketing: false,
});
