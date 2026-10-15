"use client";

import { ArrowRight, Mic } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { JarvisOrb } from "@/components/ui/misc";
import { useVoiceInput } from "./use-voice-input";

/** Grande zone « Parler à Jarvis » de l'accueil : ouvre la conversation avec la demande. */
export function AskBox({ suggestions }: { suggestions: string[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const voice = useVoiceInput((t) => setText(t));

  const go = (q: string) => {
    if (!q.trim()) return;
    router.push(`/jarvis?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <div className="rounded-3xl bg-night p-1.5 shadow-glow">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go(text);
        }}
        className="flex items-center gap-3 rounded-[20px] bg-[radial-gradient(120%_120%_at_0%_0%,#1b3263_0%,#0b1630_60%)] px-4 py-3 sm:px-5 sm:py-4"
      >
        <JarvisOrb size={44} className="hidden sm:inline-grid" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Parler à Jarvis…"
          className="min-w-0 flex-1 bg-transparent text-lg text-white placeholder:text-slate-400 focus:outline-none"
          aria-label="Demandez quelque chose à Jarvis"
        />
        {voice.supported && (
          <button
            type="button"
            onClick={voice.listening ? voice.stop : voice.start}
            className={`grid size-11 shrink-0 place-items-center rounded-full ${voice.listening ? "bg-red-500 text-white" : "bg-white/10 text-slate-200 hover:bg-white/20"}`}
            aria-label={voice.listening ? "Arrêter la dictée" : "Dicter"}
          >
            <Mic className="size-5" />
          </button>
        )}
        <button type="submit" className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-500 text-white hover:bg-brand-400" aria-label="Envoyer">
          <ArrowRight className="size-5" />
        </button>
      </form>
      <div className="flex gap-2 overflow-x-auto px-3 pt-3 pb-2 scrollbar-thin">
        {suggestions.map((s) => (
          <button key={s} onClick={() => go(s)} className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-sm text-slate-200 hover:bg-white/10">
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
