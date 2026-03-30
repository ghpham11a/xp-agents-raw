"use client";

import { useState } from "react";
import type { Conversation } from "@/lib/types";
import ConversationList from "@/components/sidebar/ConversationList";
import { WindowIcon, FolderIcon, PersonIcon } from "@/components/icons";

/**
 * The shared application shell used by both the chat index page
 * and the active conversation page.
 *
 * Owns the VS Code-inspired chrome: title bar, activity bar,
 * sidebar (agent selector + conversation list), and status bar.
 * The `children` slot receives the unique content for each page
 * (welcome screen vs. chat panel + workspace).
 *
 * This avoids duplicating ~150 lines of layout JSX across pages.
 */
interface ChatLayoutProps {
  conversations: Conversation[];
  activeId: string | null;
  onNewChat: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  /** Optional extra content shown after "Agent Chat" in the title bar */
  titleExtra?: React.ReactNode;
  /** Content rendered in the status bar (left side) */
  statusLeft?: React.ReactNode;
  /** Content rendered in the status bar (right side) */
  statusRight?: React.ReactNode;
  children: React.ReactNode;
}

export default function ChatLayout({
  conversations,
  activeId,
  onNewChat,
  onSelect,
  onDelete,
  titleExtra,
  statusLeft,
  statusRight,
  children,
}: ChatLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex flex-col h-screen bg-od-bg-dark text-od-text">
      {/* ── Title Bar ─────────────────────────────────── */}
      <div className="flex items-center h-8 bg-od-titlebar border-b border-od-border select-none shrink-0">
        <div className="flex items-center gap-2 px-3 flex-1">
          <WindowIcon className="text-od-blue shrink-0" />
          <span className="text-xs text-od-muted">Agent Chat</span>
          {titleExtra}
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
            <FolderIcon />
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
                <div className="group flex items-center gap-2 pl-4 pr-2 h-[22px] cursor-default text-[13px] bg-od-bg-highlight text-od-text-bright">
                  <PersonIcon className="text-od-purple shrink-0" />
                  <span className="truncate">Default Agent</span>
                </div>
              </div>
            </div>

            {/* Conversation list */}
            <ConversationList
              conversations={conversations}
              activeId={activeId}
              collapsed={false}
              onSelect={onSelect}
              onCreate={onNewChat}
              onDelete={onDelete}
              onToggleCollapse={() => setSidebarCollapsed(true)}
            />
          </div>
        )}

        {/* ── Page content (chat panel, welcome screen, etc.) ── */}
        {children}
      </div>

      {/* ── Status Bar ────────────────────────────────── */}
      <div className="flex items-center h-6 bg-od-statusbar px-3 border-t border-od-border shrink-0 select-none">
        <div className="flex items-center gap-3 flex-1">
          {statusLeft ?? <span className="text-[11px] text-od-statusbar-fg">Agent v1.0</span>}
        </div>
        {statusRight && (
          <div className="flex items-center gap-3">
            {statusRight}
          </div>
        )}
      </div>
    </div>
  );
}
