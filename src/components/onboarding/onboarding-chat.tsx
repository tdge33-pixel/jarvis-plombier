"use client";

import { ArrowRight, Check } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { completeOnboardingAction } from "@/app/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { JarvisOrb } from "@/components/ui/misc";
import { cn } from "@/lib/format";
import { getVertical } from "@/verticals";
import type { OnboardingQuestion } from "@/verticals/types";

type Answers = Record<string, unknown>;

function display(q: OnboardingQuestion, v: unknown): string {
  if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) return "Passer";
  if (q.type === "yesno") return v ? "Oui" : "Non";
  if (q.type === "hours") {
    const h = v as { start: string; end: string };
    return `De ${h.start.replace(":", "h")} à ${h.end.replace(":", "h")}`;
  }
  if (Array.isArray(v)) return v.join(", ");
  if (q.key === "hourly_rate" || q.key === "travel_fee") return `${v} €`;
  if (q.key === "zone_radius_km") return `${v} km`;
  return String(v);
}

/** Onboarding conversationnel : une question à la fois, pas un formulaire de 40 champs. */
export function OnboardingChat({ firstName }: { firstName: string }) {
  const questions = getVertical("plombier").onboarding;
  const [started, setStarted] = useState(false);
  const [answers, setAnswers] = useState<Answers>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  // Questions applicables compte tenu des réponses déjà données.
  const flow = useMemo(() => questions.filter((q) => !q.when || q.when(answers)), [questions, answers]);
  const answeredKeys = flow.filter((q) => q.key in answers);
  const current = flow.find((q) => !(q.key in answers));
  const progress = Math.round((answeredKeys.length / flow.length) * 100);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [answers, started]);

  const answer = (q: OnboardingQuestion, v: unknown) => setAnswers((a) => ({ ...a, [q.key]: v }));
  const undo = () => {
    const last = answeredKeys[answeredKeys.length - 1];
    if (last) setAnswers(({ [last.key]: _removed, ...rest }) => rest);
  };

  return (
    <div className="flex min-h-dvh flex-col bg-[radial-gradient(100%_50%_at_50%_0%,#e6eeff_0%,#f4f6fb_70%)]">
      <header className="sticky top-0 z-10 border-b border-line bg-white/80 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <JarvisOrb size={32} />
          <div className="flex-1">
            <p className="text-sm font-semibold">Faisons connaissance</p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${started ? progress : 0}%` }} />
            </div>
          </div>
          {started && answeredKeys.length > 0 && current && (
            <button onClick={undo} className="text-sm text-muted hover:text-ink">
              Retour
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 px-4 py-8">
        <Bubble>
          Bonjour {firstName}.<br />
          Je vais apprendre comment fonctionne votre entreprise afin de pouvoir réellement vous aider.
          <br />
          <br />
          Cela prendra environ 5 minutes.
        </Bubble>
        {!started && (
          <div className="flex justify-end">
            <Button size="lg" onClick={() => setStarted(true)}>
              C&apos;est parti <ArrowRight className="size-4" />
            </Button>
          </div>
        )}

        {started &&
          answeredKeys.map((q) => (
            <div key={q.key} className="space-y-3">
              <Bubble>{q.question}</Bubble>
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl rounded-br-md bg-brand-500 px-4 py-2.5 text-white">{display(q, answers[q.key])}</div>
              </div>
            </div>
          ))}

        {started && current && (
          <div className="space-y-3 animate-fade-up">
            <Bubble>
              {current.question}
              {current.help && <span className="mt-1 block text-sm text-muted">{current.help}</span>}
            </Bubble>
            <AnswerInput key={current.key} q={current} onAnswer={(v) => answer(current, v)} />
          </div>
        )}

        {started && !current && (
          <div className="space-y-3 animate-fade-up">
            <Bubble>
              Merci, j&apos;ai tout noté ! 🎉
              <br />
              Vous pourrez retrouver et modifier tout ce que je sais de vous dans la page « Mémoire ».
            </Bubble>
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <div className="flex justify-end">
              <Button
                size="lg"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await completeOnboardingAction(answers);
                    if (res?.error) setError(res.error);
                  })
                }
              >
                {pending ? "Je prépare votre espace…" : "Découvrir Jarvis"} <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </main>
    </div>
  );
}

function Bubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <JarvisOrb size={30} className="mt-1" />
      <div className="max-w-[85%] rounded-2xl rounded-tl-md border border-line bg-white px-4 py-3 text-[15px] leading-relaxed shadow-card">{children}</div>
    </div>
  );
}

function AnswerInput({ q, onAnswer }: { q: OnboardingQuestion; onAnswer: (v: unknown) => void }) {
  const [text, setText] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [hours, setHours] = useState({ start: "08:00", end: "18:00" });

  const skip = q.optional && (
    <Button variant="ghost" onClick={() => onAnswer("")}>
      Passer
    </Button>
  );

  if (q.type === "yesno") {
    return (
      <div className="flex justify-end gap-2">
        <Button size="lg" variant="secondary" onClick={() => onAnswer(false)}>
          Non
        </Button>
        <Button size="lg" onClick={() => onAnswer(true)}>
          Oui
        </Button>
      </div>
    );
  }

  if (q.type === "hours") {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="text-sm text-muted">De</span>
        <Input type="time" value={hours.start} onChange={(e) => setHours((h) => ({ ...h, start: e.target.value }))} className="w-32" />
        <span className="text-sm text-muted">à</span>
        <Input type="time" value={hours.end} onChange={(e) => setHours((h) => ({ ...h, end: e.target.value }))} className="w-32" />
        <Button onClick={() => onAnswer(hours)}>
          <Check className="size-4" /> Valider
        </Button>
      </div>
    );
  }

  if (q.type === "choices" && q.choices) {
    if (!q.multiple) {
      return (
        <div className="flex flex-wrap justify-end gap-2">
          {q.choices.map((c) => (
            <Button key={c} variant="secondary" onClick={() => onAnswer(c)}>
              {c}
            </Button>
          ))}
        </div>
      );
    }
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap justify-end gap-2">
          {q.choices.map((c) => {
            const on = selected.includes(c);
            return (
              <button
                key={c}
                onClick={() => setSelected((s) => (on ? s.filter((x) => x !== c) : [...s, c]))}
                className={cn("h-10 rounded-full border px-4 text-sm font-medium transition", on ? "border-brand-500 bg-brand-500 text-white" : "border-line bg-white hover:border-brand-200")}
                aria-pressed={on}
              >
                {c}
              </button>
            );
          })}
        </div>
        <div className="flex justify-end gap-2">
          {skip}
          <Button onClick={() => onAnswer(selected)} disabled={selected.length === 0}>
            <Check className="size-4" /> Valider
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="flex justify-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim() && !q.optional) return;
        onAnswer(q.type === "number" ? Number(text.replace(",", ".")) || text : text.trim());
      }}
    >
      <Input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={q.placeholder}
        inputMode={q.type === "number" ? "decimal" : undefined}
        className="max-w-sm"
      />
      {skip}
      <Button type="submit" disabled={!text.trim()}>
        <ArrowRight className="size-4" />
      </Button>
    </form>
  );
}
