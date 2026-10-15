"use client";

import { Brain, Building2, Check, Clock, Euro, Heart, Pencil, Plus, Scale, Trash2, Truck, X } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { addMemoryAction, deleteMemoryAction, toggleMemoryAction, updateMemoryAction } from "@/app/(app)/memoire/actions";
import { MemorySuggestion } from "@/components/jarvis/memory-suggestion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/misc";
import { MEMORY_CATEGORY_LABELS, MEMORY_SECTION_LABELS, MEMORY_SECTIONS, type MemoryCategory, type MemorySection } from "@/lib/domain/types";
import { cn } from "@/lib/format";

interface MemoryRow {
  id: string;
  content: string;
  category: MemoryCategory;
  section: MemorySection;
  status: string;
  source: string;
  personal: boolean;
}

const SECTION_ICONS: Record<MemorySection, React.ReactNode> = {
  business: <Building2 className="size-4" />,
  preferences: <Heart className="size-4" />,
  rules: <Scale className="size-4" />,
  suppliers: <Truck className="size-4" />,
  pricing: <Euro className="size-4" />,
  habits: <Clock className="size-4" />,
};

const EDITABLE_CATEGORIES: Array<Exclude<MemoryCategory, "INFERRED">> = ["RULE", "PREFERENCE", "FACT", "BUSINESS_INFO", "CLIENT_INFO", "TEMPORARY"];

const categoryTone = (c: MemoryCategory) => (c === "RULE" ? "red" : c === "PREFERENCE" ? "violet" : c === "TEMPORARY" ? "amber" : c === "INFERRED" ? "violet" : "neutral");
const sourceLabel = (s: string) => (s === "onboarding" ? "appris à l'inscription" : s === "jarvis" ? "remarqué par Jarvis" : "ajouté par vous");

