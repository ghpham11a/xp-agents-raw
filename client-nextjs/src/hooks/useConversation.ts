"use client";

import { useCallback, useEffect, useState } from "react";
import * as api from "@/lib/api";
import type { Conversation, Message } from "@/lib/types";

export function useConversation() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch conversation list
  const refresh = useCallback(async () => {
    const list = await api.listConversations();
    setConversations(list);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Load a conversation's messages
  const loadConversation = useCallback(async (id: string) => {
    setActiveId(id);
    setLoading(true);
    try {
      const conv = await api.getConversation(id);
      setMessages(conv.messages);
    } finally {
      setLoading(false);
    }
  }, []);

  // Create a new conversation
  const createConversation = useCallback(async (title?: string) => {
    const conv = await api.createConversation(title ?? `Chat ${new Date().toLocaleString()}`);
    await refresh();
    setActiveId(conv.id);
    setMessages([]);
    return conv.id;
  }, [refresh]);

  // Delete a conversation
  const removeConversation = useCallback(async (id: string) => {
    await api.deleteConversation(id);
    if (activeId === id) {
      setActiveId(null);
      setMessages([]);
    }
    await refresh();
  }, [activeId, refresh]);

  // Add a message locally (optimistic update)
  const addMessage = useCallback((msg: Message) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  return {
    conversations,
    activeId,
    messages,
    loading,
    refresh,
    loadConversation,
    createConversation,
    removeConversation,
    addMessage,
  };
}
