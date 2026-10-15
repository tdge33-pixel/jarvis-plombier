import "server-only";
import type { AppContext } from "@/lib/context";
import type { AgentAction, AgentActionStatus, ID } from "@/lib/domain/types";

/** Journal de traçabilité de tout ce que Jarvis fait (ou propose de faire). */
export async function logAction(
  ctx: AppContext,
  input: Pick<AgentAction, "action" | "tool_name" | "level" | "status" | "initiated_by" | "summary" | "args"> & {
    conversation_id?: ID | null;
    result?: unknown;
    error?: string | null;
  },
): Promise<AgentAction> {
  return ctx.store.insert("agent_actions", {
    conversation_id: input.conversation_id ?? null,
    user_id: ctx.user.id,
    action: input.action,
    tool_name: input.tool_name,
    level: input.level,
    status: input.status,
    initiated_by: input.initiated_by,
    summary: input.summary,
    args: input.args,
    result: input.result ?? null,
    error: input.error ?? null,
    confirmed_at: null,
    executed_at: input.status === "EXECUTED" ? new Date().toISOString() : null,
  });
}

export async function updateActionStatus(
  ctx: AppContext,
  id: ID,
  status: AgentActionStatus,
  extra: { result?: unknown; error?: string | null; args?: Record<string, unknown>; summary?: string } = {},
): Promise<AgentAction> {
  return ctx.store.update("agent_actions", id, {
    status,
    ...extra,
    ...(status === "EXECUTED" ? { executed_at: new Date().toISOString() } : {}),
    ...(status === "CONFIRMED" ? { confirmed_at: new Date().toISOString() } : {}),
  });
}

export async function getAction(ctx: AppContext, id: ID): Promise<AgentAction | null> {
  return ctx.store.get("agent_actions", id);
}

export async function listActions(ctx: AppContext, limit = 100): Promise<AgentAction[]> {
  return ctx.store.list("agent_actions", { order: { column: "created_at", ascending: false }, limit });
}
