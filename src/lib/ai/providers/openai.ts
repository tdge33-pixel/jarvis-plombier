import "server-only";
import OpenAI from "openai";
import type { AIProvider, ChatMessage, ChatRequest, ChatResponse } from "../types";

const DEFAULT_MODEL = "gpt-4.1";

type Param = OpenAI.Chat.Completions.ChatCompletionMessageParam;

function toOpenAIMessages(system: string, messages: ChatMessage[]): Param[] {
  const out: Param[] = [{ role: "system", content: system }];
  for (const m of messages) {
    if (m.role === "user") out.push({ role: "user", content: m.content });
    else if (m.role === "assistant") {
      out.push({
        role: "assistant",
        content: m.content || null,
        ...(m.toolCalls?.length
          ? {
              tool_calls: m.toolCalls.map((tc) => ({
                id: tc.id,
                type: "function" as const,
                function: { name: tc.name, arguments: JSON.stringify(tc.args) },
              })),
            }
          : {}),
      });
    } else out.push({ role: "tool", tool_call_id: m.toolCallId, content: m.content });
  }
  return out;
}

export class OpenAIProvider implements AIProvider {
  readonly id = "openai";
  readonly label = "OpenAI";
  private readonly client = new OpenAI();
  private readonly model = process.env.AI_MODEL || DEFAULT_MODEL;

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: toOpenAIMessages(req.system, req.messages),
      tools: req.tools.map((t) => ({ type: "function" as const, function: { name: t.name, description: t.description, parameters: t.parameters } })),
    });
    const msg = completion.choices[0]?.message;
    const toolCalls = (msg?.tool_calls ?? []).flatMap((tc) => {
      if (tc.type !== "function") return [];
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function.arguments || "{}") as Record<string, unknown>;
      } catch {
        args = {};
      }
      return [{ id: tc.id, name: tc.function.name, args }];
    });
    return { text: msg?.content?.trim() ?? "", toolCalls };
  }
}
