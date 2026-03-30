"use client";

import { useCallback, useEffect, useState } from "react";
import * as api from "@/lib/api";
import type { Conversation, Message } from "@/lib/types";

export function useConversation(agentId?: string) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch conversation list (optionally filtered by agent)
  const refresh = useCallback(async () => {
    try {
      setError(null);
      const list = await api.listConversations(agentId);
      setConversations(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load conversations");
    }
  }, [agentId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Load a conversation's messages
  const loadConversation = useCallback(async (id: string) => {
    setActiveId(id);
    setLoading(true);
    setError(null);
    try {
      const conv = await api.getConversation(id);
      setMessages(conv.messages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load conversation");
    } finally {
      setLoading(false);
    }
  }, []);

  // Create a new conversation
  const createConversation = useCallback(async (title?: string) => {
    try {
      setError(null);
      const conv = await api.createConversation(
        title ?? `Chat ${new Date().toLocaleString()}`,
        agentId ?? "default",
      );
      await refresh();
      setActiveId(conv.id);
      setMessages([]);
      return conv.id;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create conversation");
      return null;
    }
  }, [agentId, refresh]);

  // Delete a conversation
  const removeConversation = useCallback(async (id: string) => {
    try {
      setError(null);
      await api.deleteConversation(id);
      if (activeId === id) {
        setActiveId(null);
        setMessages([]);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete conversation");
    }
  }, [activeId, refresh]);

  // Add a message locally (optimistic update)
  const addMessage = useCallback((msg: Message) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  // Clear the error state
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    conversations,
    activeId,
    messages,
    loading,
    error,
    refresh,
    loadConversation,
    createConversation,
    removeConversation,
    addMessage,
    clearError,
  };
}
