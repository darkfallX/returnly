import { useEffect, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router";
import { OnboardingFlow } from "@/components/returnly/OnboardingFlow";
import { hasSeenIntro, introHomePath, markIntroSeen } from "@/lib/intro-gate";

export function meta() { return [{ title: "Welcome - Returnly" }]; }
export default function OnboardingIndexRoute() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [seen, setSeen] = useState(false);
  useEffect(() => { setSeen(hasSeenIntro()); }, []);
  if (seen && params.get("new") !== "1") return <Navigate to={introHomePath()} replace />;
  return <OnboardingFlow onDemo={() => { markIntroSeen("demo"); navigate("/demo?setup=1"); }} />;
}
