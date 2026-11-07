import { appPath } from "@agent-native/core/client/api-path";
import { getLocaleInitScript } from "@agent-native/core/client/i18n";
import { getThemeInitScript } from "@agent-native/core/client/theme";
import { lazy, Suspense, useEffect, useState } from "react";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
  useNavigate,
} from "react-router";
import type { LinksFunction } from "react-router";

import { hasSeenIntro, isIntroPath } from "@/lib/intro-gate";
import { APP_TITLE } from "@/lib/app-config";


import stylesheet from "./global.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesheet },
];

const THEME_INIT_SCRIPT = getThemeInitScript();
const LOCALE_INIT_SCRIPT = getLocaleInitScript();

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, interactive-widget=resizes-content"
        />
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
        <script
          data-agent-native-locale-init
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: LOCALE_INIT_SCRIPT }}
        />
        <meta name="theme-color" content="#18181B" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="apple-mobile-web-app-title" content={APP_TITLE} />
        <link rel="icon" type="image/svg+xml" href={appPath("/favicon.svg")} />
        <link rel="apple-touch-icon" href={appPath("/icon-180.svg")} />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

// The workspace shell (sidebar, agent chat, command menu) is a large module
// graph. Load it only when a workspace route is entered.
const loadWorkspaceContent = () =>
  import("@/components/layout/WorkspaceContent");
const WorkspaceContent = lazy(loadWorkspaceContent);

function isBareIntroLayout(pathname: string): boolean {
  return pathname === "/" || pathname.startsWith("/onboarding");
}

function WorkspaceFallback() {
  return (
    <div
      role="status"
      aria-label="Opening workspace"
      className="flex h-dvh w-full items-center justify-center bg-[#FAFAFA]"
    >
      <span className="size-6 animate-spin rounded-full border-2 border-[#E4E4E7] border-t-[#18181B]" />
    </div>
  );
}

function AppContent() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const gated = !isIntroPath(pathname);
  // Server render and first client render agree ("checking"), so there is no
  // hydration mismatch; the browser-only check runs right after mount.
  const [introChecked, setIntroChecked] = useState(!gated);

  useEffect(() => {
    if (!gated) {
      setIntroChecked(true);
      return;
    }
    if (hasSeenIntro()) {
      setIntroChecked(true);
    } else {
      navigate("/", { replace: true });
    }
  }, [gated, navigate]);

  if (isBareIntroLayout(pathname)) {
    return (
      <main className="h-dvh overflow-y-auto bg-[#FAFAFA]">
        <Outlet />
      </main>
    );
  }
  if (!introChecked) return <WorkspaceFallback />;
  return (
    <Suspense fallback={<WorkspaceFallback />}>
      <WorkspaceContent />
    </Suspense>
  );
}

const WorkspaceProviders = lazy(() => import("@/components/layout/WorkspaceProviders"));

export default function Root() {
  const { pathname } = useLocation();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const needsProviders = pathname !== "/" && pathname !== "/onboarding";
  const [providersLoaded, setProvidersLoaded] = useState(needsProviders);
  useEffect(() => { if (needsProviders) setProvidersLoaded(true); }, [needsProviders]);
  // The native document renderer has a five-second stream deadline. Keep the
  // workspace shell out of SSR rather than racing cold dev imports against it.
  // The first browser render matches; native providers then enforce sign-in.
  if ((needsProviders || providersLoaded) && !hydrated) return <WorkspaceFallback />;
  // Keep providers mounted once entered, preserving the shared agent controller on later navigation.
  if (needsProviders || providersLoaded) return <Suspense fallback={<WorkspaceFallback />}><WorkspaceProviders><AppContent /></WorkspaceProviders></Suspense>;
  return <AppContent />;
}

const FrameworkErrorBoundary = lazy(() => import("@agent-native/toolkit/app/shared/ErrorBoundary").then((module) => ({ default: module.ErrorBoundary })));
export function ErrorBoundary() {
  return <Suspense fallback={<div role="alert" className="p-8"><p>Returnly could not open this page.</p><button type="button" onClick={() => window.location.reload()}>Try again</button></div>}><FrameworkErrorBoundary /></Suspense>;
}
