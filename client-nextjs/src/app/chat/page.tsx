"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useConversation } from "@/hooks/useConversation";
import ChatLayout from "@/components/layout/ChatLayout";
import { ChatBubbleLargeIcon } from "@/components/icons";

export default function ChatIndexPage() {
  const router = useRouter();
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

  const handleDelete = useCallback(
    async (id: string) => {
      await removeConversation(id);
      if (conversations.length <= 1) {
        router.push("/");
      }
    },
    [removeConversation, conversations, router],
  );

  return (
    <ChatLayout
      conversations={conversations}
      activeId={activeId}
      onNewChat={handleNewChat}
      onSelect={handleSelect}
      onDelete={handleDelete}
    >
      {/* ── Welcome / empty state ─────────────────── */}
      <div className="flex-1 flex items-center justify-center bg-od-bg">
        <div className="text-center">
          <ChatBubbleLargeIcon className="mx-auto mb-4 text-od-muted/30" />
          <h1 className="text-lg font-semibold text-od-text-bright mb-2">Agent Chat</h1>
          <p className="text-od-muted mb-5 text-xs">Start a new conversation to work with the agent.</p>
          <button
            onClick={handleNewChat}
            className="rounded-sm bg-od-blue/15 border border-od-blue/30 px-5 py-2 text-[13px] font-medium text-od-blue hover:bg-od-blue/25 transition-colors"
          >
            + New Chat
          </button>
        </div>
      </div>
    </ChatLayout>
  );
}
