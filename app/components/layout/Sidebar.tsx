import { useActionQuery } from "@agent-native/core/client/hooks";
import { openCommandMenu } from "@agent-native/toolkit/app/shared";
import {
  Columns2,
  FileText,
  Inbox,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  ShoppingBag,
} from "lucide-react";
import { Link, useLocation } from "react-router";

import { cn } from "@/lib/utils";

interface SidebarProps {
  collapsed?: boolean;
  collapsible?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export function Sidebar({
  collapsed = false,
  collapsible = true,
  onCollapsedChange,
}: SidebarProps) {
  const { pathname } = useLocation();
  const { data: viewer } = useActionQuery("get-viewer-context", {});
  const merchant =
    pathname.startsWith("/merchant") ||
    (pathname.startsWith("/pass/") &&
      (viewer?.hasRealMerchantMembership || viewer?.canAccessDemoSwitcher));
  const demo = pathname === "/demo";
  const items = merchant
    ? [
        {
          to: "/merchant/home",
          label: "Inbox",
          icon: Inbox,
          active:
            pathname === "/merchant/home" ||
            pathname.startsWith("/merchant/claims"),
        },
        {
          to: "/merchant/settings",
          label: "Store settings",
          icon: Settings,
          active: pathname === "/merchant/settings",
        },
      ]
    : demo
      ? []
      : [
          {
            to: "/buyer/home",
            label: "Purchases",
            icon: ShoppingBag,
            active:
              pathname === "/buyer/home" ||
              pathname === "/buyer/vault" ||
              pathname.startsWith("/buyer/purchases"),
          },
          {
            to: "/buyer/claims",
            label: "Claims",
            icon: FileText,
            active: pathname.startsWith("/buyer/claims"),
          },
        ];
  if (viewer?.canAccessDemoSwitcher)
    items.push({ to: "/demo", label: "Demo", icon: Columns2, active: demo });
  const Toggle = collapsed ? PanelLeftOpen : PanelLeftClose;
  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        "flex h-full shrink-0 flex-col border-r border-[#E4E4E7] bg-[#FAFAFA] text-[#18181B]",
        collapsed ? "w-14" : "w-56",
      )}
    >
      <Link
        to={merchant ? "/merchant/home" : "/buyer/home"}
        aria-label={merchant ? "Returnly - inbox" : "Returnly - purchases"}
        className="px-4 py-5 text-xl font-extrabold tracking-tight focus-visible:outline-offset-[-4px] focus-visible:outline-2"
      >
        {collapsed ? "r." : "returnly."}
      </Link>
      <nav aria-label="Navigation" className="space-y-1 px-2">
        {items.map(({ to, label, icon: Icon, active }) => (
          <Link
            key={to}
            to={to}
            title={collapsed ? label : undefined}
            aria-label={collapsed ? label : undefined}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18181B]",
              active && "bg-[#18181B] text-white hover:bg-zinc-800",
              collapsed && "justify-center px-1",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {!collapsed && label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto space-y-3 border-t border-[#E4E4E7] p-2">
        {viewer?.canAccessDemoSwitcher && !collapsed ? (
          <div>
            <p className="mb-2 px-1 text-xs font-semibold text-zinc-500">
              Demo preview
            </p>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-zinc-100 p-1">
              {[
                {
                  to: "/buyer/home",
                  label: "Buyer",
                  active: !merchant && !demo,
                },
                { to: "/merchant/home", label: "Merchant", active: merchant },
                { to: "/demo", label: "Split", active: demo },
              ].map(({ to, label, active }) => (
                <Link
                  key={to}
                  to={to}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center justify-center rounded-lg px-1 text-center text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black",
                    active && "bg-[#C7F85B] text-[#18181B]",
                  )}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
        <div className={cn("flex justify-end gap-1", collapsed && "flex-col")}>
          <button
            type="button"
            onClick={openCommandMenu}
            aria-label="Search"
            className="grid size-11 place-items-center rounded-lg hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-black"
          >
            <Search className="size-4" />
          </button>
          {collapsible && (
            <button
              type="button"
              onClick={() => onCollapsedChange?.(!collapsed)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="grid size-11 place-items-center rounded-lg hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-black"
            >
              <Toggle className="size-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
