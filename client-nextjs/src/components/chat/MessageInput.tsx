"use client";

import { useState, useRef, useCallback } from "react";

interface MessageInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
}

export default function MessageInput({ onSend, disabled = false }: MessageInputProps) {
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
    <div className="flex items-end gap-3 p-4 border-t border-od-border bg-od-bg-dark">
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        placeholder="Type a message..."
        disabled={disabled}
        rows={1}
        className="flex-1 resize-none rounded bg-od-bg border border-od-border-light px-4 py-3 text-sm text-od-text placeholder-od-muted focus:outline-none focus:border-od-blue transition-colors disabled:opacity-50"
      />
      <button
        onClick={handleSend}
        disabled={disabled || !text.trim()}
        className="shrink-0 rounded bg-od-blue/20 border border-od-blue/30 px-5 py-3 text-sm font-medium text-od-blue hover:bg-od-blue/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        Send
      </button>
    </div>
  );
}
