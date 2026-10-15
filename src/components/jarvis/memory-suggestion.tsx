"use client";

import { Lightbulb } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { answerSuggestionAction } from "@/app/(app)/memoire/actions";

/** « J'ai remarqué que… Souhaitez-vous que je retienne cette préférence ? » */
export function MemorySuggestion({ id, content, evidence, compact }: { id: string; content: string; evidence: string | null; compact?: boolean }) {
  const [pending, start] = useTransition();
  const [answered, setAnswered] = useState<null | "yes" | "no" | "later">(null);

  const answer = (a: "yes" | "no" | "later") =>
    start(async () => {
      await answerSuggestionAction(id, a);
      setAnswered(a);
    });

  if (answered) {
    return (
      <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-muted">
        {answered === "yes" ? "✓ Préférence enregistrée dans « Ce que Jarvis sait de moi »." : answered === "no" ? "Entendu, je ne retiens pas cette préférence." : "D'accord, je vous redemanderai plus tard."}
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-violet-200 bg-violet-50/60 ${compact ? "p-3" : "p-4"}`}>
      <div className="flex gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-violet-100 text-violet-700">
          <Lightbulb className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="font-medium">J&apos;ai remarqué que : « {content} »</p>
          {evidence && <p className="mt-0.5 text-sm text-muted">{evidence}</p>}
          <p className="mt-2 text-sm">Souhaitez-vous que je retienne cette préférence ?</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => answer("yes")} disabled={pending}>
              Oui, retenir
            </Button>
            <Button size="sm" variant="secondary" onClick={() => answer("no")} disabled={pending}>
              Non
            </Button>
            <Button size="sm" variant="ghost" onClick={() => answer("later")} disabled={pending}>
              Pas maintenant
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
