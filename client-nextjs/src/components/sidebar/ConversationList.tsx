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
      <div className="flex flex-col items-center h-full bg-zinc-900 border-r border-zinc-800 py-3 px-1 w-12">
        <button
          onClick={onToggleCollapse}
          className="text-zinc-400 hover:text-zinc-200 transition-colors mb-3"
          title="Expand sidebar"
        >
          &#9654;
        </button>
        <button
          onClick={onCreate}
          className="w-8 h-8 rounded-lg bg-blue-600 text-white text-lg hover:bg-blue-500 transition-colors"
          title="New Chat"
        >
          +
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-zinc-900 border-r border-zinc-800 w-64">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800 flex items-center gap-2">
        <button
          onClick={onCreate}
          className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
        >
          + New Chat
        </button>
        <button
          onClick={onToggleCollapse}
          className="text-zinc-400 hover:text-zinc-200 transition-colors shrink-0"
          title="Collapse sidebar"
        >
          &#9664;
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2">
        {conversations.length === 0 && (
          <p className="text-xs text-zinc-600 text-center mt-8">No conversations yet.</p>
        )}

        {conversations.map((conv) => (
          <div
            key={conv.id}
            className={`group flex items-center rounded-lg px-3 py-2.5 mb-0.5 cursor-pointer transition-colors ${
              activeId === conv.id
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
            }`}
            onClick={() => onSelect(conv.id)}
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate">{conv.title}</div>
              <div className="text-[10px] text-zinc-600 mt-0.5">
                {new Date(conv.updated_at).toLocaleDateString()}
              </div>
            </div>

            {/* Delete button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(conv.id);
              }}
              className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 text-sm ml-2 transition-opacity"
            >
              &times;
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
