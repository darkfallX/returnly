import { lazy, Suspense } from "react";

const Screen = lazy(() => import("../screens/buyer.claims._index"));

export function meta() { return [{ title: "Claims - Returnly" }]; }

export default function Route() {
  return <Suspense fallback={<p role="status" className="p-6">Opening…</p>}><Screen /></Suspense>;
}
