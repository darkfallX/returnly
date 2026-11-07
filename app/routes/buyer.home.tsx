import { lazy, Suspense } from "react";

const Screen = lazy(() => import("../screens/buyer.home"));

export function meta() { return [{ title: "Purchases - Returnly" }]; }

export default function Route() {
  return <Suspense fallback={<p role="status" className="p-6">Opening…</p>}><Screen /></Suspense>;
}
