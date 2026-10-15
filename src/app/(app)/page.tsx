import { ArrowRight, CalendarDays, FileText, MapPin, Phone, Sparkles, SquareCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { AskBox } from "@/components/jarvis/ask-box";
import { MemorySuggestion } from "@/components/jarvis/memory-suggestion";
import { APPOINTMENT_TONES, Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { computeInsights } from "@/core/insights/engine";
import { requireContext } from "@/lib/context";
import { APPOINTMENT_STATUS_LABELS } from "@/lib/domain/types";
import { formatDayFr, formatTimeFr, today } from "@/lib/dates";
import { formatEuro } from "@/lib/format";
import { listDay } from "@/lib/services/appointments";
import { detectInferredPreferences, pendingSuggestions } from "@/lib/services/memories";
import { listQuotes } from "@/lib/services/quotes";
import { getTaskGroups } from "@/lib/services/tasks";
import { getVertical } from "@/verticals";

export const metadata = { title: "Accueil" };

function greeting(tz: string): string {
  const h = Number(new Intl.DateTimeFormat("fr-FR", { hour: "numeric", hourCycle: "h23", timeZone: tz }).format(new Date()));
  return h >= 18 ? "Bonsoir" : "Bonjour";
}

export default async function HomePage() {
  const ctx = await requireContext();
  await detectInferredPreferences(ctx);
  const t = today(ctx.tz);
  const [appointments, groups, quotes, insights, suggestions] = await Promise.all([
    listDay(ctx, t),
    getTaskGroups(ctx),
    listQuotes(ctx, "sent"),
    computeInsights(ctx),
    pendingSuggestions(ctx),
  ]);
  const vertical = getVertical(ctx.business.vertical);
  const important = [...groups.overdue, ...groups.today].slice(0, 5);
  const callBacks = [...groups.overdue, ...groups.today, ...groups.upcoming].filter((task) => /rappel|appeler|relancer|téléphon/i.test(task.title)).slice(0, 4);

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm font-medium tracking-wide text-muted first-letter:uppercase">{formatDayFr(t, { withYear: true })}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
          {greeting(ctx.tz)} {ctx.profile.first_name}
        </h1>
        <p className="mt-2 text-lg text-muted">Que puis-je faire pour vous aujourd&apos;hui ?</p>
        <div className="mt-5">
          <AskBox suggestions={vertical.examplePrompts.slice(0, 4)} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[13px] font-semibold tracking-wider text-muted uppercase">Aujourd&apos;hui</h2>
        <div className="grid gap-4 md:grid-cols-2 [&>*]:min-w-0">
          <Card>
            <CardHeader title="Interventions prévues" icon={<CalendarDays className="size-4" />} action={<Link href="/planning" className="text-sm font-medium text-brand-600 hover:underline">Planning</Link>} />
            <CardBody>
              {appointments.length === 0 ? (
                <p className="text-muted">Aucune intervention aujourd&apos;hui.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {appointments.map((a) => (
                    <li key={a.id} className="flex items-start gap-3 py-2.5">
                      <span className="w-14 shrink-0 pt-0.5 font-semibold tabular-nums">{formatTimeFr(a.time)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{a.client_name ?? "Sans client"}</span>
                        <span className="block truncate text-sm text-muted">
                          {a.intervention_type}
                          {a.city && (
                            <>
                              {" · "}
                              <MapPin className="inline size-3.5" /> {a.city}
                            </>
                          )}
                        </span>
                      </span>
                      <Badge tone={APPOINTMENT_TONES[a.status]}>{APPOINTMENT_STATUS_LABELS[a.status]}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Tâches importantes" icon={<SquareCheck className="size-4" />} action={<Link href="/taches" className="text-sm font-medium text-brand-600 hover:underline">Tout voir</Link>} />
            <CardBody>
              {important.length === 0 ? (
                <p className="text-muted">Rien d&apos;urgent. 👍</p>
              ) : (
                <ul className="space-y-2">
                  {important.map((task) => (
                    <li key={task.id} className="flex items-start gap-2.5">
                      <span className={`mt-1.5 size-2 shrink-0 rounded-full ${task.due_date && task.due_date < t ? "bg-red-500" : task.priority === "high" ? "bg-amber-500" : "bg-brand-400"}`} />
                      <span className="min-w-0">
                        <span className="block">{task.title}</span>
                        {task.due_date && task.due_date < t && <span className="text-xs font-medium text-red-600">En retard</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Clients à rappeler" icon={<Phone className="size-4" />} />
            <CardBody>
              {callBacks.length === 0 ? (
                <p className="text-muted">Personne à rappeler pour l&apos;instant.</p>
              ) : (
                <ul className="space-y-2">
                  {callBacks.map((task) => (
                    <li key={task.id} className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate">{task.client_name ?? task.title}</span>
                      <span className="shrink-0 text-xs text-muted">{task.title.length > 40 ? `${task.title.slice(0, 40)}…` : task.title}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Devis en attente" icon={<FileText className="size-4" />} action={<Link href="/devis" className="text-sm font-medium text-brand-600 hover:underline">Devis</Link>} />
            <CardBody>
              {quotes.length === 0 ? (
                <p className="text-muted">Aucun devis en attente de réponse.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {quotes.slice(0, 4).map((q) => (
                    <li key={q.id}>
                      <Link href={`/devis/${q.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:text-brand-600">
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{q.client_name ?? q.number}</span>
                          <span className="block truncate text-sm text-muted">{q.title}</span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block font-semibold tabular-nums">{formatEuro(q.total_ttc)}</span>
                          {q.days_since_sent !== null && <span className={`text-xs ${q.days_since_sent >= 10 ? "font-medium text-amber-700" : "text-muted"}`}>il y a {q.days_since_sent} j</span>}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-[13px] font-semibold tracking-wider text-muted uppercase">
          <Sparkles className="size-4 text-brand-500" /> Jarvis a remarqué
        </h2>
        <Card className="overflow-hidden">
          <div className="divide-y divide-line">
            {suggestions.map((m) => (
              <div key={m.id} className="p-4">
                <MemorySuggestion id={m.id} content={m.content} evidence={m.evidence} compact />
              </div>
            ))}
            {insights.length === 0 && suggestions.length === 0 && <p className="p-5 text-muted">Rien de particulier pour le moment. Je vous préviendrai si quelque chose mérite votre attention.</p>}
            {insights.map((i) => {
              const href = i.prompt ? `/jarvis?q=${encodeURIComponent(i.prompt)}` : i.href;
              const content = (
                <>
                  <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${i.severity === "warning" ? "bg-amber-50 text-amber-600" : "bg-brand-50 text-brand-600"}`}>
                    {i.severity === "warning" ? <TriangleAlert className="size-4.5" /> : <Sparkles className="size-4.5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{i.title}</span>
                    {i.detail && <span className="block text-sm text-muted">{i.detail}</span>}
                  </span>
                  {href && (
                    <span className="hidden shrink-0 items-center gap-1 text-sm font-medium text-brand-600 sm:flex">
                      {i.prompt ? "Demander à Jarvis" : "Voir"} <ArrowRight className="size-4" />
                    </span>
                  )}
                </>
              );
              return href ? (
                <Link key={i.id} href={href} className="flex items-center gap-3 px-5 py-4 hover:bg-slate-50">
                  {content}
                </Link>
              ) : (
                <div key={i.id} className="flex items-center gap-3 px-5 py-4">
                  {content}
                </div>
              );
            })}
          </div>
        </Card>
      </section>
    </div>
  );
}
