"use client";

import { useState, useRef, useCallback } from "react";

interface MessageInputProps {
  onSend: (content: string) => void;
  isStreaming?: boolean;
  onStop?: () => void;
}

export default function MessageInput({ onSend, isStreaming = false, onStop }: MessageInputProps) {
  const disabled = isStreaming;
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [text, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleInput = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 160) + "px";
    }
  }, []);

  return (
    <div className="flex items-end gap-2 px-4 py-3 border-t border-od-border bg-od-bg-dark">
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        placeholder="Send a message... (Enter to send, Shift+Enter for newline)"
        disabled={disabled}
        rows={1}
        className="flex-1 resize-none rounded-sm bg-od-bg border border-od-border-light px-3 py-2 text-[13px] text-od-text placeholder-od-muted focus:outline-none focus:border-od-blue transition-colors disabled:opacity-50"
      />
      {isStreaming ? (
        <button
          onClick={onStop}
          className="shrink-0 rounded-sm bg-od-red/15 border border-od-red/30 px-4 py-2 text-[13px] font-medium text-od-red hover:bg-od-red/25 transition-colors"
        >
          Stop
        </button>
      ) : (
        <button
          onClick={handleSend}
          disabled={!text.trim()}
          className="shrink-0 rounded-sm bg-od-blue/15 border border-od-blue/30 px-4 py-2 text-[13px] font-medium text-od-blue hover:bg-od-blue/25 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Send
        </button>
      )}
    </div>
  );
}
