/**
 * Intro gate: every fresh start of the local server shows the onboarding
 * intro first, like an app's first-launch screen. After the user picks a
 * workspace, the intro is skipped until the server starts again.
 *
 * `__RETURNLY_BOOT_ID__` is injected by `vite.config.ts` once per dev-server
 * start (and once per production build).
 */
declare const __RETURNLY_BOOT_ID__: string | undefined;

export const BOOT_ID: string =
  typeof __RETURNLY_BOOT_ID__ === "string" ? __RETURNLY_BOOT_ID__ : "static";

const SEEN_KEY = "returnly:intro-seen-boot";
const ROLE_KEY = "returnly:intro-role";

export type IntroRole = "buyer" | "merchant" | "demo";

/** Paths that are part of the intro and never gated. */
export function isIntroPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/onboarding" ||
    pathname.startsWith("/onboarding/") ||
    pathname.startsWith("/pass/")
  );
}

export function hasSeenIntro(): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY) === BOOT_ID;
  } catch {
    return false;
  }
}

export function markIntroSeen(role: IntroRole): void {
  try {
    window.localStorage.setItem(SEEN_KEY, BOOT_ID);
    window.localStorage.setItem(ROLE_KEY, role);
  } catch {
    // Storage unavailable (private mode); the intro simply shows again.
  }
}

export function introHomePath(): string {
  let role: string | null = null;
  try {
    role = window.localStorage.getItem(ROLE_KEY);
  } catch {
    role = null;
  }
  if (role === "merchant") return "/merchant/home";
  if (role === "demo") return "/demo";
  return "/buyer/home";
}
