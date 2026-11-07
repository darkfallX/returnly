import OnboardingIndexRoute from "./onboarding._index";

export function meta() {
  return [
    { title: "Returnly - Post-Purchase Resolution" },
    {
      name: "description",
      content:
        "We'll help make this right. Turn receipts, warranty claims, and defective purchases into verified replacements, repairs, or refunds.",
    },
  ];
}

export default function LandingRoute() {
  return <OnboardingIndexRoute />;
}
