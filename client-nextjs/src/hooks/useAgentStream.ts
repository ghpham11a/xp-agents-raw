"use client";

import { useCallback, useRef, useState } from "react";
import { streamMessage } from "@/lib/api";
import type { Plan, SSEEvent, FileInfo } from "@/lib/types";

export interface ToolCall {
  tool: string;
  input: Record<string, unknown>;
  result: string;
}

export interface AgentStreamState {
  // Chat
  streamingText: string;
  isStreaming: boolean;

  // Plan
  plan: Plan | null;
  planStreamText: string;

  // Files
  files: FileInfo[];
  fileContents: Record<string, string>;

  // Metadata
  toolCalls: ToolCall[];
  runId: string | null;
  error: string | null;
}

const INITIAL_STATE: AgentStreamState = {
  streamingText: "",
  isStreaming: false,
  plan: null,
  planStreamText: "",
  files: [],
  fileContents: {},
  toolCalls: [],
  runId: null,
  error: null,
};

export function useAgentStream() {
  const [state, setState] = useState<AgentStreamState>(INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);

  const processEvent = useCallback((event: SSEEvent) => {
    setState((prev) => {
      switch (event.type) {
        case "plan_delta":
          return { ...prev, planStreamText: prev.planStreamText + event.data.content };

        case "plan":
          return { ...prev, plan: event.data, planStreamText: "" };

        case "text_delta":
          return { ...prev, streamingText: prev.streamingText + event.data.content };

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
  }, []);

  const sendMessage = useCallback(
    async (conversationId: string, content: string) => {
      // Reset streaming state for new message
      setState({
        ...INITIAL_STATE,
        isStreaming: true,
      });

      try {
        for await (const event of streamMessage(conversationId, content)) {
          processEvent(event);
        }
      } catch (err) {
        setState((prev) => ({
          ...prev,
          isStreaming: false,
          error: err instanceof Error ? err.message : "Stream failed",
        }));
      }
    },
    [processEvent],
  );

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  return { ...state, sendMessage, reset };
}
