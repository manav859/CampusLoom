"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChatWindow } from "./ChatWindow";
import { useChatStream } from "./useChatStream";

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  // Held here, in the always-mounted widget, so the conversation survives
  // closing and reopening the window (the window itself unmounts on close).
  const chat = useChatStream();

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      <AnimatePresence>
        {open ? (
          <motion.div
            key="chat-card"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="mb-3 h-[520px] w-[380px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl"
          >
            <ChatWindow chat={chat} onClose={() => setOpen(false)} />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <button
        type="button"
        aria-label={open ? "Close chat" : "Open chat"}
        onClick={() => setOpen((value) => !value)}
        className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-indigo-600 text-2xl text-white shadow-lg transition-colors hover:bg-indigo-700"
      >
        <span aria-hidden>{open ? "×" : "💬"}</span>
      </button>
    </div>
  );
}