export function MemoryManager({ memories, suggestions, facts }: { memories: MemoryRow[]; suggestions: Array<{ id: string; content: string; evidence: string | null }>; facts: Partial<Record<MemorySection, string[]>> }) {
  const [adding, setAdding] = useState(false);
  return (
    <div>
      <PageHeader
        title="Ce que Jarvis sait de moi"
        subtitle="Plus vous utilisez Jarvis, plus il apprend comment vous travaillez. Vous gardez la main : modifiez, désactivez ou supprimez ce que vous voulez."
        actions={
          <Button onClick={() => setAdding((v) => !v)}>
            <Plus className="size-4" /> Ajouter
          </Button>
        }
      />

      {adding && <AddForm onDone={() => setAdding(false)} />}

      {suggestions.length > 0 && (
        <section className="mb-6 space-y-3">
          <h2 className="text-[13px] font-semibold tracking-wider text-muted uppercase">À valider</h2>
          {suggestions.map((s) => (
            <MemorySuggestion key={s.id} id={s.id} content={s.content} evidence={s.evidence} />
          ))}
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {MEMORY_SECTIONS.map((section) => {
          const items = memories.filter((m) => m.section === section);
          const sectionFacts = facts[section] ?? [];
          return (
            <Card key={section}>
              <div className="flex items-center gap-2.5 px-5 pt-5 pb-3">
                <span className="grid size-8 place-items-center rounded-lg bg-brand-50 text-brand-600">{SECTION_ICONS[section]}</span>
                <h2 className="text-[13px] font-semibold tracking-wider text-muted uppercase">{MEMORY_SECTION_LABELS[section]}</h2>
              </div>
              <div className="px-5 pb-5">
                {sectionFacts.length > 0 && (
                  <div className="mb-3 rounded-xl bg-slate-50 p-3 text-sm">
                    {sectionFacts.map((f) => (
                      <p key={f}>{f}</p>
                    ))}
                    <Link href="/parametres" className="mt-1 inline-block text-xs font-medium text-brand-600 hover:underline">
                      Modifier dans Paramètres
                    </Link>
                  </div>
                )}
                {items.length === 0 && sectionFacts.length === 0 ? (
                  <p className="text-sm text-muted">Rien pour l&apos;instant.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {items.map((m) => (
                      <MemoryItem key={m.id} m={m} />
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          );
        })}
      </div>
      <p className="mt-6 flex items-center gap-2 text-sm text-muted">
        <Brain className="size-4" /> Jarvis ne transforme jamais une simple habitude en règle sans votre accord.
      </p>
    </div>
  );
}

function MemoryItem({ m }: { m: MemoryRow }) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(m.content);
  const [category, setCategory] = useState<MemoryCategory>(m.category);
  const [pending, start] = useTransition();
  const disabled = m.status === "disabled";

  if (editing) {
    return (
      <li className="space-y-2 py-3">
        <Input value={content} onChange={(e) => setContent(e.target.value)} autoFocus />
        <div className="flex flex-wrap items-center gap-2">
          <Select value={category} onChange={(e) => setCategory(e.target.value as MemoryCategory)} className="h-9 w-auto text-sm">
            {EDITABLE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {MEMORY_CATEGORY_LABELS[c]}
              </option>
            ))}
          </Select>
          <Button size="sm" disabled={pending} onClick={() => start(async () => {
            await updateMemoryAction(m.id, { content, category });
            setEditing(false);
          })}>
            <Check className="size-4" /> Enregistrer
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            <X className="size-4" /> Annuler
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className={cn("flex items-start gap-3 py-2.5", disabled && "opacity-50")}>
      <div className="min-w-0 flex-1">
        <p className={cn(disabled && "line-through")}>{m.content}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
          <Badge tone={categoryTone(m.category)}>{MEMORY_CATEGORY_LABELS[m.category]}</Badge>
          {m.personal && <Badge tone="blue">Personnel</Badge>}
          <span>{sourceLabel(m.source)}</span>
          {disabled && <span>· désactivé</span>}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          onClick={() => start(() => toggleMemoryAction(m.id, disabled))}
          disabled={pending}
          className={cn("relative h-6 w-10 rounded-full transition-colors", disabled ? "bg-slate-300" : "bg-brand-500")}
          role="switch"
          aria-checked={!disabled}
          aria-label={disabled ? "Activer" : "Désactiver"}
          title={disabled ? "Activer" : "Désactiver"}
        >
          <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform", disabled ? "translate-x-0.5" : "translate-x-4.5")} />
        </button>
        <button onClick={() => setEditing(true)} className="grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-ink" aria-label="Modifier">
          <Pencil className="size-4" />
        </button>
        <button
          onClick={() => confirm("Supprimer cette information ?") && start(() => deleteMemoryAction(m.id))}
          className="grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
          aria-label="Supprimer"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </li>
  );
}

function AddForm({ onDone }: { onDone: () => void }) {
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<Exclude<MemoryCategory, "INFERRED">>("PREFERENCE");
  const [section, setSection] = useState<MemorySection | "">("");
  const [personal, setPersonal] = useState(false);
  const [pending, start] = useTransition();
  return (
    <Card className="mb-6 p-5">
      <form
        className="grid gap-4 md:grid-cols-6"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            await addMemoryAction({ content, category, section: section || undefined, personal });
            setContent("");
            onDone();
          });
        }}
      >
        <Field label="Ce que Jarvis doit retenir" className="md:col-span-6">
          <Input value={content} onChange={(e) => setContent(e.target.value)} placeholder="Ex : Je ne travaille pas le samedi après-midi." required minLength={3} autoFocus />
        </Field>
        <Field label="Type" className="md:col-span-2">
          <Select value={category} onChange={(e) => setCategory(e.target.value as Exclude<MemoryCategory, "INFERRED">)}>
            {EDITABLE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {MEMORY_CATEGORY_LABELS[c]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Rubrique" className="md:col-span-2">
          <Select value={section} onChange={(e) => setSection(e.target.value as MemorySection | "")}>
            <option value="">Automatique</option>
            {MEMORY_SECTIONS.map((s) => (
              <option key={s} value={s}>
                {MEMORY_SECTION_LABELS[s]}
              </option>
            ))}
          </Select>
        </Field>
        <label className="flex items-center gap-2 self-end pb-3 text-sm md:col-span-2">
          <input type="checkbox" checked={personal} onChange={(e) => setPersonal(e.target.checked)} className="size-4 accent-brand-500" />
          Préférence personnelle
        </label>
        <div className="flex justify-end gap-2 md:col-span-6">
          <Button variant="ghost" onClick={onDone}>
            Annuler
          </Button>
          <Button type="submit" disabled={pending}>
            Enregistrer
          </Button>
        </div>
      </form>
    </Card>
  );
}
