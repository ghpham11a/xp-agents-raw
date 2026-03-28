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
  collapsed,
  onSelect,
  onCreate,
  onDelete,
  onToggleCollapse,
}: ConversationListProps) {
  if (collapsed) {
    return (
      <div className="flex flex-col items-center h-full bg-od-bg-dark border-r border-od-border py-3 px-1 w-12">
        <button
          onClick={onToggleCollapse}
          className="text-od-muted hover:text-od-text transition-colors mb-3"
          title="Expand sidebar"
        >
          &#9654;
        </button>
        <button
          onClick={onCreate}
          className="w-8 h-8 rounded bg-od-blue/20 text-od-blue text-lg hover:bg-od-blue/30 transition-colors"
          title="New Chat"
        >
          +
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-od-bg-dark border-r border-od-border w-64">
      {/* Header */}
      <div className="p-3 border-b border-od-border flex items-center gap-2">
        <button
          onClick={onCreate}
          className="flex-1 rounded bg-od-blue/15 border border-od-blue/30 px-4 py-2 text-xs font-medium text-od-blue hover:bg-od-blue/25 transition-colors"
        >
          + New Chat
        </button>
        <button
          onClick={onToggleCollapse}
          className="text-od-muted hover:text-od-text transition-colors shrink-0"
          title="Collapse sidebar"
        >
          &#9664;
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto py-1">
        {conversations.length === 0 && (
          <p className="text-xs text-od-muted text-center mt-8">No conversations yet.</p>
        )}

        {conversations.map((conv) => (
          <div
            key={conv.id}
            className={`group flex items-center px-3 py-2 cursor-pointer transition-colors ${
              activeId === conv.id
                ? "bg-od-bg-highlight text-od-text-bright"
                : "text-od-text hover:bg-od-bg-light"
            }`}
            onClick={() => onSelect(conv.id)}
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate">{conv.title}</div>
              <div className="text-[10px] text-od-muted mt-0.5">
                {new Date(conv.updated_at).toLocaleDateString()}
              </div>
            </div>

            {/* Delete button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(conv.id);
              }}
              className="opacity-0 group-hover:opacity-100 text-od-muted hover:text-od-red text-sm ml-2 transition-opacity"
            >
              &times;
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
