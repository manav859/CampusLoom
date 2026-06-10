"use client";

import { useEffect, useRef, useState } from "react";
import { useChatStream } from "./useChatStream";

const MAX_TEXTAREA_HEIGHT = 112; // px — matches max-h-28

export function ChatWindow({ onClose }: { onClose: () => void }) {
  const { messages, isLoading, error, sendMessage, clearChat, clearError } = useChatStream();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const canSend = input.trim().length > 0 && !isLoading;

  const resetTextareaHeight = () => {
    const el = textareaRef.current;
    if (el) el.style.height = "auto";
  };

  const handleSend = () => {
    if (!canSend) return;
    const text = input;
    setInput("");
    resetTextareaHeight();
    void sendMessage(text);
  };

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
    const el = event.currentTarget;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between bg-[#0a0a0f] px-4 py-3 text-white">
        <div>
          <p className="text-sm font-semibold leading-tight">School Assistant</p>
          <p className="text-[11px] leading-tight text-white/60">Powered by AI</p>
        </div>
        <button
          type="button"
          aria-label="Close chat"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <span className="text-xl leading-none">×</span>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-gray-50 p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-gray-400">
            <span className="text-4xl">🏫</span>
            <p className="mt-3 max-w-[15rem] text-sm">
              Ask me about attendance, fees, students, or how to use the ERP.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((message, index) => {
              const isUser = message.role === "user";
              const isLast = index === messages.length - 1;
              const showCursor = !isUser && isLast && message.content === "" && isLoading;
              return (
                <div key={index} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                  <div
                    className={
                      isUser
                        ? "max-w-[80%] whitespace-pre-wrap break-words rounded-2xl rounded-tr-sm bg-indigo-600 px-3.5 py-2 text-sm text-white"
                        : "max-w-[80%] whitespace-pre-wrap break-words rounded-2xl rounded-tl-sm border border-gray-200 bg-white px-3.5 py-2 text-sm text-gray-800"
                    }
                  >
                    {showCursor ? <span className="animate-pulse">▌</span> : message.content}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Error bar */}
      {error ? (
        <div className="flex items-center justify-between gap-2 border-t border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
          <span className="break-words">{error}</span>
          <button
            type="button"
            aria-label="Dismiss error"
            onClick={clearError}
            className="shrink-0 rounded px-1 text-base leading-none text-red-500 hover:text-red-700"
          >
            ×
          </button>
        </div>
      ) : null}

      {/* Input */}
      <div className="border-t border-gray-200 bg-white p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            className="max-h-28 flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            className={`flex h-9 shrink-0 items-center justify-center rounded-lg px-3.5 text-sm font-medium text-white transition-colors ${
              canSend ? "bg-indigo-600 hover:bg-indigo-700" : "cursor-not-allowed bg-gray-300"
            }`}
          >
            Send
          </button>
        </div>
        {messages.length > 0 ? (
          <button
            type="button"
            onClick={clearChat}
            className="mt-2 text-[11px] font-medium text-gray-400 transition-colors hover:text-gray-600"
          >
            Clear conversation
          </button>
        ) : null}
      </div>
    </div>
  );
}
