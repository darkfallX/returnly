import {
  appBasePath,
  appPathFromLocalRoute,
} from "@agent-native/core/client/api-path";
import { useAgentRouteState } from "@agent-native/core/client/navigation";

import {
  chatThreadPath,
  HOME_PATH,
  isChatPathname,
  NEW_CHAT_PATH,
  threadIdFromPath,
} from "@/lib/chat-paths";
import { TAB_ID } from "@/lib/tab-id";

export interface NavigationState {
  view?: string;
  path?: string;
  publicPath?: string;
  threadId?: string;
  purchaseId?: string;
  claimId?: string;
  token?: string;
}

export function useNavigationState() {
  useAgentRouteState<NavigationState>({
    browserTabId: TAB_ID,
    requestSource: TAB_ID,
    getNavigationState: ({ pathname }) => navigationStateForPath(pathname),
    getCommandPath: commandPathForNavigation,
  });
}

export function commandPathForNavigation(command: NavigationState): string {
  const fallbackPath = pathForCommand(command);
  const path = typeof command?.path === "string" ? command.path : "";
  if (!path) return fallbackPath;

  const basePath = appBasePath();
  if (!basePath) return path;

  const suffixIndex = path.search(/[?#]/);
  const pathname = suffixIndex === -1 ? path : path.slice(0, suffixIndex);
  const suffix = suffixIndex === -1 ? "" : path.slice(suffixIndex);
  const publicPath =
    typeof command?.publicPath === "string" ? command.publicPath : "";
  const publicPathSuffixIndex = publicPath.search(/[?#]/);
  const declaredPublicPath =
    publicPathSuffixIndex === -1
      ? publicPath
      : publicPath.slice(0, publicPathSuffixIndex);
  const publicViewPath = appPathFromLocalRoute(
    pathForView(command?.view, command),
  );
  if (
    matchesPathPrefix(pathname, basePath) &&
    (matchesPathPrefix(pathname, publicViewPath) ||
      (declaredPublicPath && declaredPublicPath === pathname))
  ) {
    return `${pathname.slice(basePath.length) || "/"}${suffix}`;
  }
  return path;
}

function matchesPathPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function navigationStateForPath(pathname: string): NavigationState {
  const threadId = threadIdFromPath(pathname);
  const purchaseMatch = pathname.match(/^\/buyer\/purchases\/([^/]+)/);
  const buyerClaimMatch = pathname.match(/^\/buyer\/claims\/([^/]+)/);
  const merchantClaimMatch = pathname.match(/^\/merchant\/claims\/([^/]+)/);
  const passMatch = pathname.match(/^\/pass\/([^/]+)/);

  return {
    view: viewForPath(pathname),
    path: pathname,
    publicPath: appPathFromLocalRoute(pathname),
    ...(threadId ? { threadId } : {}),
    ...(purchaseMatch ? { purchaseId: purchaseMatch[1] } : {}),
    ...(buyerClaimMatch ? { claimId: buyerClaimMatch[1] } : {}),
    ...(merchantClaimMatch ? { claimId: merchantClaimMatch[1] } : {}),
    ...(passMatch ? { token: passMatch[1] } : {}),
  };
}

function viewForPath(pathname: string): string {
  if (pathname === "/") return "landing";
  if (pathname === "/onboarding") return "onboarding";
  if (pathname === "/onboarding/buyer") return "onboarding-buyer";
  if (pathname === "/onboarding/merchant") return "onboarding-merchant";
  if (pathname === "/buyer/home") return "buyer-home";
  if (pathname === "/buyer/vault") return "buyer-vault";
  if (pathname.startsWith("/buyer/purchases/")) return "buyer-purchase-detail";
  if (pathname === "/buyer/claims") return "buyer-claims";
  if (pathname.startsWith("/buyer/claims/")) return "buyer-claim-detail";
  if (pathname === "/merchant/home") return "merchant-home";
  if (pathname === "/merchant/claims") return "merchant-claims";
  if (pathname.startsWith("/merchant/claims/")) return "merchant-claim-detail";
  if (pathname === "/merchant/settings") return "merchant-settings";
  if (pathname === "/demo") return "demo";
  if (pathname.startsWith("/pass/")) return "pass-verify";
  if (isChatPathname(pathname)) return "chat";
  if (pathname === HOME_PATH) return "home";
  if (pathname.startsWith("/database")) return "database";
  if (pathname.startsWith("/extensions")) return "extensions";
  if (pathname.startsWith("/observability")) return "observability";
  if (pathname.startsWith("/settings/agent") || pathname.startsWith("/agent")) {
    return "agent";
  }
  if (pathname.startsWith("/settings")) return "settings";
  if (pathname.startsWith("/team")) return "settings";
  return "landing";
}

function pathForView(view?: string, cmd?: NavigationState): string {
  switch (view) {
    case "landing":
      return "/";
    case "onboarding":
      return "/onboarding";
    case "onboarding-buyer":
      return "/onboarding/buyer";
    case "onboarding-merchant":
      return "/onboarding/merchant";
    case "buyer-home":
      return "/buyer/home";
    case "buyer-vault":
      return "/buyer/vault";
    case "buyer-purchase-detail":
      return cmd?.purchaseId
        ? `/buyer/purchases/${cmd.purchaseId}`
        : "/buyer/vault";
    case "buyer-claims":
      return "/buyer/claims";
    case "buyer-claim-detail":
      return cmd?.claimId ? `/buyer/claims/${cmd.claimId}` : "/buyer/claims";
    case "merchant-home":
      return "/merchant/home";
    case "merchant-claims":
      return "/merchant/claims";
    case "merchant-claim-detail":
      return cmd?.claimId
        ? `/merchant/claims/${cmd.claimId}`
        : "/merchant/claims";
    case "merchant-settings":
      return "/merchant/settings";
    case "demo":
      return "/demo";
    case "pass-verify":
      return cmd?.token ? `/pass/${cmd.token}` : "/merchant/claims";
    case "chat":
    case "ask":
      return NEW_CHAT_PATH;
    case "home":
      return HOME_PATH;
    case "database":
      return "/database";
    case "extensions":
      return "/extensions";
    case "observability":
      return "/observability";
    case "agent":
      return "/agent";
    case "settings":
      return "/settings";
    default:
      if (cmd?.claimId) return `/buyer/claims/${cmd.claimId}`;
      if (cmd?.purchaseId) return `/buyer/purchases/${cmd.purchaseId}`;
      if (cmd?.token) return `/pass/${cmd.token}`;
      return "/";
  }
}

function pathForCommand(command: NavigationState): string {
  if (command.view === "chat" && command.threadId) {
    return chatThreadPath(command.threadId);
  }
  return pathForView(command.view, command);
}
