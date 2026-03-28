"use client";

import { useEffect, useCallback, useState } from "react";
import { useParams } from "next/navigation";
import { useConversation } from "@/hooks/useConversation";
import { useAgentStream } from "@/hooks/useAgentStream";
import ChatPanel from "@/components/chat/ChatPanel";
import PlanPanel from "@/components/plan/PlanPanel";
import ConversationList from "@/components/sidebar/ConversationList";
import type { Message } from "@/lib/types";

export default function ConversationPage() {
  const params = useParams();
  const conversationId = params.conversationId as string;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const {
    conversations,
    activeId,
    messages,
    loadConversation,
    createConversation,
    removeConversation,
    addMessage,
    refresh,
  } = useConversation();

  const {
    streamingText,
    isStreaming,
    toolCalls,
    plan,
    planStreamText,
    files,
    fileContents,
    runId,
    sendMessage,
    reset,
  } = useAgentStream();

  // Load conversation on mount or when id changes
  useEffect(() => {
    if (conversationId) {
      loadConversation(conversationId);
      reset();
    }
  }, [conversationId, loadConversation, reset]);

  // When streaming finishes, reload messages from DB
  useEffect(() => {
    if (!isStreaming && streamingText && conversationId) {
      // Small delay to let the backend save the message
      const timer = setTimeout(() => {
        loadConversation(conversationId);
        refresh();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isStreaming, streamingText, conversationId, loadConversation, refresh]);

  const handleSend = useCallback(
    (content: string) => {
      // Optimistic: add user message to local state immediately
      const optimisticMsg: Message = {
        id: `temp-${Date.now()}`,
        conversation_id: conversationId,
        role: "user",
        content,
        run_id: null,
        token_count: null,
        created_at: new Date().toISOString(),
      };
      addMessage(optimisticMsg);
      sendMessage(conversationId, content);
    },
    [conversationId, addMessage, sendMessage],
  );

  const handleNewChat = useCallback(async () => {
    const id = await createConversation();
    window.history.pushState(null, "", `/chat/${id}`);
  }, [createConversation]);

  const handleSelect = useCallback(
    (id: string) => {
      window.history.pushState(null, "", `/chat/${id}`);
      loadConversation(id);
      reset();
    },
    [loadConversation, reset],
  );

  return (
    <div className="flex h-screen bg-od-bg-dark text-od-text">
      {/* Sidebar */}
      <div className="shrink-0">
        <ConversationList
          conversations={conversations}
          activeId={activeId ?? conversationId}
          collapsed={sidebarCollapsed}
          onSelect={handleSelect}
          onCreate={handleNewChat}
          onDelete={removeConversation}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </div>

      {/* Chat panel */}
      <div className="flex-1 min-w-0">
        <ChatPanel
          messages={messages}
          streamingText={streamingText}
          isStreaming={isStreaming}
          toolCalls={toolCalls}
          onSend={handleSend}
        />
      </div>

      {/* Plan + scratchpad panel */}
      <div className="w-80 shrink-0">
        <PlanPanel
          plan={plan}
          planStreamText={planStreamText}
          isStreaming={isStreaming}
          files={files}
          fileContents={fileContents}
          runId={runId}
        />
      </div>
    </div>
  );
}
