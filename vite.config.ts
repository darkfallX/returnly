import { agentNative } from "@agent-native/core/vite";
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";

const reactRouterPlugins = reactRouter as unknown as () => any[];
const agentNativePlugins = agentNative as unknown as (
  options?: Parameters<typeof agentNative>[0],
) => any[];

const RETURNLY_BOOT_ID = "returnly_boot";

export default defineConfig({
  define: {
    __RETURNLY_BOOT_ID__: JSON.stringify(RETURNLY_BOOT_ID),
  },
  resolve: { dedupe: ["react", "react-dom", "react-router"] },
  optimizeDeps: {
    include: [
      "lucide-react",
      "qrcode.react",
      "sonner",
      "clsx",
      "tailwind-merge",
      "class-variance-authority",
      "@agent-native/toolkit > culori",
    ],
    entries: [
      "app/entry.client.tsx",
      "app/root.tsx",
      "app/routes/_index.tsx",
      "app/routes/onboarding._index.tsx",
    ],
  },
  plugins: [
    ...reactRouterPlugins(),
    ...agentNativePlugins({
      ssrStubs: ["shiki"],
    }),
    {
      name: "returnly-clean-optimize-deps",
      configResolved(config) {
        if (Array.isArray(config.optimizeDeps?.include)) {
          config.optimizeDeps.include = config.optimizeDeps.include.filter(
            (dep) => !dep.includes("style-to-js"),
          );
        }
      },
    },
  ],
});
