import { lazy, Suspense } from "react";

const Screen = lazy(() => import("../screens/database"));

export function meta() { return [{ title: "Database - Returnly" }]; }

export default function Route() {
  return <Suspense fallback={<p role="status" className="p-6">Opening…</p>}><Screen /></Suspense>;
}
