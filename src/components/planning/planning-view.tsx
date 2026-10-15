"use client";

import { CalendarDays, ChevronLeft, ChevronRight, List, MapPin, Phone, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { APPOINTMENT_TONES, Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { APPOINTMENT_STATUS_LABELS } from "@/lib/domain/types";
import { addDays, formatDayFr, formatDurationFr, formatTimeFr, startOfWeek, timeToMinutes } from "@/lib/dates";
import { cn } from "@/lib/format";
import type { AppointmentView } from "@/lib/services/appointments";
import { AppointmentFormModal, type AppointmentDraft, type ClientOption } from "./appointment-form";

type View = "day" | "week" | "list";

interface Props {
  view: View;
  date: string;
  today: string;
  appointments: AppointmentView[];
  settings: { work_start: string; work_end: string; max: number };
  clients: ClientOption[];
  interventionTypes: Array<{ label: string; defaultDurationMinutes: number }>;
}

const HOUR_HEIGHT = 64;

export function PlanningView({ view, date, today, appointments, settings, clients, interventionTypes }: Props) {
  const [draft, setDraft] = useState<AppointmentDraft | null>(null);

  const openNew = (d = date, time = "09:00") =>
    setDraft({ id: null, client_id: null, date: d, time, duration_minutes: 60, intervention_type: "", address: null, city: null, status: "confirmed", notes: null });
  const openEdit = (a: AppointmentView) =>
    setDraft({ id: a.id, client_id: a.client_id, date: a.date, time: a.time, duration_minutes: a.duration_minutes, intervention_type: a.intervention_type, address: a.address, city: a.city, status: a.status, notes: a.notes });

  const step = view === "week" ? 7 : 1;
  const href = (v: View, d: string) => `/planning?view=${v}&date=${d}`;
  const title =
    view === "week"
      ? `Semaine du ${formatDayFr(startOfWeek(date))}`
      : view === "list"
        ? "Prochains rendez-vous"
        : date === today
          ? `Aujourd'hui — ${formatDayFr(date)}`
          : formatDayFr(date, { withYear: true });

  return (
    <div>
      <PageHeader
        title="Planning"
        subtitle="Mes interventions"
        actions={
          <Button onClick={() => openNew()}>
            <Plus className="size-4" /> Nouveau rendez-vous
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-line bg-white p-1">
          {(
            [
              ["day", "Jour", CalendarDays],
              ["week", "Semaine", CalendarDays],
              ["list", "Liste", List],
            ] as const
          ).map(([v, label, Icon]) => (
            <Link key={v} href={href(v, date)} className={cn("flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium", view === v ? "bg-night text-white" : "text-muted hover:text-ink")}>
              <Icon className="size-4" /> {label}
            </Link>
          ))}
        </div>
        {view !== "list" && (
          <div className="flex items-center gap-2">
            <Link href={href(view, addDays(date, -step))} className="grid size-10 place-items-center rounded-xl border border-line bg-white hover:bg-slate-50" aria-label="Précédent">
              <ChevronLeft className="size-5" />
            </Link>
            <Link href={href(view, today)} className="flex h-10 items-center rounded-xl border border-line bg-white px-3 text-sm font-medium hover:bg-slate-50">
              Aujourd&apos;hui
            </Link>
            <Link href={href(view, addDays(date, step))} className="grid size-10 place-items-center rounded-xl border border-line bg-white hover:bg-slate-50" aria-label="Suivant">
              <ChevronRight className="size-5" />
            </Link>
          </div>
        )}
      </div>

      <h2 className="mb-3 text-lg font-semibold first-letter:uppercase">{title}</h2>

      {view === "day" && <DayView date={date} appointments={appointments} settings={settings} onEdit={openEdit} onNew={openNew} />}
      {view === "week" && <WeekView date={date} today={today} appointments={appointments} onEdit={openEdit} onNew={openNew} />}
      {view === "list" && <ListView appointments={appointments} onEdit={openEdit} />}

      <AppointmentFormModal draft={draft} clients={clients} interventionTypes={interventionTypes} onClose={() => setDraft(null)} />
    </div>
  );
}

function AppointmentChip({ a, onEdit, compact, fill }: { a: AppointmentView; onEdit: (a: AppointmentView) => void; compact?: boolean; fill?: boolean }) {
  const cancelled = a.status === "cancelled";
  return (
    <button
      onClick={() => onEdit(a)}
      className={cn(
        "w-full overflow-hidden rounded-xl border-l-4 bg-white p-2.5 text-left shadow-card transition hover:shadow-md",
        fill && "h-full",
        cancelled ? "border-slate-300 opacity-60" : a.status === "to_confirm" ? "border-amber-400" : a.status === "done" ? "border-emerald-500" : "border-brand-500",
      )}
    >
      <p className={cn("text-sm font-semibold", cancelled && "line-through")}>
        {formatTimeFr(a.time)} · {a.client_name ?? "Sans client"}
      </p>
      <p className="truncate text-sm text-muted">{a.intervention_type}</p>
      {!compact && a.city && (
        <p className="flex items-center gap-1 truncate text-xs text-muted">
          <MapPin className="size-3" /> {a.city}
        </p>
      )}
    </button>
  );
}

function DayView({ date, appointments, settings, onEdit, onNew }: { date: string; appointments: AppointmentView[]; settings: Props["settings"]; onEdit: (a: AppointmentView) => void; onNew: (d?: string, t?: string) => void }) {
  const startHour = Math.min(7, Math.floor(timeToMinutes(settings.work_start) / 60));
  const endHour = Math.max(20, Math.ceil(timeToMinutes(settings.work_end) / 60));
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const active = appointments.filter((a) => a.status !== "cancelled");

  return (
    <Card className="overflow-hidden">
      {active.length > settings.max && <p className="bg-amber-50 px-4 py-2 text-sm text-amber-900">{active.length} interventions : au-delà de votre limite de {settings.max} par jour.</p>}
      <div className="relative" style={{ height: hours.length * HOUR_HEIGHT }}>
        {hours.map((h, i) => {
          const inHours = h * 60 >= timeToMinutes(settings.work_start) && h * 60 < timeToMinutes(settings.work_end);
          return (
            <button
              key={h}
              onClick={() => onNew(date, `${String(h).padStart(2, "0")}:00`)}
              className={cn("absolute inset-x-0 flex border-t border-line text-left hover:bg-brand-50/40", !inHours && "bg-slate-50/80")}
              style={{ top: i * HOUR_HEIGHT, height: HOUR_HEIGHT }}
              aria-label={`Ajouter un rendez-vous à ${h}h`}
            >
              <span className="w-16 shrink-0 pt-1 pl-3 text-xs font-medium text-muted tabular-nums">{h}h00</span>
            </button>
          );
        })}
        {appointments.map((a) => {
          const top = ((timeToMinutes(a.time) - startHour * 60) / 60) * HOUR_HEIGHT;
          const height = Math.max((a.duration_minutes / 60) * HOUR_HEIGHT - 4, 44);
          return (
            <div key={a.id} className="absolute right-3 left-16 sm:right-6" style={{ top: top + 2, height }}>
              <AppointmentChip a={a} onEdit={onEdit} compact={height < 70} fill />
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function WeekView({ date, today, appointments, onEdit, onNew }: { date: string; today: string; appointments: AppointmentView[]; onEdit: (a: AppointmentView) => void; onNew: (d?: string, t?: string) => void }) {
  const monday = startOfWeek(date);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  return (
    <div className="grid gap-3 md:grid-cols-7">
      {days.map((d) => {
        const items = appointments.filter((a) => a.date === d);
        const [wd, num] = formatDayFr(d).split(" ");
        return (
          <div key={d} className={cn("flex min-h-40 min-w-0 flex-col rounded-2xl border bg-white p-2", d === today ? "border-brand-300 ring-4 ring-brand-50" : "border-line")}>
            <Link href={`/planning?view=day&date=${d}`} className="mb-2 flex items-baseline gap-1.5 px-1 hover:text-brand-600">
              <span className="text-xs font-semibold text-muted uppercase">{wd?.slice(0, 3)}</span>
              <span className="text-lg font-semibold">{num}</span>
              {items.length > 0 && <span className="ml-auto text-xs text-muted">{items.filter((a) => a.status !== "cancelled").length}</span>}
            </Link>
            <div className="flex-1 space-y-1.5">
              {items.map((a) => (
                <AppointmentChip key={a.id} a={a} onEdit={onEdit} compact />
              ))}
            </div>
            <button onClick={() => onNew(d)} className="mt-2 flex h-8 items-center justify-center gap-1 rounded-lg text-xs text-muted hover:bg-slate-50 hover:text-brand-600">
              <Plus className="size-3.5" /> Ajouter
            </button>
          </div>
        );
      })}
    </div>
  );
}

function ListView({ appointments, onEdit }: { appointments: AppointmentView[]; onEdit: (a: AppointmentView) => void }) {
  if (appointments.length === 0) return <EmptyState icon={<CalendarDays className="size-6" />} title="Aucun rendez-vous à venir" text="Ajoutez-en un ou demandez à Jarvis." />;
  const byDate = new Map<string, AppointmentView[]>();
  for (const a of appointments) byDate.set(a.date, [...(byDate.get(a.date) ?? []), a]);
  return (
    <div className="space-y-5">
      {[...byDate.entries()].map(([d, items]) => (
        <section key={d}>
          <h3 className="mb-2 text-sm font-semibold text-muted first-letter:uppercase">{formatDayFr(d)}</h3>
          <Card className="divide-y divide-line">
            {items.map((a) => (
              <div
                key={a.id}
                role="button"
                tabIndex={0}
                onClick={() => onEdit(a)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onEdit(a)}
                className="flex w-full cursor-pointer items-center gap-4 px-4 py-3 text-left hover:bg-slate-50"
              >
                <span className="w-14 shrink-0 font-semibold tabular-nums">{formatTimeFr(a.time)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{a.client_name ?? "Sans client"}</span>
                  <span className="block truncate text-sm text-muted">
                    {a.intervention_type} · {formatDurationFr(a.duration_minutes)}
                    {a.city ? ` · ${a.city}` : ""}
                  </span>
                </span>
                {a.client_phone && (
                  <a href={`tel:${a.client_phone.replace(/\s/g, "")}`} onClick={(e) => e.stopPropagation()} className="hidden size-9 place-items-center rounded-lg bg-brand-50 text-brand-600 sm:grid" aria-label="Appeler">
                    <Phone className="size-4" />
                  </a>
                )}
                <Badge tone={APPOINTMENT_TONES[a.status]}>{APPOINTMENT_STATUS_LABELS[a.status]}</Badge>
              </div>
            ))}
          </Card>
        </section>
      ))}
    </div>
  );
}
