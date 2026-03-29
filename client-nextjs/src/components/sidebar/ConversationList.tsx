"use client";

import type { Conversation } from "@/lib/types";

interface ConversationListProps {
  conversations: Conversation[];
  activeId: string | null;
  collapsed: boolean;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onToggleCollapse: () => void;
}

export default function ConversationList({
  conversations,
  activeId,
  onSelect,
  onCreate,
  onDelete,
}: ConversationListProps) {
  return (
    <div className="flex flex-col h-full bg-od-bg-dark border-r border-od-border w-56">
      {/* VS Code explorer header */}
      <div className="flex items-center justify-between px-4 py-1.5 h-9">
        <span className="text-[11px] font-medium uppercase tracking-wider text-od-muted">
          Conversations
        </span>
        <button
          onClick={onCreate}
          className="text-od-muted hover:text-od-text transition-colors p-0.5"
          title="New Chat"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M14 7v1H8v6H7V8H1V7h6V1h1v6h6z" />
          </svg>
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 && (
          <p className="text-xs text-od-muted text-center mt-8 px-3">No conversations yet.</p>
        )}

        {conversations.map((conv) => (
          <div
            key={conv.id}
            className={`group flex items-center gap-2 pl-4 pr-2 h-[22px] cursor-pointer text-[13px] transition-colors ${
              activeId === conv.id
                ? "bg-od-bg-highlight text-od-text-bright"
                : "text-od-text hover:bg-od-bg-light"
            }`}
            onClick={() => onSelect(conv.id)}
          >
            {/* Chat icon */}
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="text-od-muted shrink-0">
              <path d="M14 1H2a1 1 0 00-1 1v8a1 1 0 001 1h2v3.5L7.5 11H14a1 1 0 001-1V2a1 1 0 00-1-1zm0 9H7l-2 2V10H2V2h12v8z" />
            </svg>
            <span className="flex-1 truncate">{conv.title}</span>

            {/* Delete button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(conv.id);
              }}
              className="opacity-0 group-hover:opacity-100 text-od-muted hover:text-od-red transition-opacity shrink-0"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 8.707l3.646 3.647.708-.708L8.707 8l3.647-3.646-.708-.708L8 7.293 4.354 3.646l-.708.708L7.293 8l-3.647 3.646.708.708L8 8.707z" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
