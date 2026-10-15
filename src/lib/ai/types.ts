/**
 * Contrat neutre entre le moteur de Jarvis et un modèle d'IA.
 * Le moteur ne connaît que ces types ; chaque fournisseur (Anthropic, OpenAI,
 * moteur local…) traduit vers son propre format.
 */

export type JSONSchema = Record<string, unknown>;

export interface ToolSpec {
  name: string;
  description: string;
  parameters: JSONSchema;
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export type ChatMessage =
  | { role: "user"; content: string }
  | {
      role: "assistant";
      content: string;
      toolCalls?: ToolCall[];
      /** Contenu brut du fournisseur, renvoyé tel quel au même fournisseur (ex : blocs de réflexion). */
      raw?: unknown;
      providerId?: string;
    }
  | { role: "tool"; toolCallId: string; name: string; content: string };

/** Informations utiles aux fournisseurs qui n'utilisent pas de LLM (moteur local). */
export interface ChatMeta {
  today: string;
  timezone: string;
  interventionTypes: Array<{ label: string; keywords: string[]; defaultDurationMinutes: number }>;
  quoteTemplates: Array<{ label: string; keywords: string[]; laborHours: number; materials: Array<{ label: string; unitPrice: number }> }>;
}

export interface ChatRequest {
  system: string;
  messages: ChatMessage[];
  tools: ToolSpec[];
  meta: ChatMeta;
}

export interface ChatResponse {
  text: string;
  toolCalls: ToolCall[];
  raw?: unknown;
}

export interface AIProvider {
  readonly id: string;
  readonly label: string;
  chat(request: ChatRequest): Promise<ChatResponse>;
}
