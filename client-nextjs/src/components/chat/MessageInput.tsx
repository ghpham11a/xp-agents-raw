"use client";

import { useState, useRef, useCallback } from "react";

interface MessageInputProps {
  onSend: (content: string) => void;
  isStreaming?: boolean;
  onStop?: () => void;
}

/**
 * MessageInput — the text input area at the bottom of the chat.
 *
 * Key behavior: the input is NEVER disabled, even while the agent is
 * streaming a response. This matches modern chatbot UX where users can
 * type ahead and send a new message at any time. When a message is sent
 * during an active stream, the parent component is responsible for
 * interrupting the current stream and saving any partial response.
 *
 * During streaming, we show BOTH a Stop button (to cancel without
 * sending) and a Send button (to interrupt-and-send). When idle, only
 * the Send button is shown.
 */
export default function MessageInput({ onSend, isStreaming = false, onStop }: MessageInputProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /**
   * Sends the current text content.
   * Works regardless of streaming state — this is the core of the
   * "always-enabled input" pattern. The parent's onSend handler
   * decides how to handle the interruption.
   */
  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    // Only guard against empty input; we no longer block on streaming
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
    // Reset textarea height back to single line after sending
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [text, onSend]);

  /**
   * Enter sends the message; Shift+Enter inserts a newline.
   * This works the same whether or not the agent is streaming.
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  /**
   * Auto-resize the textarea as the user types, up to a max height
   * of 160px. Beyond that it scrolls internally.
   */
  const handleInput = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 160) + "px";
    }
  }, []);

  return (
    <div className="flex items-end gap-2 px-4 py-3 border-t border-od-border bg-od-bg-dark">
      {/* ── Textarea ──────────────────────────────────────────
          Never disabled — users can always type and prepare their
          next message, even while the agent is still responding. */}
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        placeholder="Send a message... (Enter to send, Shift+Enter for newline)"
        rows={1}
        className="flex-1 resize-none rounded-sm bg-od-bg border border-od-border-light px-3 py-2 text-[13px] text-od-text placeholder-od-muted focus:outline-none focus:border-od-blue transition-colors"
      />

      {/* ── Action buttons ────────────────────────────────────
          While streaming: show Stop (cancel) AND Send (interrupt-and-send).
          While idle: show only Send.

          This two-button layout gives the user explicit control:
          - Stop = "cancel the current response, I don't want it"
          - Send = "I have a follow-up, interrupt and respond to this instead" */}
      {isStreaming && (
        <button
          onClick={onStop}
          className="shrink-0 rounded-sm bg-od-red/15 border border-od-red/30 px-4 py-2 text-[13px] font-medium text-od-red hover:bg-od-red/25 transition-colors"
        >
          Stop
        </button>
      )}
      <button
        onClick={handleSend}
        disabled={!text.trim()}
        className="shrink-0 rounded-sm bg-od-blue/15 border border-od-blue/30 px-4 py-2 text-[13px] font-medium text-od-blue hover:bg-od-blue/25 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        Send
      </button>
    </div>
  );
}
