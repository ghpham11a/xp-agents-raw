"use client";

import { useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useConversation } from "@/hooks/useConversation";
import { useAgentStream } from "@/hooks/useAgentStream";
import ChatLayout from "@/components/layout/ChatLayout";
import ChatPanel from "@/components/chat/ChatPanel";
import WorkspacePanel from "@/components/plan/WorkspacePanel";
import { FileIcon } from "@/components/icons";
import type { Message } from "@/lib/types";

export default function ConversationPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = params.conversationId as string;

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
    files,
    fileContents,
    runId,
    pendingApproval,
    sendMessage,
    stop,
    respondToApproval,
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

  /**
   * Handle sending a message — works both when idle AND while streaming.
   *
   * When the agent is already streaming a response and the user sends a
   * new message, we need to:
   *   1. Save the partial assistant response so it's not lost
   *   2. Abort the current stream
   *   3. Add the new user message
   *   4. Start a fresh stream for the new message
   *
   * Steps 2-4 are handled by `sendMessage` in useAgentStream. Step 1 is
   * handled by the `onInterrupt` callback we pass to `sendMessage` — it
   * fires with the partial text before the stream state is reset, giving
   * us a chance to insert it into the message list.
   */
  const handleSend = useCallback(
    (content: string) => {
      // Optimistic: add user message to local state immediately.
      const optimisticMsg: Message = {
        id: `temp-${Date.now()}`,
        conversation_id: conversationId,
        role: "user",
        content,
        run_id: null,
        token_count: null,
        tool_calls: null,
        created_at: new Date().toISOString(),
      };

      /**
       * onInterrupt callback — called by sendMessage when there's an
       * active stream that needs to be interrupted.
       *
       * `partialText` contains whatever the agent had streamed so far.
       * We insert it as a completed assistant message so the user can
       * still see what the agent was saying before they interrupted it.
       */
      const onInterrupt = (partialText: string) => {
        const partialAssistantMsg: Message = {
          id: `partial-${Date.now()}`,
          conversation_id: conversationId,
          role: "assistant",
          content: partialText + "\n\n*(interrupted)*",
          run_id: null,
          token_count: null,
          tool_calls: null,
          created_at: new Date().toISOString(),
        };
        addMessage(partialAssistantMsg);
      };

      addMessage(optimisticMsg);
      sendMessage(conversationId, content, onInterrupt);
    },
    [conversationId, addMessage, sendMessage],
  );

  const handleNewChat = useCallback(async () => {
    const id = await createConversation();
    router.push(`/chat/${id}`);
  }, [createConversation, router]);

  const handleSelect = useCallback(
    (id: string) => {
      router.push(`/chat/${id}`);
      loadConversation(id);
      reset();
    },
    [router, loadConversation, reset],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await removeConversation(id);
      if (conversations.length <= 1) {
        router.push("/");
      } else if (id === conversationId) {
        const remaining = conversations.filter(c => c.id !== id);
        if (remaining.length > 0) {
          router.push(`/chat/${remaining[0].id}`);
        } else {
          router.push("/");
        }
      }
    },
    [removeConversation, conversations, conversationId, router],
  );

  const activeConv = conversations.find(c => c.id === (activeId ?? conversationId));

  return (
    <ChatLayout
      conversations={conversations}
      activeId={activeId ?? conversationId}
      onNewChat={handleNewChat}
      onSelect={handleSelect}
      onDelete={handleDelete}
      titleExtra={
        activeConv && (
          <>
            <span className="text-xs text-od-muted/40">—</span>
            <span className="text-xs text-od-text/70 truncate">{activeConv.title}</span>
          </>
        )
      }
      statusLeft={
        <>
          <span className="flex items-center gap-1 text-[11px] text-od-statusbar-fg">
            <FileIcon className="shrink-0" />
            {messages.length} messages
          </span>
          {isStreaming && (
            <span className="flex items-center gap-1 text-[11px] text-od-statusbar-fg">
              <span className="w-1.5 h-1.5 rounded-full bg-od-green animate-pulse" />
              Streaming
            </span>
          )}
        </>
      }
      statusRight={
        <>
          {runId && (
            <span className="text-[11px] text-od-statusbar-fg font-mono">
              run:{runId}
            </span>
          )}
          <span className="text-[11px] text-od-statusbar-fg">
            Agent v1.0
          </span>
        </>
      }
    >
      {/* ── Chat panel (editor area) ──────────────── */}
      <div className="flex-1 min-w-0">
        <ChatPanel
          messages={messages}
          streamingText={streamingText}
          isStreaming={isStreaming}
          pendingApproval={pendingApproval}
          onSend={handleSend}
          onStop={stop}
          onApproval={respondToApproval}
        />
      </div>

      {/* ── Scratchpad panel ──────────────────────── */}
      <div className="w-80 shrink-0">
        <WorkspacePanel
          plan={plan}
          isStreaming={isStreaming}
          files={files}
          fileContents={fileContents}
          runId={runId}
          toolCalls={toolCalls}
        />
      </div>
    </ChatLayout>
  );
}
