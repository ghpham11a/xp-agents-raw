// ── Data models (matching backend) ────────────────────────

export interface Agent {
  id: string;
  name: string;
  description: string;
  model: string;
  system_prompt: string;
  config_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  agent_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ToolCallRecord {
  tool: string;
  input: Record<string, unknown>;
  result: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  run_id: string | null;
  token_count: number | null;
  tool_calls: ToolCallRecord[] | null;
  created_at: string;
}

export interface ConversationWithMessages extends Conversation {
  messages: Message[];
}

// ── Plan ──────────────────────────────────────────────────

export interface Plan {
  goal: string;
  steps: string[];
  done_when: string;
  output_files: string[];
}

// ── SSE Event types ──────────────────────────────────────

export interface PlanEvent {
  type: "plan";
  data: Plan;
}

export interface TextDeltaEvent {
  type: "text_delta";
  data: { content: string };
}

export interface ToolCallEvent {
  type: "tool_call";
  data: {
    tool: string;
    input: Record<string, unknown>;
    result: string;
  };
}

export interface FileUpdateEvent {
  type: "file_update";
  data: {
    path: string;
    action: "created" | "updated" | "deleted";
    content?: string;
  };
}

export interface ApprovalRequestEvent {
  type: "approval_request";
  data: {
    run_id: string;
    tool: string;
    input: Record<string, unknown>;
  };
}

export interface DoneEvent {
  type: "done";
  data: {
    run_id: string;
    iterations: number;
    total_tokens: number;
    final_text?: string;
  };
}

export interface ErrorEvent {
  type: "error";
  data: { message: string };
}

export type SSEEvent =
  | PlanEvent
  | TextDeltaEvent
  | ToolCallEvent
  | FileUpdateEvent
  | ApprovalRequestEvent
  | DoneEvent
  | ErrorEvent;

// ── File info ─────────────────────────────────────────────

export interface FileInfo {
  path: string;
  size: number;
}

// ── Agent stream types ───────────────────────────────────

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
