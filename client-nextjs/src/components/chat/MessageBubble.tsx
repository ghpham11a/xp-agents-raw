"use client";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import StreamingText from "./StreamingText";
import InlinePlan from "./InlinePlan";
import type { ToolCallRecord } from "@/lib/types";

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  runId?: string | null;
  toolCalls?: ToolCallRecord[] | null;
}

export default function MessageBubble({ role, content, isStreaming = false, runId, toolCalls: toolCallsProp }: MessageBubbleProps) {
  const isUser = role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`max-w-[80%] rounded px-4 py-3 ${
          isUser
            ? "bg-od-blue/15 border border-od-blue/25 text-od-text-bright"
            : "bg-od-bg-light border border-od-border-light text-od-text"
        }`}
      >
        {/* Label */}
        <div className={`text-xs font-mono mb-1.5 ${isUser ? "text-od-blue" : "text-od-purple"}`}>
          {isUser ? "you" : "agent"}
        </div>

        {/* Content */}
        {isStreaming ? (
          <div className="text-sm leading-relaxed">
            <StreamingText text={content} isStreaming={isStreaming} />
          </div>
        ) : (
          <div className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed">
            <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
          </div>
        )}

        {/* Inline plan + tool calls for historical assistant messages */}
        {!isStreaming && !isUser && runId && (
          <InlinePlan runId={runId} toolCalls={toolCallsProp} />
        )}
      </div>
    </div>
  );
}
