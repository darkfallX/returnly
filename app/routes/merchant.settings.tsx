import { lazy, Suspense } from "react";

const Screen = lazy(() => import("../screens/merchant.settings"));

export function meta() { return [{ title: "Store Settings - Returnly" }]; }

export default function Route() {
  return <Suspense fallback={<p role="status" className="p-6">Opening…</p>}><Screen /></Suspense>;
}
