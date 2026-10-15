import "server-only";
import type { AppContext } from "@/lib/context";
import type { Conversation, ID, Message, MessageRole } from "@/lib/domain/types";

export async function listConversations(ctx: AppContext): Promise<Conversation[]> {
  return ctx.store.list("conversations", { eq: { user_id: ctx.user.id }, order: { column: "updated_at", ascending: false }, limit: 30 });
}

export async function getConversation(ctx: AppContext, id: ID): Promise<Conversation | null> {
  const c = await ctx.store.get("conversations", id);
  return c && c.user_id === ctx.user.id ? c : null;
}

export async function createConversation(ctx: AppContext, title: string): Promise<Conversation> {
  return ctx.store.insert("conversations", { user_id: ctx.user.id, title: title.slice(0, 80) || "Nouvelle conversation" });
}

export async function listMessages(ctx: AppContext, conversationId: ID): Promise<Message[]> {
  return ctx.store.list("messages", { eq: { conversation_id: conversationId }, order: { column: "created_at", ascending: true } });
}

export async function appendMessage(ctx: AppContext, conversationId: ID, role: MessageRole, content: string, blocks: unknown[] = []): Promise<Message> {
  const msg = await ctx.store.insert("messages", { conversation_id: conversationId, role, content, blocks });
  await ctx.store.update("conversations", conversationId, { updated_at: new Date().toISOString() });
  return msg;
}

export async function deleteConversation(ctx: AppContext, id: ID): Promise<void> {
  const messages = await listMessages(ctx, id);
  await Promise.all(messages.map((m) => ctx.store.remove("messages", m.id)));
  await ctx.store.remove("conversations", id);
}
