import { useT } from "@agent-native/core/client/i18n";
import {
  CommandMenu,
  useCommandMenuShortcut,
} from "@agent-native/toolkit/app/shared/CommandMenu";
import { useTheme } from "next-themes";
import { useCallback, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";

import {
  HOME_PATH,
  isChatPathname,
  NEW_CHAT_PATH,
  threadIdFromPath,
} from "@/lib/chat-paths";

import { Layout as AppLayout } from "./Layout";

function ThemeToggleItem() {
  const { resolvedTheme, setTheme } = useTheme();
  const t = useT();
  const isDark = resolvedTheme === "dark";
  return (
    <CommandMenu.Item
      onSelect={() => setTheme(isDark ? "light" : "dark")}
      keywords={["theme", "dark", "light", "mode"]}
    >
      {t("root.toggleTheme")}
    </CommandMenu.Item>
  );
}

export default function WorkspaceContent() {
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const navigate = useNavigate();
  const t = useT();
  const location = useLocation();
  const isChatThread = threadIdFromPath(location.pathname) !== null;
  useCommandMenuShortcut(useCallback(() => setCmdkOpen(true), []));
  return (
    <>
      <CommandMenu
        open={cmdkOpen}
        onOpenChange={setCmdkOpen}
        chatStorageKey="chat"
      >
        <CommandMenu.Group heading={t("root.commandActions")}>
          {isChatThread ? (
            <CommandMenu.Item
              onSelect={() =>
                window.dispatchEvent(new Event("agent-chat:new-chat"))
              }
            >
              {t("chat.newChat")}
            </CommandMenu.Item>
          ) : null}
          {location.pathname !== HOME_PATH ? (
            <CommandMenu.Item onSelect={() => navigate(HOME_PATH)}>
              {t("navigation.home")}
            </CommandMenu.Item>
          ) : null}
          {!isChatPathname(location.pathname) ? (
            <CommandMenu.Item onSelect={() => navigate(NEW_CHAT_PATH)}>
              {t("navigation.chat")}
            </CommandMenu.Item>
          ) : null}
          <CommandMenu.Item
            onSelect={() => navigate("/settings/agent")}
            keywords={[
              "agent",
              "context",
              "files",
              "connections",
              "jobs",
              "access",
            ]}
          >
            {t("settings.openAgentSettings")}
          </CommandMenu.Item>
        </CommandMenu.Group>
        <CommandMenu.Group heading={t("root.commandAppearance")}>
          <ThemeToggleItem />
        </CommandMenu.Group>
      </CommandMenu>
      <AppLayout>
        <Outlet />
      </AppLayout>
    </>
  );
}
