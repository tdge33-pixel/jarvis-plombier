import "server-only";
import type { AppContext } from "@/lib/context";
import type { AgentAction, Message } from "@/lib/domain/types";
import { getAIProvider } from "@/lib/ai/provider";
import type { ChatMessage } from "@/lib/ai/types";
import { today } from "@/lib/dates";
import { getAction, listActions, logAction, updateActionStatus } from "@/lib/services/agent-actions";
import { appendMessage, createConversation, getConversation, listMessages } from "@/lib/services/conversations";
import { activeMemories } from "@/lib/services/memories";
import { getVertical } from "@/verticals";
import type { ChatUIMessage, UIBlock } from "./blocks";
import { decide } from "./permissions";
import { buildSystemPrompt } from "./prompt";
import { getTool, toolSpecs } from "./tools";
import type { ToolContext, ToolResult } from "./types";

const MAX_STEPS = 6;
const HISTORY_LIMIT = 20;

export interface TurnResult {
  conversationId: string;
  messages: ChatUIMessage[];
}

export function toUIMessage(m: Message): ChatUIMessage {
  return { id: m.id, role: m.role, content: m.content, blocks: (m.blocks ?? []) as UIBlock[], created_at: m.created_at };
}

function toolResultContent(result: ToolResult): string {
  return JSON.stringify({ ok: result.ok, summary: result.summary, headline: result.headline, data: result.data ?? null });
}

/**
 * Un tour de conversation :
 * 1. contexte (entreprise + mémoire + métier) → prompt système ;
 * 2. le modèle choisit un outil (ou répond directement) ;
 * 3. chaque appel d'outil passe par le contrôle de permissions :
 *    - exécution directe (niveau 1, ou niveau 2 autorisé sans validation) ;
 *    - ou création d'une action PENDING_CONFIRMATION et arrêt du tour ;
 * 4. les résultats réels sont renvoyés au modèle qui formule la réponse.
 */
export async function runAgentTurn(ctx: AppContext, input: { conversationId?: string | null; text: string }): Promise<TurnResult> {
  const text = input.text.trim();
  const conversation = (input.conversationId && (await getConversation(ctx, input.conversationId))) || (await createConversation(ctx, text));
  const userMessage = await appendMessage(ctx, conversation.id, "user", text);

  const vertical = getVertical(ctx.business.vertical);
  const [memories, provider, previous] = await Promise.all([activeMemories(ctx), getAIProvider(), listMessages(ctx, conversation.id)]);
  const system = buildSystemPrompt(ctx, vertical, memories);
  const meta = {
    today: today(ctx.tz),
    timezone: ctx.tz,
    interventionTypes: vertical.interventionTypes,
    quoteTemplates: vertical.quoteTemplates,
  };

  // Historique : seuls les textes sont rejoués (les cartes restent côté interface).
  const messages: ChatMessage[] = previous
    .slice(-HISTORY_LIMIT)
    .filter((m) => m.content.trim().length > 0)
    .map((m) => ({ role: m.role, content: m.content }));

  const tc: ToolContext = { ctx, vertical, conversationId: conversation.id };
  const blocks: UIBlock[] = [];
  let finalText = "";
  let stop = false;

  try {
    for (let step = 0; step < MAX_STEPS && !stop; step++) {
      const response = await provider.chat({ system, messages, tools: toolSpecs(), meta });
      if (response.toolCalls.length === 0) {
        finalText = response.text;
        break;
      }
      messages.push({ role: "assistant", content: response.text, toolCalls: response.toolCalls, raw: response.raw, providerId: provider.id });

      for (const call of response.toolCalls) {
        const tool = getTool(call.name);
        let result: ToolResult;
        if (!tool) {
          result = { ok: false, summary: `Outil inconnu : ${call.name}` };
        } else {
          const parsed = tool.schema.safeParse(call.args);
          const decision = decide(tool, ctx.settings.permissions);
          if (!parsed.success) {
            result = { ok: false, summary: "Paramètres invalides.", data: { issues: parsed.error.issues.map((i) => `${i.path.join(".")} : ${i.message}`) } };
          } else if (!decision.allowed) {
            result = { ok: false, summary: decision.reason };
          } else if (decision.needsConfirmation) {
            const prep = tool.prepare
              ? await tool.prepare(tc, parsed.data)
              : { kind: "confirm" as const, args: parsed.data, title: tool.description, question: "Je continue ?", lines: [], warnings: [], fields: [] };
            if (prep.kind === "result") {
              result = prep.result;
            } else {
              const action = await logAction(ctx, {
                conversation_id: conversation.id,
                action: tool.intent,
                tool_name: tool.name,
                level: tool.level,
                status: "PENDING_CONFIRMATION",
                initiated_by: "AI",
                summary: prep.lines[0] ? `${prep.title} — ${prep.lines.join(" · ")}` : prep.title,
                args: prep.args as Record<string, unknown>,
              });
              blocks.push({ type: "confirmation", actionId: action.id, title: prep.title, lines: prep.lines, warnings: prep.warnings, fields: prep.fields, level: tool.level, status: "PENDING_CONFIRMATION" });
              finalText = prep.question;
              stop = true;
              result = { ok: true, summary: "En attente de la validation de l'utilisateur." };
            }
          } else {
            result = await executeTool(ctx, tc, tool.name, parsed.data as Record<string, unknown>, conversation.id, "AI");
          }
        }
        if (result.blocks) blocks.push(...result.blocks);
        messages.push({ role: "tool", toolCallId: call.id, name: call.name, content: toolResultContent(result) });
      }
    }
  } catch (err) {
    console.error("[jarvis] erreur pendant le tour", err);
    finalText = "Désolé, je n'ai pas réussi à traiter votre demande. Réessayez dans un instant.";
  }

  if (!finalText && !stop) finalText = "C'est fait.";
  const assistant = await appendMessage(ctx, conversation.id, "assistant", finalText, blocks);
  return { conversationId: conversation.id, messages: [toUIMessage(userMessage), toUIMessage(assistant)] };
}

