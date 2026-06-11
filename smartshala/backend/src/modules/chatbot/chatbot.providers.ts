import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import { env } from "../../config/env.js";
import { AppError } from "../../core/errors.js";

// Provider abstraction so the chatbot can run on Anthropic (Claude), Google
// (Gemini), or OpenRouter without the service caring which. Pick via
// AI_PROVIDER. Each adapter streams plain text deltas and reports token usage
// in a common shape, so the rate limiter and SSE writer stay provider-neutral.

export type ChatMessage = { role: "user" | "assistant"; content: string };
export type Usage = { inputTokens: number; outputTokens: number };

export type StreamArgs = {
  system: string;
  messages: ChatMessage[];
  maxTokens: number;
};

export type ProviderStream = {
  /** Yields text deltas as they arrive. */
  text: AsyncIterable<string>;
  /** Token usage — only valid once `text` has been fully consumed. */
  getUsage(): Usage;
};

export interface ChatProvider {
  readonly model: string;
  stream(args: StreamArgs): ProviderStream;
}

let anthropicClient: Anthropic | null = null;

function anthropicProvider(): ChatProvider {
  if (!env.ANTHROPIC_API_KEY) {
    throw new AppError(503, "AI assistant is not configured", "CHAT_NOT_CONFIGURED");
  }
  if (!anthropicClient) anthropicClient = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const client = anthropicClient;

  return {
    model: env.CLAUDE_MODEL,
    stream({ system, messages, maxTokens }) {
      const stream = client.messages.stream({
        model: env.CLAUDE_MODEL,
        max_tokens: maxTokens,
        system,
        messages
      });

      let usage: Usage = { inputTokens: 0, outputTokens: 0 };
      async function* text(): AsyncIterable<string> {
        for await (const chunk of stream) {
          if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
            yield chunk.delta.text;
          }
        }
        const final = await stream.finalMessage();
        usage = {
          inputTokens: final.usage.input_tokens,
          outputTokens: final.usage.output_tokens
        };
      }

      return { text: text(), getUsage: () => usage };
    }
  };
}

let geminiClient: GoogleGenerativeAI | null = null;

// Gemini uses role "model" for assistant turns and requires the conversation to
// begin with a user turn. Map our messages and drop any leading model turns.
function toGeminiContents(messages: ChatMessage[]) {
  const mapped = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }]
  }));
  while (mapped.length > 0 && mapped[0].role === "model") mapped.shift();
  return mapped;
}

function geminiProvider(): ChatProvider {
  if (!env.GEMINI_API_KEY) {
    throw new AppError(503, "AI assistant is not configured", "CHAT_NOT_CONFIGURED");
  }
  if (!geminiClient) geminiClient = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  const client = geminiClient;

  return {
    model: env.GEMINI_MODEL,
    stream({ system, messages, maxTokens }) {
      const model = client.getGenerativeModel({
        model: env.GEMINI_MODEL,
        systemInstruction: system
      });
      const contents = toGeminiContents(messages);

      let usage: Usage = { inputTokens: 0, outputTokens: 0 };
      async function* text(): AsyncIterable<string> {
        const result = await model.generateContentStream({
          contents,
          generationConfig: { maxOutputTokens: maxTokens }
        });
        for await (const chunk of result.stream) {
          const t = chunk.text();
          if (t) yield t;
        }
        const meta = (await result.response).usageMetadata;
        usage = {
          inputTokens: meta?.promptTokenCount ?? 0,
          outputTokens: meta?.candidatesTokenCount ?? 0
        };
      }

      return { text: text(), getUsage: () => usage };
    }
  };
}

// OpenRouter speaks the OpenAI API, so we use the openai SDK pointed at their
// endpoint. This routes Gemini (and other) models through OpenRouter's servers,
// which sidesteps the "user location is not supported" geo-block that Google's
// direct API applies to some cloud hosts.
let openrouterClient: OpenAI | null = null;

function openrouterProvider(): ChatProvider {
  if (!env.OPENROUTER_API_KEY) {
    throw new AppError(503, "AI assistant is not configured", "CHAT_NOT_CONFIGURED");
  }
  if (!openrouterClient) {
    openrouterClient = new OpenAI({
      apiKey: env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1"
    });
  }
  const client = openrouterClient;

  return {
    model: env.OPENROUTER_MODEL,
    stream({ system, messages, maxTokens }) {
      let usage: Usage = { inputTokens: 0, outputTokens: 0 };
      const params = {
        model: env.OPENROUTER_MODEL,
        max_tokens: maxTokens,
        stream: true as const,
        stream_options: { include_usage: true },
        messages: [
          { role: "system" as const, content: system },
          ...messages.map((m) => ({ role: m.role, content: m.content }))
        ]
      };

      // Free-tier models occasionally return a transient 429/5xx. Retry once
      // after a short delay before surfacing the error to the user.
      async function createWithRetry() {
        for (let attempt = 0; ; attempt++) {
          try {
            return await client.chat.completions.create(params);
          } catch (err) {
            const status = (err as { status?: number })?.status;
            const transient = status === 429 || status === 500 || status === 502 || status === 503;
            if (attempt === 0 && transient) {
              await new Promise((resolve) => setTimeout(resolve, 1000));
              continue;
            }
            throw err;
          }
        }
      }

      async function* text(): AsyncIterable<string> {
        const completion = await createWithRetry();
        for await (const chunk of completion) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) yield delta;
          if (chunk.usage) {
            usage = {
              inputTokens: chunk.usage.prompt_tokens ?? 0,
              outputTokens: chunk.usage.completion_tokens ?? 0
            };
          }
        }
      }
      return { text: text(), getUsage: () => usage };
    }
  };
}

export function getChatProvider(): ChatProvider {
  switch (env.AI_PROVIDER) {
    case "gemini":
      return geminiProvider();
    case "openrouter":
      return openrouterProvider();
    default:
      return anthropicProvider();
  }
}
