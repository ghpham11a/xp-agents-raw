import type { Conversation, ConversationWithMessages, FileInfo, SSEEvent } from "./types";

const API_BASE = "http://localhost:8005/api";

// ── REST endpoints ────────────────────────────────────────

export async function listConversations(): Promise<Conversation[]> {
  const res = await fetch(`${API_BASE}/conversations`);
  return res.json();
}

export async function createConversation(title = "New conversation"): Promise<{ id: string; title: string }> {
  const res = await fetch(`${API_BASE}/conversations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  return res.json();
}

export async function getConversation(id: string): Promise<ConversationWithMessages> {
  const res = await fetch(`${API_BASE}/conversations/${id}`);
  return res.json();
}

export async function deleteConversation(id: string): Promise<void> {
  await fetch(`${API_BASE}/conversations/${id}`, { method: "DELETE" });
}

export async function listRunFiles(runId: string): Promise<FileInfo[]> {
  const res = await fetch(`${API_BASE}/runs/${runId}/files`);
  return res.json();
}

export async function readRunFile(runId: string, path: string): Promise<{ path: string; content: string }> {
  const res = await fetch(`${API_BASE}/runs/${runId}/files/${encodeURIComponent(path)}`);
  return res.json();
}

export async function getRunPlan(runId: string): Promise<import("./types").Plan | null> {
  try {
    const res = await fetch(`${API_BASE}/runs/${runId}/plan`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function submitApproval(runId: string, approved: boolean): Promise<void> {
  await fetch(`${API_BASE}/runs/${runId}/approval`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ approved }),
  });
}

// ── SSE streaming ─────────────────────────────────────────

export async function* streamMessage(
  conversationId: string,
  content: string,
  signal?: AbortSignal,
): AsyncGenerator<SSEEvent> {
  const response = await fetch(`${API_BASE}/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // SSE format: each event is "data: {...}\n\n"
    const parts = buffer.split("\n\n");
    buffer = parts.pop()!; // keep incomplete chunk

    for (const part of parts) {
      const line = part.trim();
      if (line.startsWith("data: ")) {
        try {
          yield JSON.parse(line.slice(6)) as SSEEvent;
        } catch {
          // skip malformed events
        }
      }
    }
  }
}
