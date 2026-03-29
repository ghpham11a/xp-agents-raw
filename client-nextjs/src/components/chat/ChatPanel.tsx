"use client";

import { useEffect, useRef } from "react";
import type { Message } from "@/lib/types";
import type { PendingApproval } from "@/hooks/useAgentStream";
import MessageBubble from "./MessageBubble";
import MessageInput from "./MessageInput";

interface ChatPanelProps {
  messages: Message[];
  streamingText: string;
  isStreaming: boolean;
  pendingApproval: PendingApproval | null;
  onSend: (content: string) => void;
  onStop: () => void;
  onApproval: (approved: boolean) => void;
}

export default function ChatPanel({
  messages,
  streamingText,
  isStreaming,
  pendingApproval,
  onSend,
  onStop,
  onApproval,
}: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new content
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, streamingText]);

  return (
    <div className="flex flex-col h-full bg-od-bg">
      {/* ── Message thread ────────────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-1">
        {messages.length === 0 && !isStreaming && (
          <div className="flex-1 flex items-center justify-center h-full">
            <div className="text-center text-od-muted">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3 text-od-muted/30">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
              <p className="text-sm font-medium text-od-text">Start a conversation</p>
              <p className="text-xs mt-1">Send a message to begin working with the agent.</p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} role={msg.role} content={msg.content} runId={msg.run_id} toolCalls={msg.tool_calls} />
        ))}

        {/* Human-in-the-loop approval request */}
        {pendingApproval && (
          <div className="flex justify-start mb-3">
            <div className="bg-od-bg-light border border-od-yellow/30 rounded px-4 py-3 max-w-lg">
              <p className="text-sm font-medium text-od-text mb-1">Approval required</p>
              <p className="text-xs text-od-muted mb-2">
                The agent wants to call{" "}
                <span className="font-mono text-od-yellow">{pendingApproval.tool}</span>
              </p>
              <pre className="text-xs bg-od-bg rounded p-2 mb-3 overflow-x-auto text-od-muted">
                {JSON.stringify(pendingApproval.input, null, 2)}
              </pre>
              <div className="flex gap-2">
                <button
                  onClick={() => onApproval(true)}
                  className="px-3 py-1 text-xs font-medium rounded bg-od-green text-od-bg hover:opacity-90 transition-opacity"
                >
                  Approve
                </button>
                <button
                  onClick={() => onApproval(false)}
                  className="px-3 py-1 text-xs font-medium rounded bg-od-red text-od-bg hover:opacity-90 transition-opacity"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Streaming assistant message */}
        {isStreaming && streamingText && (
          <MessageBubble role="assistant" content={streamingText} isStreaming />
        )}

        {/* Streaming indicator with no text yet */}
        {isStreaming && !streamingText && (
          <div className="flex justify-start mb-3">
            <div className="bg-od-bg-light border border-od-border-light rounded px-3 py-2">
              <div className="flex items-center gap-2 text-xs text-od-muted">
                <span className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-od-blue animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-od-blue animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-od-blue animate-bounce" style={{ animationDelay: "300ms" }} />
                </span>
                Agent is thinking...
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Input ─────────────────────────────────── */}
      <MessageInput onSend={onSend} isStreaming={isStreaming} onStop={onStop} />
    </div>
  );
}
