import {
  useHeaderTitle,
  useHeaderActions,
} from "@agent-native/toolkit/app-shell";
import { AgentToggleButton } from "@agent-native/toolkit/app/chat";
import { Link, useLocation } from "react-router";

import { MobileAppBar } from "./MobileAppBar";

interface HeaderProps {
  onOpenMobileSidebar: () => void;
}

export function Header({ onOpenMobileSidebar }: HeaderProps) {
  const title = useHeaderTitle();
  const actions = useHeaderActions();
  const { pathname } = useLocation();
  const merchant = pathname.startsWith("/merchant");

  return (
    <MobileAppBar
      className="md:ps-4"
      onOpenNavigation={onOpenMobileSidebar}
      title={
        title ?? (
          <Link
            to={merchant ? "/merchant/home" : "/buyer/home"}
            className="inline-flex min-h-11 items-center font-semibold md:hidden"
            aria-label={merchant ? "Return to inbox" : "Return to purchases"}
          >
            Returnly
          </Link>
        )
      }
      actions={
        <>
          {actions}
          <AgentToggleButton />
        </>
      }
    />
  );
}
