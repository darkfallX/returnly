import { lazy, Suspense } from "react";

const Screen = lazy(() => import("../screens/observability"));

export function meta() { return [{ title: "Observability - Returnly" }]; }

export default function Route() {
  return <Suspense fallback={<p role="status" className="p-6">Opening…</p>}><Screen /></Suspense>;
}
