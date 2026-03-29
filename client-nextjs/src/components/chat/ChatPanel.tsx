"use client";

import { useEffect, useRef, useState } from "react";
import type { Message } from "@/lib/types";
import type { ToolCall, PendingApproval } from "@/hooks/useAgentStream";
import MessageBubble from "./MessageBubble";
import MessageInput from "./MessageInput";

interface ChatPanelProps {
  messages: Message[];
  streamingText: string;
  isStreaming: boolean;
  toolCalls: ToolCall[];
  pendingApproval: PendingApproval | null;
  onSend: (content: string) => void;
  onStop: () => void;
  onApproval: (approved: boolean) => void;
}

export default function ChatPanel({
  messages,
  streamingText,
  isStreaming,
  toolCalls,
  pendingApproval,
  onSend,
  onStop,
  onApproval,
}: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [toolsExpanded, setToolsExpanded] = useState(true);

  // Auto-scroll to bottom on new content
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, streamingText, toolCalls]);

  return (
    <div className="flex flex-col h-full bg-od-bg">
      {/* Message thread */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-1">
        {messages.length === 0 && !isStreaming && (
          <div className="flex-1 flex items-center justify-center h-full">
            <div className="text-center text-od-muted">
              <div className="text-4xl mb-3 opacity-40">&#9002;</div>
              <p className="text-base font-medium text-od-text">Start a conversation</p>
              <p className="text-sm mt-1">Send a message to begin working with the agent.</p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} role={msg.role} content={msg.content} runId={msg.run_id} toolCalls={msg.tool_calls} />
        ))}

        {/* Tool calls during streaming */}
        {isStreaming && toolCalls.length > 0 && (
          <div className="mb-4">
            <button
              onClick={() => setToolsExpanded(!toolsExpanded)}
              className="flex items-center gap-1.5 text-xs text-od-muted hover:text-od-text transition-colors mb-1.5"
            >
              <span
                className="inline-block transition-transform text-[10px]"
                style={{ transform: toolsExpanded ? "rotate(90deg)" : "rotate(0deg)" }}
              >
                &#9654;
              </span>
              Tool Calls ({toolCalls.length})
            </button>
            {toolsExpanded && (
              <div className="space-y-1.5">
                {toolCalls.map((tc, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-od-muted pl-2">
                    <span className="shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full bg-od-green" />
                    <span>
                      <span className="font-mono text-od-green">{tc.tool}</span>
                      {"path" in tc.input && tc.input.path != null && (
                        <span className="text-od-muted ml-1">({String(tc.input.path)})</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Human-in-the-loop approval request */}
        {pendingApproval && (
          <div className="flex justify-start mb-4">
            <div className="bg-od-bg-light border border-od-border-yellow rounded px-4 py-3 max-w-lg">
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
        {isStreaming && !streamingText && toolCalls.length === 0 && (
          <div className="flex justify-start mb-4">
            <div className="bg-od-bg-light border border-od-border-light rounded px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-od-muted">
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

      {/* Input */}
      <MessageInput onSend={onSend} isStreaming={isStreaming} onStop={onStop} />
    </div>
  );
}
