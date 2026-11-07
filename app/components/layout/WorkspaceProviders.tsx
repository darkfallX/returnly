import { configureTracking } from "@agent-native/core/client/analytics";
import { createAgentNativeQueryClient, useDbSync } from "@agent-native/core/client/hooks";
import { AppProviders } from "@agent-native/toolkit/app/providers";
import { ClientOnly } from "@agent-native/toolkit/app/shared/ClientOnly";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { useLocation } from "react-router";
import { AppToolkitProvider } from "@/components/ui/toolkit-provider";
import { useNavigationState } from "@/hooks/use-navigation-state";
import { TAB_ID } from "@/lib/tab-id";
import { i18nCatalog } from "@/i18n";

configureTracking({ getDefaultProps: (_name, properties) => ({ ...properties, app: "returnly", template: "chat" }) });

function DbSyncSetup() {
  const qc = useQueryClient();
  const { pathname } = useLocation();
  const watchesResolution =
    pathname === "/demo" ||
    pathname === "/merchant/home" ||
    /^\/(buyer|merchant)\/claims(?:\/|$)/.test(pathname);
  useNavigationState();
  useDbSync({
    queryClient: qc,
    ignoreSource: TAB_ID,
    ...(watchesResolution
      ? {
          realtime: {
            reason:
              "Another participant tab can update this resolution while it is open",
          },
        }
      : {}),
    pauseWhenHidden: true,
  });
  return null;
}

export default function WorkspaceProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => createAgentNativeQueryClient());
  const { pathname } = useLocation();
  const isPublic = pathname === "/" || pathname === "/onboarding";
  return <AppToolkitProvider><AppProviders queryClient={queryClient} isPublicPath={isPublic} skeletonLayout="assistant" i18n={{ catalog: i18nCatalog }}>
    <ClientOnly><DbSyncSetup /></ClientOnly>{children}
  </AppProviders></AppToolkitProvider>;
}
