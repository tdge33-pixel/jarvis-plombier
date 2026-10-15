import { Chat } from "@/components/jarvis/chat";
import { loadConversationForUI } from "@/core/agent/engine";
import { requireContext } from "@/lib/context";
import { getConversation, listConversations } from "@/lib/services/conversations";
import { getVertical } from "@/verticals";

export const metadata = { title: "Jarvis" };

export default async function JarvisPage({ searchParams }: { searchParams: Promise<{ c?: string; q?: string; nouveau?: string }> }) {
  const ctx = await requireContext();
  const sp = await searchParams;
  const conversations = await listConversations(ctx);

  // ?q= : nouvelle demande venant de l'accueil → nouvelle conversation.
  // ?c= : conversation précise. Sinon : la plus récente.
  const target = sp.q || sp.nouveau ? null : sp.c ? await getConversation(ctx, sp.c) : (conversations[0] ?? null);
  const messages = target ? await loadConversationForUI(ctx, target.id) : [];

  return (
    <Chat
      key={target?.id ?? `new-${sp.q ?? ""}`}
      firstName={ctx.profile.first_name}
      conversationId={target?.id ?? null}
      initialMessages={messages}
      initialQuery={sp.q ?? null}
      suggestions={getVertical(ctx.business.vertical).examplePrompts}
      conversations={conversations.map((c) => ({ id: c.id, title: c.title, updated_at: c.updated_at }))}
    />
  );
}