/** Exécute un outil et journalise le résultat dans agent_actions si nécessaire. */
async function executeTool(
  ctx: AppContext,
  tc: ToolContext,
  name: string,
  args: Record<string, unknown>,
  conversationId: string | null,
  initiatedBy: "AI" | "USER",
  existingAction?: AgentAction,
): Promise<ToolResult> {
  const tool = getTool(name);
  if (!tool) return { ok: false, summary: `Outil inconnu : ${name}` };
  try {
    const result = await tool.execute(tc, args);
    if (existingAction) {
      await updateActionStatus(ctx, existingAction.id, result.ok ? "EXECUTED" : "FAILED", { result: result.data ?? null, args, error: result.ok ? null : result.summary });
    } else if (tool.audit && result.ok) {
      await logAction(ctx, { conversation_id: conversationId, action: tool.intent, tool_name: tool.name, level: tool.level, status: "EXECUTED", initiated_by: initiatedBy, summary: result.summary.split("\n")[0]!, args, result: result.data ?? null });
    }
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (existingAction) await updateActionStatus(ctx, existingAction.id, "FAILED", { error: message });
    else if (tool.audit) await logAction(ctx, { conversation_id: conversationId, action: tool.intent, tool_name: tool.name, level: tool.level, status: "FAILED", initiated_by: initiatedBy, summary: "Échec", args, error: message });
    return { ok: false, summary: "L'action a échoué. Réessayez ou faites-le depuis l'écran correspondant." };
  }
}

/**
 * Réponse de l'utilisateur à une demande de confirmation (Confirmer / Modifier / Annuler).
 * Les arguments modifiés sont revalidés par le schéma de l'outil avant exécution.
 */
export async function resolveAction(
  ctx: AppContext,
  actionId: string,
  decision: "confirm" | "cancel",
  editedArgs?: Record<string, unknown>,
): Promise<{ message: ChatUIMessage | null; status: AgentAction["status"] }> {
  const action = await getAction(ctx, actionId);
  if (!action) throw new Error("Action introuvable");
  if (action.status !== "PENDING_CONFIRMATION") return { message: null, status: action.status };

  const reply = async (content: string, blocks: UIBlock[] = []) =>
    action.conversation_id ? toUIMessage(await appendMessage(ctx, action.conversation_id, "assistant", content, blocks)) : null;

  if (decision === "cancel") {
    await updateActionStatus(ctx, action.id, "CANCELLED");
    return { message: await reply("D'accord, je n'ai rien fait."), status: "CANCELLED" };
  }

  const tool = getTool(action.tool_name);
  if (!tool) throw new Error("Outil inconnu");
  const merged = { ...action.args, ...cleanEdits(editedArgs ?? {}) };
  const parsed = tool.schema.safeParse(merged);
  if (!parsed.success) {
    return { message: await reply("Les informations modifiées ne sont pas valides. Vérifiez la date et l'heure."), status: "PENDING_CONFIRMATION" };
  }
  await updateActionStatus(ctx, action.id, "CONFIRMED", { args: parsed.data as Record<string, unknown> });
  const tc: ToolContext = { ctx, vertical: getVertical(ctx.business.vertical), conversationId: action.conversation_id };
  const result = await executeTool(ctx, tc, tool.name, parsed.data as Record<string, unknown>, action.conversation_id, "USER", { ...action, status: "CONFIRMED" });
  return { message: await reply(result.summary, result.blocks ?? []), status: result.ok ? "EXECUTED" : "FAILED" };
}

/** Convertit les valeurs de formulaire (chaînes) dans les types attendus. */
function cleanEdits(edits: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(edits)) {
    if (v === "" || v === null || v === undefined) continue;
    out[k] = typeof v === "string" && /(minutes|hours)$/i.test(k) ? Number(v) : v;
  }
  return out;
}

/** Charge une conversation pour l'affichage, avec le statut à jour des demandes de confirmation. */
export async function loadConversationForUI(ctx: AppContext, conversationId: string): Promise<ChatUIMessage[]> {
  const [messages, actions] = await Promise.all([listMessages(ctx, conversationId), listActions(ctx, 200)]);
  const statusById = new Map(actions.map((a) => [a.id, a.status]));
  return messages.map((m) => {
    const ui = toUIMessage(m);
    ui.blocks = ui.blocks.map((b) => (b.type === "confirmation" ? { ...b, status: statusById.get(b.actionId) ?? b.status } : b));
    return ui;
  });
}
