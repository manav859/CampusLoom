import type { Response } from "express";
import { AppError } from "../../core/errors.js";
import { buildSystemPrompt } from "./chatbot.systemPrompt.js";
import { getChatProvider, type ChatMessage } from "./chatbot.providers.js";
import { checkLimits, recordUsage } from "./chatbot.tokenTracker.js";

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

export async function streamChat(params: StreamChatParams): Promise<string> {
  const { message, history, userId, schoolId, role, schoolName, erpContext, res } = params;

  // Enforce usage limits before we start streaming. Throwing here propagates to
  // the Express error handler as a normal 429 (we have not flushed headers yet).
  const limit = await checkLimits(userId, schoolId, role);
  if (!limit.allowed) {
    throw new AppError(429, limit.reason ?? "Chat usage limit reached", "CHAT_LIMIT_REACHED");
  }

  // Resolve the provider (and its API key) before flushing headers so a missing
  // key surfaces as a normal 503 (we can still set an HTTP status at this point).
  const provider = getChatProvider();

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  let assistantText = "";
  try {
    const trimmedHistory = history.slice(-6);
    const messages: ChatMessage[] = [
      ...trimmedHistory,
      {
        role: "user",
        content: erpContext ? `${message}\n\n[ERP DATA]:\n${erpContext}` : message
      }
    ];

    const stream = provider.stream({
      system: buildSystemPrompt(schoolName, role),
      messages,
      maxTokens: 1024
    });

    for await (const text of stream.text) {
      assistantText += text;
      res.write(`data: ${JSON.stringify({ text })}\n\n`);
    }

    const usage = stream.getUsage();
    await recordUsage(userId, schoolId, usage.inputTokens, usage.outputTokens);

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
    return assistantText;
  } catch (err) {
    console.error("[chatbot.service] streamChat error:", err);
    res.write(`data: ${JSON.stringify({ error: "AI service error. Please try again." })}\n\n`);
    res.end();
    return assistantText;
  }
}
