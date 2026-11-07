import { lazy, Suspense } from "react";

const Screen = lazy(() => import("../screens/buyer.claims.$id"));

export function meta() { return [{ title: "Resolution Room - Returnly" }]; }

export default function Route() {
  return <Suspense fallback={<p role="status" className="p-6">Opening…</p>}><Screen /></Suspense>;
}
