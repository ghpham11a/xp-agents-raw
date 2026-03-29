"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { streamMessage, submitApproval } from "@/lib/api";
import type { Plan, SSEEvent, FileInfo } from "@/lib/types";

export interface ToolCall {
  tool: string;
  input: Record<string, unknown>;
  result: string;
}

export interface PendingApproval {
  runId: string;
  tool: string;
  input: Record<string, unknown>;
}

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

  const sendMessage = useCallback(
    async (conversationId: string, content: string) => {
      // Abort any in-flight stream
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      // Reset streaming state for new message
      setState({
        ...INITIAL_STATE,
        isStreaming: true,
      });

      try {
        for await (const event of streamMessage(conversationId, content, controller.signal)) {
          processEvent(event);
        }
      } catch (err) {
        // Don't treat user-initiated abort as an error
        if (controller.signal.aborted) {
          setState((prev) => ({ ...prev, isStreaming: false }));
          return;
        }
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
