"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { streamMessage, submitApproval } from "@/lib/api";
import type { Plan, SSEEvent, FileInfo, ToolCall, PendingApproval } from "@/lib/types";

export interface AgentStreamState {
  // Chat
  streamingText: string;
  isStreaming: boolean;

  // Plan
  plan: Plan | null;

  // Files
  files: FileInfo[];
  fileContents: Record<string, string>;

  // Metadata
  toolCalls: ToolCall[];
  runId: string | null;
  error: string | null;

  // Human-in-the-loop
  pendingApproval: PendingApproval | null;
}

const INITIAL_STATE: AgentStreamState = {
  streamingText: "",
  isStreaming: false,
  plan: null,
  files: [],
  fileContents: {},
  toolCalls: [],
  runId: null,
  error: null,
  pendingApproval: null,
};

export function useAgentStream() {
  const [state, setState] = useState<AgentStreamState>(INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);

  // Buffer text deltas and flush once per animation frame
  const textBufferRef = useRef("");
  const rafRef = useRef<number | null>(null);

  const flushBuffers = useCallback(() => {
    const textChunk = textBufferRef.current;
    textBufferRef.current = "";
    rafRef.current = null;

    if (textChunk) {
      setState((prev) => ({
        ...prev,
        streamingText: prev.streamingText + textChunk,
      }));
    }
  }, []);

  const scheduleFlush = useCallback(() => {
    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(flushBuffers);
    }
  }, [flushBuffers]);

  // Clean up any pending raf on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const processEvent = useCallback((event: SSEEvent) => {
    // Buffer text deltas instead of triggering a render per token
    if (event.type === "text_delta") {
      textBufferRef.current += event.data.content;
      scheduleFlush();
      return;
    }
    // Flush any buffered text before processing other events
    if (textBufferRef.current) {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      flushBuffers();
    }

    setState((prev) => {
      switch (event.type) {
        case "plan":
          return { ...prev, plan: event.data };

        case "tool_call":
          return { ...prev, toolCalls: [...prev.toolCalls, event.data] };

        case "file_update": {
          const existing = prev.files.filter((f) => f.path !== event.data.path);
          if (event.data.action === "deleted") {
            const { [event.data.path]: _, ...remainingContents } = prev.fileContents;
            return { ...prev, files: existing, fileContents: remainingContents };
          }
          const updatedContents = event.data.content != null
            ? { ...prev.fileContents, [event.data.path]: event.data.content }
            : prev.fileContents;
          return {
            ...prev,
            files: [...existing, { path: event.data.path, size: 0 }],
            fileContents: updatedContents,
          };
        }

        case "approval_request":
          return {
            ...prev,
            pendingApproval: {
              runId: event.data.run_id,
              tool: event.data.tool,
              input: event.data.input,
            },
          };

        case "done":
          return {
            ...prev,
            isStreaming: false,
            runId: event.data.run_id,
          };

        case "error":
          return { ...prev, isStreaming: false, error: event.data.message };

        default:
          return prev;
      }
    });
  }, [scheduleFlush, flushBuffers]);

  /**
   * Send a message to the agent and start streaming the response.
   *
   * If a stream is already in progress, the previous stream is aborted first.
   * The optional `onInterrupt` callback fires *before* the state is reset,
   * receiving whatever partial assistant text has been accumulated so far.
   * This lets the caller persist the partial response (e.g. add it to the
   * message list) so it isn't lost when the new stream begins.
   *
   * @param conversationId - The conversation to send the message to
   * @param content        - The user's message text
   * @param onInterrupt    - Optional callback invoked with the partial
   *                         streaming text when an in-flight stream is
   *                         interrupted by this new message
   */
  const sendMessage = useCallback(
    async (
      conversationId: string,
      content: string,
      onInterrupt?: (partialText: string) => void,
    ) => {
      // ── Interrupt handling ──────────────────────────────────────
      // If there's already a stream running, we need to:
      //   1. Capture any partial text that was accumulated
      //   2. Notify the caller so they can save it as a message
      //   3. Abort the underlying fetch/SSE connection
      if (abortRef.current) {
        // Flush any buffered text that hasn't been committed to state yet.
        // The streaming pipeline batches text_delta events via
        // requestAnimationFrame, so there may be text sitting in the
        // buffer that setState hasn't picked up yet.
        const buffered = textBufferRef.current;
        textBufferRef.current = "";
        if (rafRef.current != null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }

        // Read the current streamingText from state synchronously.
        // We use a setState callback that returns the *same* state
        // (no re-render) just to peek at the current value — this is
        // a common React pattern for reading state inside a callback
        // without adding it to the dependency array.
        let currentText = "";
        setState((prev) => {
          currentText = prev.streamingText;
          return prev; // no state change, no re-render
        });

        // Combine committed state text + anything still in the buffer
        const partialText = currentText + buffered;

        // Let the caller save the partial response before we wipe state
        if (partialText && onInterrupt) {
          onInterrupt(partialText);
        }

        // Abort the previous stream's fetch request
        abortRef.current.abort();
      }

      // ── Start new stream ────────────────────────────────────────
      const controller = new AbortController();
      abortRef.current = controller;

      // Reset all streaming state for the new message.
      // This clears streamingText, plan, toolCalls, etc. so the UI
      // starts fresh for the new response.
      setState({
        ...INITIAL_STATE,
        isStreaming: true,
      });

      try {
        // Consume the SSE async generator. Each yielded event is
        // dispatched to processEvent which updates the relevant
        // slice of state (text, plan, tools, files, etc.)
        for await (const event of streamMessage(conversationId, content, controller.signal)) {
          processEvent(event);
        }
      } catch (err) {
        // When we abort a stream (either via stop() or by sending a new
        // message), the fetch promise rejects with an AbortError.
        // This is expected behavior, not a real error — so we just
        // mark streaming as finished without showing an error.
        if (controller.signal.aborted) {
          setState((prev) => ({ ...prev, isStreaming: false }));
          return;
        }
        // For genuine errors (network failure, server error, etc.),
        // surface the error message in state so the UI can display it.
        setState((prev) => ({
          ...prev,
          isStreaming: false,
          error: err instanceof Error ? err.message : "Stream failed",
        }));
      }
    },
    [processEvent],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState((prev) => ({ ...prev, isStreaming: false }));
  }, []);

  const respondToApproval = useCallback(
    async (approved: boolean) => {
      const pending = state.pendingApproval;
      if (!pending) return;
      setState((prev) => ({ ...prev, pendingApproval: null }));
      await submitApproval(pending.runId, approved);
    },
    [state.pendingApproval],
  );

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  return { ...state, sendMessage, stop, respondToApproval, reset };
}
