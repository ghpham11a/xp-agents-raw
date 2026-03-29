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
    <div className="flex flex-col h-screen bg-od-bg-dark text-od-text">
      {/* ── Title Bar ─────────────────────────────────── */}
      <div className="flex items-center h-8 bg-od-titlebar border-b border-od-border select-none shrink-0">
        <div className="flex items-center gap-2 px-3 flex-1">
          <svg width="14" height="14" viewBox="0 0 16 16" className="text-od-blue shrink-0">
            <path fill="currentColor" d="M14.5 2h-13l-.5.5v11l.5.5h13l.5-.5v-11l-.5-.5zM14 13H2V6h12v7zm0-8H2V3h12v2z" />
          </svg>
          <span className="text-xs text-od-muted">Agent Chat</span>
        </div>
      </div>

      {/* ── Main content area ─────────────────────────── */}
      <div className="flex flex-1 min-h-0">
        {/* ── Activity Bar ──────────────────────────── */}
        <div className="flex flex-col items-center w-12 bg-od-activitybar border-r border-od-border shrink-0 py-2 gap-1">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`w-10 h-10 flex items-center justify-center transition-colors relative ${
              !sidebarCollapsed ? "text-od-text-bright" : "text-od-muted hover:text-od-text"
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
              activeId={activeId}
              collapsed={false}
              onSelect={handleSelect}
              onCreate={handleNewChat}
              onDelete={handleDelete}
              onToggleCollapse={() => setSidebarCollapsed(true)}
            />
          </div>
        )}

        {/* ── Welcome / empty state ─────────────────── */}
        <div className="flex-1 flex items-center justify-center bg-od-bg">
          <div className="text-center">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4 text-od-muted/30">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
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
      </div>

      {/* ── Status Bar ────────────────────────────────── */}
      <div className="flex items-center h-6 bg-od-statusbar px-3 border-t border-od-border shrink-0 select-none">
        <div className="flex items-center gap-3 flex-1">
          <span className="text-[11px] text-od-statusbar-fg">Agent v1.0</span>
        </div>
      </div>
    </div>
  );
}
