import { useSendToAgentChat } from "@agent-native/toolkit/app/chat/composer/use-send-to-agent-chat";
import { MessageCircle } from "lucide-react";

import { cn } from "@/lib/utils";

interface AgentContextBarProps {
  suggestedPrompts: Array<{ label: string; prompt: string }>;
  className?: string;
}

export function AgentContextBar({
  suggestedPrompts,
  className,
}: AgentContextBarProps) {
  const { send } = useSendToAgentChat();
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {suggestedPrompts.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={() =>
            void send({ message: item.prompt, submit: true, openSidebar: true })
          }
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#E4E4E7] bg-white px-3.5 py-2 text-sm font-medium text-[#18181B] transition-colors hover:border-[#A1A1AA] hover:bg-[#F4F4F5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#18181B]"
        >
          <MessageCircle className="size-4 shrink-0" aria-hidden="true" />
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
