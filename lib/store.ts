"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChatMessage } from "./types";

interface ChatState {
  // 当前正在聊的 chatId
  chatId: string | null;
  // 当前聊的 messages（不包括首条 firstMessage，由后端处理）
  messages: ChatMessage[];
  // 正在流式接收
  streaming: boolean;
  // 主题：light / dark / system
  theme: "light" | "dark" | "system";

  setChatId: (id: string | null) => void;
  setMessages: (msgs: ChatMessage[]) => void;
  appendMessage: (msg: ChatMessage) => void;
  updateLastAssistant: (chunk: string) => void;
  setStreaming: (s: boolean) => void;
  clearMessages: () => void;
  setTheme: (t: "light" | "dark" | "system") => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      chatId: null,
      messages: [],
      streaming: false,
      theme: "system",

      setChatId: (id) => set({ chatId: id }),
      setMessages: (msgs) => set({ messages: msgs }),
      appendMessage: (msg) =>
        set((s) => ({ messages: [...s.messages, msg] })),
      updateLastAssistant: (chunk) =>
        set((s) => {
          const arr = [...s.messages];
          if (arr.length === 0) return s;
          const last = arr[arr.length - 1];
          if (last.role !== "assistant") return s;
          arr[arr.length - 1] = {
            ...last,
            content: last.content + chunk,
          };
          return { messages: arr };
        }),
      setStreaming: (streaming) => set({ streaming }),
      clearMessages: () => set({ messages: [], chatId: null }),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: "sillytavern-chat",
      partialize: (s) => ({ theme: s.theme }),
    }
  )
);
