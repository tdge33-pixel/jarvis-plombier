"use client";

import { Brain, CalendarDays, Check, CircleCheck, Clock, Copy, FileText, Mail, MapPin, MessageSquare, Phone, SquareCheck, TriangleAlert, User, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { EditableField, UIBlock } from "@/core/agent/blocks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { formatDayFr, formatShortDate, formatTimeFr } from "@/lib/dates";
import { formatEuro } from "@/lib/format";
import { MemorySuggestion } from "./memory-suggestion";

type Resolve = (actionId: string, decision: "confirm" | "cancel", args?: Record<string, unknown>) => Promise<void>;

function Frame({ icon, title, children, tone = "default" }: { icon: React.ReactNode; title: React.ReactNode; children: React.ReactNode; tone?: "default" | "confirm" }) {
  return (
    <div className={`overflow-hidden rounded-2xl border bg-white shadow-card ${tone === "confirm" ? "border-brand-200 ring-4 ring-brand-50" : "border-line"}`}>
      <div className="flex items-center gap-2 border-b border-line bg-slate-50/70 px-4 py-2.5 text-sm font-semibold text-ink">
        <span className="text-brand-600">{icon}</span>
        {title}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

const statusTone = (s: string) => (s === "Confirmé" ? "blue" : s === "À confirmer" ? "amber" : s === "Terminé" ? "green" : s === "Annulé" ? "neutral" : "violet");

export function BlockView({ block, onResolve }: { block: UIBlock; onResolve: Resolve }) {
  switch (block.type) {
    case "appointments":
      return (
        <Frame icon={<CalendarDays className="size-4" />} title={block.title}>
          {block.items.length === 0 ? (
            <p className="text-muted">Aucune intervention.</p>
          ) : (
            <ul className="divide-y divide-line">
              {block.items.map((a) => (
                <li key={a.id} className="flex gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="w-16 shrink-0">
                    <p className="font-semibold tabular-nums">{formatTimeFr(a.time)}</p>
                    {block.date ? null : <p className="text-xs text-muted">{formatShortDate(a.date).slice(0, 5)}</p>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{a.client_name ?? "Sans client"}</p>
                    <p className="text-sm text-muted">{a.intervention_type}</p>
                    {a.city && (
                      <p className="flex items-center gap-1 text-sm text-muted">
                        <MapPin className="size-3.5" /> {a.address ? `${a.address}, ` : ""}
                        {a.city}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <Badge tone={statusTone(a.status)}>{a.status}</Badge>
                    {a.client_phone && (
                      <a href={`tel:${a.client_phone.replace(/\s/g, "")}`} className="flex items-center gap-1 text-xs font-medium text-brand-600">
                        <Phone className="size-3.5" /> Appeler
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Link href={block.date ? `/planning?view=day&date=${block.date}` : "/planning"} className="mt-3 inline-block text-sm font-medium text-brand-600 hover:underline">
            Ouvrir le planning →
          </Link>
        </Frame>
      );

    case "availability":
      return (
        <Frame icon={<Clock className="size-4" />} title={`Créneaux libres — ${formatDayFr(block.date)}`}>
          {block.warnings.map((w) => (
            <p key={w} className="mb-2 flex items-center gap-2 text-sm text-amber-700">
              <TriangleAlert className="size-4" /> {w}
            </p>
          ))}
          <div className="flex flex-wrap gap-2">
            {block.freeSlots.length === 0 ? <p className="text-muted">Aucun créneau libre.</p> : block.freeSlots.map((s) => <Badge key={s} tone="blue">{formatTimeFr(s)}</Badge>)}
          </div>
        </Frame>
      );

    case "clients":
      return (
        <Frame icon={<User className="size-4" />} title={block.items.length > 1 ? "Clients" : "Client"}>
          <ul className="space-y-3">
            {block.items.map((c) => (
              <li key={c.id} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/clients/${c.id}`} className="font-medium hover:text-brand-600">
                    {c.name}
                  </Link>
                  {c.address && <p className="text-sm text-muted">{c.address}</p>}
                  {c.important_info && <p className="mt-1 text-sm text-amber-800">⚑ {c.important_info}</p>}
                </div>
                <div className="flex shrink-0 gap-1">
                  {c.phone && (
                    <a href={`tel:${c.phone.replace(/\s/g, "")}`} className="grid size-9 place-items-center rounded-lg bg-brand-50 text-brand-600" aria-label={`Appeler ${c.name}`}>
                      <Phone className="size-4" />
                    </a>
                  )}
                  {c.email && (
                    <a href={`mailto:${c.email}`} className="grid size-9 place-items-center rounded-lg bg-brand-50 text-brand-600" aria-label={`Écrire à ${c.name}`}>
                      <Mail className="size-4" />
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Frame>
      );

    case "client_history":
      return (
        <Frame icon={<User className="size-4" />} title={`Historique — ${block.client.name}`}>
          <div className="space-y-4 text-sm">
            <div>
              <p className="mb-1.5 font-semibold text-muted">Interventions</p>
              {block.appointments.length === 0 ? (
                <p className="text-muted">Aucune.</p>
              ) : (
                <ul className="space-y-1.5">
                  {block.appointments.map((a, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="w-20 shrink-0 tabular-nums text-muted">{formatShortDate(a.date)}</span>
                      <span className="min-w-0 flex-1">
                        {a.intervention_type} <Badge tone={statusTone(a.status)}>{a.status}</Badge>
                        {a.notes && <span className="block text-muted">{a.notes}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {block.quotes.length > 0 && (
              <div>
                <p className="mb-1.5 font-semibold text-muted">Devis</p>
                <ul className="space-y-1">
                  {block.quotes.map((q) => (
                    <li key={q.id}>
                      <Link href={`/devis/${q.id}`} className="hover:text-brand-600">
                        {q.number} — {q.title} · {formatEuro(q.total_ttc)} · {q.status}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {block.notes.length > 0 && (
              <div>
                <p className="mb-1.5 font-semibold text-muted">Notes</p>
                <ul className="space-y-1">
                  {block.notes.map((n, i) => (
                    <li key={i}>
                      <span className="text-muted">{formatShortDate(n.date)} — </span>
                      {n.content}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <Link href={`/clients/${block.client.id}`} className="inline-block font-medium text-brand-600 hover:underline">
              Ouvrir la fiche client →
            </Link>
          </div>
        </Frame>
      );

    case "confirmation":
      return <ConfirmationCard block={block} onResolve={onResolve} />;

    case "quote":
      return (
        <Frame icon={<FileText className="size-4" />} title={`Devis ${block.number} — ${block.status}`}>
          <p className="font-medium">{block.title}</p>
          {block.client_name && <p className="text-sm text-muted">{block.client_name}</p>}
          <table className="mt-3 w-full text-sm">
            <tbody className="divide-y divide-line">
              {block.lines.map((l, i) => (
                <tr key={i}>
                  <td className="py-1.5 pr-2">{l.label}</td>
                  <td className="py-1.5 pr-2 text-right whitespace-nowrap text-muted tabular-nums">
                    {l.quantity} × {formatEuro(l.unit_price)}
                  </td>
                  <td className="py-1.5 text-right whitespace-nowrap tabular-nums">{formatEuro(l.quantity * l.unit_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 space-y-0.5 border-t border-line pt-3 text-right text-sm">
            <p className="text-muted">Total HT : {formatEuro(block.total_ht)}</p>
            <p className="text-muted">TVA {block.vat_rate} %</p>
            <p className="text-base font-semibold">Total TTC : {formatEuro(block.total_ttc)}</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={`/devis/${block.id}`} className="inline-flex h-9 items-center rounded-xl bg-brand-500 px-3 text-sm font-medium text-white hover:bg-brand-600">
              Relire et modifier
            </Link>
          </div>
        </Frame>
      );

    case "quotes":
      return (
        <Frame icon={<FileText className="size-4" />} title="Devis">
          <ul className="divide-y divide-line">
            {block.items.map((q) => (
              <li key={q.id}>
                <Link href={`/devis/${q.id}`} className="flex items-center justify-between gap-3 py-2 hover:text-brand-600">
                  <span className="min-w-0">
                    <span className="block font-medium">{q.client_name ?? q.number}</span>
                    <span className="block truncate text-sm text-muted">
                      {q.number} · {q.title}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-sm">
                    <span className="block font-semibold tabular-nums">{formatEuro(q.total_ttc)}</span>
                    <span className="text-muted">{q.status}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Frame>
      );

    case "message_draft":
      return <MessageDraft block={block} />;

    case "task":
      return (
        <Frame icon={<SquareCheck className="size-4" />} title="Tâche ajoutée">
          <p className="font-medium">{block.title}</p>
          <p className="text-sm text-muted">
            {block.due_date ? `Pour le ${formatDayFr(block.due_date)}` : "Sans échéance"}
            {block.client_name ? ` · ${block.client_name}` : ""}
          </p>
          <Link href="/taches" className="mt-2 inline-block text-sm font-medium text-brand-600 hover:underline">
            Voir mes tâches →
          </Link>
        </Frame>
      );

    case "tasks":
      return (
        <Frame icon={<SquareCheck className="size-4" />} title={block.title}>
          <ul className="space-y-1.5">
            {block.items.map((t) => (
              <li key={t.id} className="flex items-start gap-2">
                <span className={`mt-1.5 size-2 shrink-0 rounded-full ${t.priority === "high" ? "bg-amber-500" : "bg-brand-400"}`} />
                <span>
                  {t.title}
                  {t.due_date && <span className="text-sm text-muted"> · {formatShortDate(t.due_date).slice(0, 5)}</span>}
                </span>
              </li>
            ))}
          </ul>
        </Frame>
      );

    case "memory":
      return (
        <Frame icon={<Brain className="size-4" />} title="Mémorisé">
          <p>{block.content}</p>
          <p className="mt-1 text-sm text-muted">
            {block.category} · {block.section}
          </p>
          <Link href="/memoire" className="mt-2 inline-block text-sm font-medium text-brand-600 hover:underline">
            Ce que Jarvis sait de moi →
          </Link>
        </Frame>
      );

    case "memories":
      return (
        <Frame icon={<Brain className="size-4" />} title="Ce que je sais">
          <ul className="space-y-1.5">
            {block.items.map((m) => (
              <li key={m.id} className="flex items-start justify-between gap-3">
                <span>{m.content}</span>
                <Badge tone={m.category === "Règle" ? "red" : m.category === "Préférence" ? "violet" : "neutral"}>{m.category}</Badge>
              </li>
            ))}
          </ul>
        </Frame>
      );

    case "memory_suggestion":
      return <MemorySuggestion id={block.memoryId} content={block.content} evidence={block.evidence} />;
  }
}

function ConfirmationCard({ block, onResolve }: { block: Extract<UIBlock, { type: "confirmation" }>; onResolve: Resolve }) {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<Record<string, string | number>>(() => Object.fromEntries(block.fields.map((f) => [f.key, f.value])));
  const [pending, setPending] = useState(false);
  const status = block.status ?? "PENDING_CONFIRMATION";

  const act = async (decision: "confirm" | "cancel", args?: Record<string, unknown>) => {
    setPending(true);
    await onResolve(block.actionId, decision, args);
    setPending(false);
    setEditing(false);
  };

  return (
    <Frame icon={block.level === 3 ? <TriangleAlert className="size-4" /> : <CircleCheck className="size-4" />} title={block.title} tone={status === "PENDING_CONFIRMATION" ? "confirm" : "default"}>
      <ul className="space-y-1 text-[15px]">
        {block.lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      {block.warnings.length > 0 && (
        <ul className="mt-3 space-y-1 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          {block.warnings.map((w) => (
            <li key={w} className="flex gap-2">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {w}
            </li>
          ))}
        </ul>
      )}

      {status === "PENDING_CONFIRMATION" ? (
        editing ? (
          <form
            className="mt-4 grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              void act("confirm", values);
            }}
          >
            {block.fields.map((f) => (
              <EditField key={f.key} field={f} value={values[f.key] ?? ""} onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))} />
            ))}
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" disabled={pending}>
                <Check className="size-4" /> Valider les modifications
              </Button>
              <Button variant="ghost" onClick={() => setEditing(false)}>
                Retour
              </Button>
            </div>
          </form>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => act("confirm")} disabled={pending} variant={block.level === 3 ? "success" : "primary"}>
              <Check className="size-4" /> Confirmer
            </Button>
            {block.fields.length > 0 && (
              <Button variant="secondary" onClick={() => setEditing(true)} disabled={pending}>
                Modifier
              </Button>
            )}
            <Button variant="ghost" onClick={() => act("cancel")} disabled={pending}>
              <X className="size-4" /> Annuler
            </Button>
          </div>
        )
      ) : (
        <p className={`mt-3 text-sm font-medium ${status === "EXECUTED" ? "text-emerald-700" : status === "FAILED" ? "text-red-600" : "text-muted"}`}>
          {status === "EXECUTED" ? "✓ Confirmé et réalisé" : status === "CANCELLED" ? "Annulé" : status === "FAILED" ? "Échec de l'action" : "Confirmé"}
        </p>
      )}
    </Frame>
  );
}

function EditField({ field, value, onChange }: { field: EditableField; value: string | number; onChange: (v: string) => void }) {
  if (field.type === "textarea") {
    return (
      <Field label={field.label} className="sm:col-span-2">
        <Textarea value={String(value)} onChange={(e) => onChange(e.target.value)} rows={2} />
      </Field>
    );
  }
  return (
    <Field label={field.label}>
      <Input type={field.type} value={String(value)} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

function MessageDraft({ block }: { block: Extract<UIBlock, { type: "message_draft" }> }) {
  const [body, setBody] = useState(block.body);
  const [copied, setCopied] = useState(false);
  const phone = block.phone?.replace(/\s/g, "");
  return (
    <Frame icon={block.channel === "sms" ? <MessageSquare className="size-4" /> : <Mail className="size-4" />} title={`Brouillon de ${block.channel === "sms" ? "SMS" : "email"}${block.recipient ? ` — ${block.recipient}` : ""}`}>
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={Math.min(8, body.split("\n").length + 1)} className="bg-slate-50" />
      <p className="mt-2 text-xs text-muted">Non envoyé. Vous pouvez modifier le texte avant de l&apos;envoyer vous-même.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={async () => {
            await navigator.clipboard.writeText(body);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          <Copy className="size-4" /> {copied ? "Copié !" : "Copier"}
        </Button>
        {block.channel === "sms" && phone && (
          <a href={`sms:${phone}?&body=${encodeURIComponent(body)}`} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand-500 px-3 text-sm font-medium text-white hover:bg-brand-600">
            <MessageSquare className="size-4" /> Ouvrir dans mes SMS
          </a>
        )}
        {block.channel === "email" && block.email && (
          <a href={`mailto:${block.email}?subject=${encodeURIComponent(block.subject ?? "")}&body=${encodeURIComponent(body)}`} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand-500 px-3 text-sm font-medium text-white hover:bg-brand-600">
            <Mail className="size-4" /> Ouvrir dans ma messagerie
          </a>
        )}
      </div>
    </Frame>
  );
}
