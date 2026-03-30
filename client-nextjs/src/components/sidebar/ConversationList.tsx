"use client";

import type { Conversation } from "@/lib/types";
import { PlusIcon, ChatBubbleIcon, CloseIcon } from "@/components/icons";

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
          <PlusIcon />
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
            <ChatBubbleIcon className="text-od-muted shrink-0" />
            <span className="flex-1 truncate">{conv.title}</span>

            {/* Delete button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(conv.id);
              }}
              className="opacity-0 group-hover:opacity-100 text-od-muted hover:text-od-red transition-opacity shrink-0"
            >
              <CloseIcon />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
