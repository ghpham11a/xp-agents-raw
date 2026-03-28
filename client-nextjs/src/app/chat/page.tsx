"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useConversation } from "@/hooks/useConversation";
import ConversationList from "@/components/sidebar/ConversationList";

export default function ChatIndexPage() {
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const {
    conversations,
    activeId,
    createConversation,
    removeConversation,
  } = useConversation();

  const handleNewChat = useCallback(async () => {
    const id = await createConversation();
    router.push(`/chat/${id}`);
  }, [createConversation, router]);

  const handleSelect = useCallback(
    (id: string) => {
      router.push(`/chat/${id}`);
    },
    [router],
  );

  return (
    <div className="flex h-screen bg-od-bg-dark text-od-text">
      {/* Sidebar */}
      <div className="shrink-0">
        <ConversationList
          conversations={conversations}
          activeId={activeId}
          collapsed={sidebarCollapsed}
          onSelect={handleSelect}
          onCreate={handleNewChat}
          onDelete={removeConversation}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </div>

      {/* Empty state */}
      <div className="flex-1 flex items-center justify-center bg-od-bg">
        <div className="text-center">
          <div className="text-4xl mb-4 text-od-muted opacity-40">&#9002;</div>
          <h1 className="text-xl font-semibold text-od-text-bright mb-2">Agent Chat</h1>
          <p className="text-od-muted mb-6 text-sm">Start a new conversation to work with the agent.</p>
          <button
            onClick={handleNewChat}
            className="rounded bg-od-blue/15 border border-od-blue/30 px-6 py-2.5 text-sm font-medium text-od-blue hover:bg-od-blue/25 transition-colors"
          >
            + New Chat
          </button>
        </div>
      </div>
    </div>
  );
}
