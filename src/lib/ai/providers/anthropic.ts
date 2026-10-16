import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { AIProvider, ChatMessage, ChatRequest, ChatResponse } from "../types";

const DEFAULT_MODEL = "claude-opus-5-5";
/** Modèles acceptant le repli serveur automatique en cas de refus (`fallbacks: "default"`). */
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-opus-5", "claude-fable-5-1", "claude-sonnet-5-5"]);

type Param = Anthropic.Beta.Messages.BetaMessageParam;

/** Traduit l'historique neutre vers le format Messages API (résultats d'outils groupés). */
function toAnthropicMessages(messages: ChatMessage[]): Param[] {
  const out: Param[] = [];
  for (const m of messages) {
    if (m.role === "user") {
      out.push({ role: "user", content: m.content });
    } else if (m.role === "assistant") {
      if (m.providerId === "anthropic" && m.raw) {
        // Contenu brut renvoyé à l'identique (conserve les blocs de réflexion).
        out.push({ role: "assistant", content: m.raw as Anthropic.Beta.Messages.BetaContentBlockParam[] });
      } else {
        const content: Anthropic.Beta.Messages.BetaContentBlockParam[] = [];
        if (m.content) content.push({ type: "text", text: m.content });
        for (const tc of m.toolCalls ?? []) content.push({ type: "tool_use", id: tc.id, name: tc.name, input: tc.args });
        if (content.length) out.push({ role: "assistant", content });
      }
    } else {
      const block: Anthropic.Beta.Messages.BetaToolResultBlockParam = { type: "tool_result", tool_use_id: m.toolCallId, content: m.content };
      const last = out[out.length - 1];
      // Tous les résultats d'outils d'un même tour vont dans un seul message utilisateur.
      if (last && last.role === "user" && Array.isArray(last.content) && last.content.every((b) => b.type === "tool_result")) {
        last.content.push(block);
      } else {
        out.push({ role: "user", content: [block] });
      }
    }
  }
  return out;
}

export class AnthropicProvider implements AIProvider {
  readonly id = "anthropic";
  readonly label = "Anthropic Claude";
  private readonly client = new Anthropic();
  private readonly model = process.env.AI_MODEL || DEFAULT_MODEL;

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const params = {
      model: this.model,
      max_tokens: 16000,
      system: [{ type: "text" as const, text: req.system }],
      messages: toAnthropicMessages(req.messages),
      tools: req.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters as Anthropic.Beta.Messages.BetaTool.InputSchema,
      })),
      // Assistant conversationnel : effort modéré pour des réponses rapides.
      output_config: { effort: "medium" as const },
    };
    let response: Anthropic.Beta.Messages.BetaMessage;
    if (FALLBACK_MODELS.has(this.model)) {
      try {
        response = await this.client.beta.messages.create({ ...params, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" });
      } catch (err) {
        // Repli serveur indisponible pour ce compte : on relance la requête sans.
        if (!(err instanceof Anthropic.BadRequestError)) throw err;
        response = await this.client.beta.messages.create(params);
      }
    } else {
      response = await this.client.beta.messages.create(params);
    }

    if (response.stop_reason === "refusal") {
      return { text: "Je ne peux pas traiter cette demande. Pouvez-vous la reformuler ?", toolCalls: [] };
    }

    const text = response.content
      .filter((b): b is Anthropic.Beta.Messages.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    const toolCalls = response.content
      .filter((b): b is Anthropic.Beta.Messages.BetaToolUseBlock => b.type === "tool_use")
      .map((b) => ({ id: b.id, name: b.name, args: (b.input ?? {}) as Record<string, unknown> }));

    return { text, toolCalls, raw: response.content };
  }
}
