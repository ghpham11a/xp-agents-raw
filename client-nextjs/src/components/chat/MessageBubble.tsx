"use client";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import StreamingText from "./StreamingText";
import InlinePlan from "./InlinePlan";

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  runId?: string | null;
}

export default function MessageBubble({ role, content, isStreaming = false, runId }: MessageBubbleProps) {
  const isUser = role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-blue-600 text-white"
            : "bg-zinc-800 text-zinc-100 border border-zinc-700"
        }`}
      >
        {/* Label */}
        <div className={`text-xs font-medium mb-1 ${isUser ? "text-blue-200" : "text-zinc-400"}`}>
          {isUser ? "You" : "Agent"}
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

        {/* Inline plan for historical assistant messages */}
        {!isStreaming && !isUser && runId && <InlinePlan runId={runId} />}
      </div>
    </div>
  );
}
