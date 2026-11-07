import { useActionQuery } from "@agent-native/core/client/hooks";
import { ArrowLeft, Columns2 } from "lucide-react";
import { useParams } from "react-router";

import { Btn } from "@/components/returnly/Btn";
import { ResolutionRoom } from "@/components/returnly/ResolutionRoom";

export function meta() {
  return [{ title: "Resolution Room - Returnly" }];
}

export default function BuyerClaimDetailRoute() {
  const { id = "" } = useParams();
  const { data: viewer } = useActionQuery("get-viewer-context", {});

  return (
    <div className="returnly-grid-backdrop returnly-workspace min-h-full px-4 py-5 sm:px-6 sm:py-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Btn
            to="/buyer/claims"
            variant="soft"
            size="sm"
            icon={<ArrowLeft className="size-3.5" />}
          >
            Back to claims
          </Btn>

          {viewer?.canAccessDemoSwitcher && (
            <Btn
              to="/demo"
              variant="secondary"
              size="sm"
              icon={<Columns2 className="size-3.5" />}
            >
              Demo
            </Btn>
          )}
        </div>

        <ResolutionRoom
          claimId={id}
          role="buyer"
          demoPresentation={Boolean(viewer?.canAccessDemoSwitcher)}
        />
      </div>
    </div>
  );
}
