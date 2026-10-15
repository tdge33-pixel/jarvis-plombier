import { CalendarDays, ChevronLeft, FileText, Mail, MapPin, Phone, SquareCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClientActions, ClientNotes } from "@/components/clients/client-detail";
import { APPOINTMENT_TONES, Badge, QUOTE_TONES } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { JarvisOrb } from "@/components/ui/misc";
import { requireContext } from "@/lib/context";
import { APPOINTMENT_STATUS_LABELS, QUOTE_STATUS_LABELS } from "@/lib/domain/types";
import { formatShortDate, formatTimeFr, localDate, localTime } from "@/lib/dates";
import { clientAddressLine, clientDisplayName, formatEuro } from "@/lib/format";
import { getClientHistory } from "@/lib/services/clients";

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext();
  const { id } = await params;
  const h = await getClientHistory(ctx, id);
  if (!h) notFound();
  const c = h.client;
  const name = clientDisplayName(c, { withFirstName: true });
  const nowIso = new Date().toISOString();
  const lastDone = h.appointments.find((a) => a.status === "done" && a.start_at <= nowIso);

  return (
    <div className="space-y-6">
      <Link href="/clients" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ChevronLeft className="size-4" /> Mes clients
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{name}</h1>
          {clientAddressLine(c) && (
            <p className="mt-1 flex items-center gap-1.5 text-muted">
              <MapPin className="size-4" /> {c.address}
              {c.address && <br className="sm:hidden" />} {[c.postal_code, c.city].filter(Boolean).join(" ")}
            </p>
          )}
        </div>
        <ClientActions
          id={c.id}
          name={name}
          initial={{
            civility: c.civility ?? "",
            first_name: c.first_name ?? "",
            last_name: c.last_name,
            company: c.company ?? "",
            phone: c.phone ?? "",
            email: c.email ?? "",
            address: c.address ?? "",
            postal_code: c.postal_code ?? "",
            city: c.city ?? "",
            notes: c.notes ?? "",
            important_info: c.important_info ?? "",
          }}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="Coordonnées" />
          <CardBody className="space-y-3">
            {c.phone ? (
              <a href={`tel:${c.phone.replace(/\s/g, "")}`} className="flex items-center gap-2 font-medium text-brand-600">
                <Phone className="size-4" /> {c.phone}
              </a>
            ) : (
              <p className="text-muted">Pas de téléphone</p>
            )}
            {c.email && (
              <a href={`mailto:${c.email}`} className="flex items-center gap-2 text-brand-600">
                <Mail className="size-4" /> {c.email}
              </a>
            )}
            {c.important_info && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">⚑ {c.important_info}</p>}
            {c.notes && <p className="text-sm whitespace-pre-wrap text-muted">{c.notes}</p>}
            {lastDone && (
              <div className="rounded-xl bg-slate-50 p-3 text-sm">
                <p className="text-muted">Dernière intervention</p>
                <p className="font-medium">{formatShortDate(localDate(lastDone.start_at, ctx.tz))}</p>
                <p>{lastDone.intervention_type}</p>
              </div>
            )}
            <Link href={`/jarvis?q=${encodeURIComponent(`Rappelle-moi ce qu'on avait fait chez ${c.last_name}`)}`} className="flex items-center gap-2 rounded-xl border border-line p-3 text-sm font-medium hover:bg-brand-50">
              <JarvisOrb size={22} /> Demander à Jarvis
            </Link>
          </CardBody>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="Historique des interventions" icon={<CalendarDays className="size-4" />} />
            <CardBody>
              {h.appointments.length === 0 ? (
                <p className="text-muted">Aucune intervention.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {h.appointments.map((a) => (
                    <li key={a.id} className="flex items-start gap-3 py-2.5">
                      <span className="w-24 shrink-0 text-sm text-muted tabular-nums">
                        {formatShortDate(localDate(a.start_at, ctx.tz))}
                        <br />
                        {formatTimeFr(localTime(a.start_at, ctx.tz))}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{a.intervention_type}</span>
                        {a.notes && <span className="block text-sm text-muted">{a.notes}</span>}
                      </span>
                      <Badge tone={APPOINTMENT_TONES[a.status]}>{APPOINTMENT_STATUS_LABELS[a.status]}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader title="Devis" icon={<FileText className="size-4" />} />
              <CardBody>
                {h.quotes.length === 0 ? (
                  <p className="text-muted">Aucun devis.</p>
                ) : (
                  <ul className="space-y-2">
                    {h.quotes.map((q) => (
                      <li key={q.id}>
                        <Link href={`/devis/${q.id}`} className="flex items-center justify-between gap-2 hover:text-brand-600">
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{q.title}</span>
                            <span className="text-xs text-muted">
                              {q.number} · {formatEuro(q.total_ttc)}
                            </span>
                          </span>
                          <Badge tone={QUOTE_TONES[q.status]}>{QUOTE_STATUS_LABELS[q.status]}</Badge>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Tâches" icon={<SquareCheck className="size-4" />} />
              <CardBody>
                {h.tasks.length === 0 ? (
                  <p className="text-muted">Aucune tâche.</p>
                ) : (
                  <ul className="space-y-1.5 text-sm">
                    {h.tasks.map((t) => (
                      <li key={t.id} className={t.status === "done" ? "text-muted line-through" : ""}>
                        {t.title}
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </div>

          <ClientNotes clientId={c.id} notes={h.notes.map((n) => ({ id: n.id, content: n.content, date: localDate(n.created_at, ctx.tz) }))} />
        </div>
      </div>
    </div>
  );
}
