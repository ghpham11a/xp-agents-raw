"use client";

import { useEffect, useRef } from "react";
import type { Message } from "@/lib/types";
import type { ToolCall } from "@/hooks/useAgentStream";
import MessageBubble from "./MessageBubble";
import MessageInput from "./MessageInput";

interface ChatPanelProps {
  messages: Message[];
  streamingText: string;
  isStreaming: boolean;
  toolCalls: ToolCall[];
  onSend: (content: string) => void;
}

export default function ChatPanel({
  messages,
  streamingText,
  isStreaming,
  toolCalls,
  onSend,
}: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new content
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, streamingText, toolCalls]);

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Message thread */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-1">
        {messages.length === 0 && !isStreaming && (
          <div className="flex-1 flex items-center justify-center h-full">
            <div className="text-center text-zinc-500">
              <div className="text-4xl mb-3">&#x1f4ac;</div>
              <p className="text-lg font-medium">Start a conversation</p>
              <p className="text-sm mt-1">Send a message to begin working with the agent.</p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} role={msg.role} content={msg.content} runId={msg.run_id} />
        ))}

        {/* Tool calls during streaming */}
        {isStreaming && toolCalls.length > 0 && (
          <div className="mb-4 space-y-2">
            {toolCalls.map((tc, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-zinc-500 pl-2">
                <span className="shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>
                  <span className="font-mono text-zinc-400">{tc.tool}</span>
                  {"path" in tc.input && tc.input.path != null && (
                    <span className="text-zinc-600 ml-1">({String(tc.input.path)})</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Streaming assistant message */}
        {isStreaming && streamingText && (
          <MessageBubble role="assistant" content={streamingText} isStreaming />
        )}

        {/* Streaming indicator with no text yet */}
        {isStreaming && !streamingText && toolCalls.length === 0 && (
          <div className="flex justify-start mb-4">
            <div className="bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <span className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                </span>
                Agent is thinking...
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <MessageInput onSend={onSend} disabled={isStreaming} />
    </div>
  );
}
