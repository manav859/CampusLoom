"use client";

import { useCallback, useState } from "react";
import { apiStream } from "@/lib/api";

export type ChatRole = "user" | "assistant";
export type ChatMessage = { role: ChatRole; content: string };

type StreamChunk = { text?: string; done?: boolean; error?: string };

export function useChatStream() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (userText: string) => {
      const text = userText.trim();
      if (!text || isLoading) return;

      setError(null);

      // The prior conversation (before this turn) is the history we send. The
      // backend appends the new user message itself, so it must NOT be included.
      const history = messages.slice(-6);

      setMessages((prev) => [
        ...prev,
        { role: "user", content: text },
        { role: "assistant", content: "" }
      ]);
      setIsLoading(true);

      const appendToLastAssistant = (delta: string) =>
        setMessages((prev) => {
          const next = prev.slice();
          const last = next[next.length - 1];
          if (last && last.role === "assistant") {
            next[next.length - 1] = { ...last, content: last.content + delta };
          }
          return next;
        });

      const removeEmptyAssistantBubble = () =>
        setMessages((prev) => {
          const next = prev.slice();
          const last = next[next.length - 1];
          if (last && last.role === "assistant" && last.content === "") next.pop();
          return next;
        });

      try {
        const response = await apiStream("/chatbot/ask", {
          method: "POST",
          body: JSON.stringify({ message: text, history })
        });

        // Limit hit (or any pre-stream failure): the body is JSON, not a stream.
        if (response.status === 429 || !response.ok) {
          const payload = await response.json().catch(() => null);
          setError(payload?.error?.message ?? "Chat is unavailable right now. Please try again later.");
          removeEmptyAssistantBubble();
          setIsLoading(false);
          return;
        }

        if (!response.body) throw new Error("No response stream");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trimStart();
            if (!trimmed.startsWith("data:")) continue;

            const payload = trimmed.slice(trimmed.indexOf(":") + 1).trim();
            if (!payload) continue;

            let chunk: StreamChunk;
            try {
              chunk = JSON.parse(payload);
            } catch {
              continue;
            }

            if (chunk.error) {
              setError(chunk.error);
              setIsLoading(false);
            } else if (chunk.done) {
              setIsLoading(false);
            } else if (typeof chunk.text === "string") {
              appendToLastAssistant(chunk.text);
            }
          }
        }
      } catch {
        setError("Something went wrong. Please try again.");
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, messages]
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { messages, isLoading, error, sendMessage, clearChat, clearError };
}
