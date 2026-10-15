import "server-only";
import type { AIProvider } from "./types";

export type { AIProvider, ChatMessage, ChatRequest, ChatResponse, ToolCall, ToolSpec } from "./types";

export type AIProviderId = "anthropic" | "openai" | "local";

/**
 * Sélection du fournisseur d'IA.
 * AI_PROVIDER = anthropic | openai | local. Si non défini : le premier fournisseur
 * dont la clé est présente, sinon le moteur local (hors-ligne, à règles) pour la démo.
 */
export function resolveProviderId(): AIProviderId {
  const explicit = process.env.AI_PROVIDER?.toLowerCase();
  if (explicit === "anthropic" || explicit === "openai" || explicit === "local") return explicit;
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "local";
}

let cached: { id: AIProviderId; provider: AIProvider } | null = null;

export async function getAIProvider(): Promise<AIProvider> {
  const id = resolveProviderId();
  if (cached?.id === id) return cached.provider;
  let provider: AIProvider;
  switch (id) {
    case "anthropic": {
      const { AnthropicProvider } = await import("./providers/anthropic");
      provider = new AnthropicProvider();
      break;
    }
    case "openai": {
      const { OpenAIProvider } = await import("./providers/openai");
      provider = new OpenAIProvider();
      break;
    }
    default: {
      const { LocalProvider } = await import("./providers/local");
      provider = new LocalProvider();
    }
  }
  cached = { id, provider };
  return provider;
}
