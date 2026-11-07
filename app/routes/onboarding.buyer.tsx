import { lazy, Suspense } from "react";

const Screen = lazy(() => import("../screens/onboarding.buyer"));

export function meta() { return [{ title: "Buyer Setup - Returnly" }]; }

export default function Route() {
  return <Suspense fallback={<p role="status" className="p-6">Opening…</p>}><Screen /></Suspense>;
}
