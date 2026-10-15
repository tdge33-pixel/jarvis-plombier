"use client";

import { History, Mic, Plus, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatUIMessage, UIBlock } from "@/core/agent/blocks";
import { JarvisOrb } from "@/components/ui/misc";
import { cn } from "@/lib/format";
import { BlockView } from "./blocks";
import { useVoiceInput } from "./use-voice-input";

interface ChatProps {
  firstName: string;
  conversationId: string | null;
  initialMessages: ChatUIMessage[];
  initialQuery: string | null;
  suggestions: string[];
  conversations: Array<{ id: string; title: string; updated_at: string }>;
}

export function Chat({ firstName, conversationId: initialId, initialMessages, initialQuery, suggestions, conversations }: ChatProps) {
  const router = useRouter();
  const [conversationId, setConversationId] = useState(initialId);
  const [messages, setMessages] = useState<ChatUIMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sentInitial = useRef(false);
  const voice = useVoiceInput((t) => setInput(t));

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  const send = useCallback(
    async (text: string) => {
      const value = text.trim();
      if (!value || busy) return;
      setInput("");
      setBusy(true);
      const tempId = `tmp-${Date.now()}`;
      setMessages((m) => [...m, { id: tempId, role: "user", content: value, blocks: [], created_at: new Date().toISOString() }]);
      try {
        const res = await fetch("/api/jarvis", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ conversationId, text: value }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { conversationId: string; messages: ChatUIMessage[] };
        setConversationId(data.conversationId);
        setMessages((m) => [...m.filter((x) => x.id !== tempId), ...data.messages]);
        if (!conversationId) window.history.replaceState(null, "", `/jarvis?c=${data.conversationId}`);
      } catch {
        setMessages((m) => [
          ...m,
          { id: `err-${Date.now()}`, role: "assistant", content: "Je n'arrive pas à joindre le serveur. Vérifiez votre connexion et réessayez.", blocks: [], created_at: new Date().toISOString() },
        ]);
      } finally {
        setBusy(false);
        textareaRef.current?.focus();
      }
    },
    [busy, conversationId],
  );

  useEffect(() => {
    if (initialQuery && !sentInitial.current) {
      sentInitial.current = true;
      void send(initialQuery);
    }
  }, [initialQuery, send]);

  /** Réponse à une carte de confirmation (Confirmer / Modifier / Annuler). */
  const resolve = useCallback(
    async (actionId: string, decision: "confirm" | "cancel", args?: Record<string, unknown>) => {
      const res = await fetch(`/api/jarvis/actions/${actionId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision, args }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { message: ChatUIMessage | null; status: string };
      setMessages((m) => [
        ...m.map((msg) => ({
          ...msg,
          blocks: msg.blocks.map((b): UIBlock => (b.type === "confirmation" && b.actionId === actionId ? { ...b, status: data.status as typeof b.status } : b)),
        })),
        ...(data.message ? [data.message] : []),
      ]);
      router.refresh();
    },
    [router],
  );

  const empty = messages.length === 0 && !busy;

  return (
    <div className="-mx-4 -my-6 flex h-[calc(100dvh-3.5rem)] flex-col sm:-mx-6 lg:-mx-10 lg:-my-10 lg:h-dvh">
      {/* Barre supérieure */}
      <div className="flex items-center justify-between gap-3 border-b border-line bg-white/80 px-4 py-3 backdrop-blur sm:px-6">
        <div className="flex items-center gap-3">
          <JarvisOrb size={34} />
          <div>
            <p className="font-semibold leading-tight">Jarvis</p>
            <p className="text-xs text-muted">{busy ? "Réfléchit…" : "Votre assistant personnel"}</p>
          </div>
        </div>
        <div className="relative flex items-center gap-1">
          {conversations.length > 0 && (
            <button onClick={() => setShowHistory((v) => !v)} className="flex h-10 items-center gap-2 rounded-xl px-3 text-sm text-muted hover:bg-slate-100" aria-expanded={showHistory}>
              <History className="size-4" /> <span className="hidden sm:inline">Historique</span>
            </button>
          )}
          <Link href="/jarvis?nouveau=1" className="flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium text-brand-600 hover:bg-brand-50">
            <Plus className="size-4" /> <span className="hidden sm:inline">Nouvelle conversation</span>
          </Link>
          {showHistory && (
            <div className="absolute top-12 right-0 z-20 w-72 rounded-2xl border border-line bg-white p-2 shadow-xl">
              {conversations.map((c) => (
                <Link
                  key={c.id}
                  href={`/jarvis?c=${c.id}`}
                  onClick={() => setShowHistory(false)}
                  className={cn("block truncate rounded-lg px-3 py-2 text-sm hover:bg-slate-50", c.id === conversationId && "bg-brand-50 text-brand-700")}
                >
                  {c.title}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-5">
          {empty && (
            <div className="flex flex-col items-center pt-8 text-center sm:pt-16">
              <JarvisOrb size={84} />
              <h1 className="mt-6 text-2xl font-semibold tracking-tight">Bonjour {firstName}, je vous écoute.</h1>
              <p className="mt-2 max-w-md text-muted">Parlez-moi comme à un collègue : planning, clients, devis, tâches, messages… Je prépare, vous validez.</p>
              <div className="mt-8 grid w-full gap-2 sm:grid-cols-2">
                {suggestions.map((s) => (
                  <button key={s} onClick={() => send(s)} className="rounded-2xl border border-line bg-white px-4 py-3 text-left text-[15px] shadow-card hover:border-brand-200 hover:bg-brand-50/50">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="flex justify-end animate-fade-up">
                <div className="max-w-[85%] rounded-2xl rounded-br-md bg-brand-500 px-4 py-2.5 text-[15px] whitespace-pre-wrap text-white shadow-sm">{m.content}</div>
              </div>
            ) : (
              <div key={m.id} className="flex gap-3 animate-fade-up">
                <JarvisOrb size={30} className="mt-1" />
                <div className="min-w-0 flex-1 space-y-3">
                  {m.content && <div className="max-w-[95%] rounded-2xl rounded-tl-md border border-line bg-white px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap shadow-card">{m.content}</div>}
                  {m.blocks.map((b, i) => (
                    <BlockView key={i} block={b} onResolve={resolve} />
                  ))}
                </div>
              </div>
            ),
          )}

          {busy && (
            <div className="flex items-center gap-3">
              <JarvisOrb size={30} />
              <div className="flex gap-1.5 rounded-2xl border border-line bg-white px-4 py-3.5 shadow-card">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="size-2 animate-bounce rounded-full bg-brand-400" style={{ animationDelay: `${i * 120}ms` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      {/* Saisie */}
      <div className="border-t border-line bg-white px-4 py-3 sm:px-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
          className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-line bg-surface p-2 focus-within:border-brand-300 focus-within:ring-4 focus-within:ring-brand-100"
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            rows={1}
            placeholder="Demandez quelque chose à Jarvis…"
            className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-2 py-2.5 text-[15px] focus:outline-none"
            aria-label="Message pour Jarvis"
          />
          {voice.supported && (
            <button
              type="button"
              onClick={voice.listening ? voice.stop : voice.start}
              className={cn("grid size-11 shrink-0 place-items-center rounded-xl", voice.listening ? "bg-red-500 text-white" : "text-muted hover:bg-white")}
              aria-label={voice.listening ? "Arrêter la dictée" : "Dicter un message"}
            >
              <Mic className="size-5" />
            </button>
          )}
          <button type="submit" disabled={busy || !input.trim()} className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-40" aria-label="Envoyer">
            <Send className="size-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
