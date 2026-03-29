"use client";

import { useEffect, useCallback, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useConversation } from "@/hooks/useConversation";
import { useAgentStream } from "@/hooks/useAgentStream";
import ChatPanel from "@/components/chat/ChatPanel";
import WorkspacePanel from "@/components/plan/WorkspacePanel";
import ConversationList from "@/components/sidebar/ConversationList";
import type { Message } from "@/lib/types";

export default function ConversationPage() {
  const params = useParams();
  const router = useRouter();
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
        tool_calls: null,
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

  const handleDelete = useCallback(
    async (id: string) => {
      await removeConversation(id);
      // If only one conversation left (the one being deleted), go back to root
      if (conversations.length <= 1) {
        router.push("/");
      } else if (id === conversationId) {
        // Deleted the active conversation — pick another
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
    <div className="flex flex-col h-screen bg-od-bg-dark text-od-text">
      {/* ── Title Bar ─────────────────────────────────── */}
      <div className="flex items-center h-8 bg-od-titlebar border-b border-od-border select-none shrink-0">
        <div className="flex items-center gap-2 px-3 flex-1">
          <svg width="14" height="14" viewBox="0 0 16 16" className="text-od-blue shrink-0">
            <path fill="currentColor" d="M14.5 2h-13l-.5.5v11l.5.5h13l.5-.5v-11l-.5-.5zM14 13H2V6h12v7zm0-8H2V3h12v2z" />
          </svg>
          <span className="text-xs text-od-muted">
            Agent Chat
          </span>
          {activeConv && (
            <>
              <span className="text-xs text-od-muted/40">—</span>
              <span className="text-xs text-od-text/70 truncate">{activeConv.title}</span>
            </>
          )}
        </div>
      </div>

      {/* ── Main content area ─────────────────────────── */}
      <div className="flex flex-1 min-h-0">
        {/* ── Activity Bar ──────────────────────────── */}
        <div className="flex flex-col items-center w-12 bg-od-activitybar border-r border-od-border shrink-0 py-2 gap-1">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`w-10 h-10 flex items-center justify-center transition-colors relative ${
              !sidebarCollapsed
                ? "text-od-text-bright"
                : "text-od-muted hover:text-od-text"
            }`}
            title="Explorer"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            {!sidebarCollapsed && (
              <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-od-text-bright rounded-r" />
            )}
          </button>

          {/* Spacer pushes settings to bottom */}
          <div className="flex-1" />
        </div>

        {/* ── Sidebar ───────────────────────────────── */}
        {!sidebarCollapsed && (
          <div className="flex shrink-0">
            {/* Agent selector */}
            <div className="flex flex-col h-full bg-od-bg-dark border-r border-od-border w-44">
              <div className="flex items-center justify-between px-4 py-1.5 h-9">
                <span className="text-[11px] font-medium uppercase tracking-wider text-od-muted">
                  Agents
                </span>
              </div>
              <div className="flex-1 overflow-y-auto">
                <div
                  className="group flex items-center gap-2 pl-4 pr-2 h-[22px] cursor-default text-[13px] bg-od-bg-highlight text-od-text-bright"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-od-purple shrink-0">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M20 21a8 8 0 00-16 0" />
                  </svg>
                  <span className="truncate">Default Agent</span>
                </div>
              </div>
            </div>

            {/* Conversation list */}
            <ConversationList
              conversations={conversations}
              activeId={activeId ?? conversationId}
              collapsed={false}
              onSelect={handleSelect}
              onCreate={handleNewChat}
              onDelete={handleDelete}
              onToggleCollapse={() => setSidebarCollapsed(true)}
            />
          </div>
        )}

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
      </div>

      {/* ── Status Bar ────────────────────────────────── */}
      <div className="flex items-center h-6 bg-od-statusbar px-3 border-t border-od-border shrink-0 select-none">
        <div className="flex items-center gap-3 flex-1">
          <span className="flex items-center gap-1 text-[11px] text-od-statusbar-fg">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" className="shrink-0">
              <path d="M14 4.5V14a2 2 0 01-2 2H4a2 2 0 01-2-2V2a2 2 0 012-2h5.5L14 4.5zm-3 0A1.5 1.5 0 019.5 3V1H4a1 1 0 00-1 1v12a1 1 0 001 1h8a1 1 0 001-1V4.5h-2z" />
            </svg>
            {messages.length} messages
          </span>
          {isStreaming && (
            <span className="flex items-center gap-1 text-[11px] text-od-statusbar-fg">
              <span className="w-1.5 h-1.5 rounded-full bg-od-green animate-pulse" />
              Streaming
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {runId && (
            <span className="text-[11px] text-od-statusbar-fg font-mono">
              run:{runId}
            </span>
          )}
          <span className="text-[11px] text-od-statusbar-fg">
            Agent v1.0
          </span>
        </div>
      </div>
    </div>
  );
}
