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
    <div className="flex h-screen bg-zinc-950 text-zinc-100">
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
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">&#x1F916;</div>
          <h1 className="text-2xl font-semibold text-zinc-200 mb-2">Agent Chat</h1>
          <p className="text-zinc-500 mb-6">Start a new conversation to work with the agent.</p>
          <button
            onClick={handleNewChat}
            className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
          >
            + New Chat
          </button>
        </div>
      </div>
    </div>
  );
}
