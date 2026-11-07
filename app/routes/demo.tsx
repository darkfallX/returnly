import { lazy, Suspense } from "react";

const Screen = lazy(() => import("../screens/demo"));

export function meta() { return [{ title: "Split Demo - Returnly" }]; }

export default function Route() {
  return <Suspense fallback={<p role="status" className="p-6">Opening…</p>}><Screen /></Suspense>;
}
