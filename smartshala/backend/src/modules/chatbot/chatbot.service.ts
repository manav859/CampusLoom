import Anthropic from "@anthropic-ai/sdk";
import type { Response } from "express";
import { env } from "../../config/env.js";
import { AppError } from "../../core/errors.js";
import { buildSystemPrompt } from "./chatbot.systemPrompt.js";
import { checkLimits, recordUsage } from "./chatbot.tokenTracker.js";

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

type ChatMessage = { role: "user" | "assistant"; content: string };

type StreamChatParams = {
  message: string;
  history: ChatMessage[];
  userId: string;
  schoolId: string;
  role: string;
  schoolName: string;
  erpContext?: string | null;
  res: Response;
};

export async function streamChat(params: StreamChatParams): Promise<void> {
  const { message, history, userId, schoolId, role, schoolName, erpContext, res } = params;

  // Enforce usage limits before we start streaming. Throwing here propagates to
  // the Express error handler as a normal 429 (we have not flushed headers yet).
  const limit = await checkLimits(userId, schoolId, role);
  if (!limit.allowed) {
    throw new AppError(429, limit.reason ?? "Chat usage limit reached", "CHAT_LIMIT_REACHED");
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    const trimmedHistory = history.slice(-6);
    const messages = [
      ...trimmedHistory,
      {
        role: "user" as const,
        content: erpContext ? `${message}\n\n[ERP DATA]:\n${erpContext}` : message
      }
    ];

    const stream = client.messages.stream({
      model: env.CLAUDE_MODEL,
      max_tokens: 1024,
      system: buildSystemPrompt(schoolName, role),
      messages
    });

    for await (const chunk of stream) {
      if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
        res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`);
      }
    }

    const finalMessage = await stream.finalMessage();
    await recordUsage(
      userId,
      schoolId,
      finalMessage.usage.input_tokens,
      finalMessage.usage.output_tokens
    );

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    console.error("[chatbot.service] streamChat error:", err);
    res.write(`data: ${JSON.stringify({ error: "AI service error. Please try again." })}\n\n`);
    res.end();
  }
}
