import { lazy, Suspense } from "react";

const Screen = lazy(() => import("../screens/pass.$token"));

export function meta() { return [{ title: "Verify Pass - Returnly" }]; }

export default function Route() {
  return <Suspense fallback={<p role="status" className="p-6">Opening…</p>}><Screen /></Suspense>;
}
