import "server-only";
import type { AppContext } from "@/lib/context";
import type { Appointment, AppointmentStatus, Client, ID, ISODate } from "@/lib/domain/types";
import {
  addDays,
  formatDayFr,
  isoWeekday,
  localDate,
  localTime,
  minutesToTime,
  timeToMinutes,
  weekdayNameFr,
  zonedToUtc,
} from "@/lib/dates";
import { clientDisplayName } from "@/lib/format";
import { getIntegrations } from "@/lib/integrations";
import { clientIndex } from "./clients";

/** Rendez-vous enrichi pour l'affichage (heure locale, nom du client). */
export interface AppointmentView extends Appointment {
  date: ISODate;
  time: string;
  end_time: string;
  client_name: string | null;
  client_phone: string | null;
}

export function toView(ctx: AppContext, a: Appointment, client: Client | undefined): AppointmentView {
  const time = localTime(a.start_at, ctx.tz);
  return {
    ...a,
    date: localDate(a.start_at, ctx.tz),
    time,
    end_time: minutesToTime(Math.min(timeToMinutes(time) + a.duration_minutes, 23 * 60 + 59)),
    client_name: client ? clientDisplayName(client) : null,
    client_phone: client?.phone ?? null,
  };
}

/** Rendez-vous entre deux dates locales (from inclus, to exclus). */
export async function listAppointments(ctx: AppContext, from: ISODate, to: ISODate, opts: { includeCancelled?: boolean } = {}): Promise<AppointmentView[]> {
  const [rows, clients] = await Promise.all([
    ctx.store.list("appointments", {
      gte: { start_at: zonedToUtc(from, "00:00", ctx.tz) },
      lt: { start_at: zonedToUtc(to, "00:00", ctx.tz) },
      order: { column: "start_at", ascending: true },
    }),
    clientIndex(ctx),
  ]);
  return rows
    .filter((a) => opts.includeCancelled || a.status !== "cancelled")
    .map((a) => toView(ctx, a, a.client_id ? clients.get(a.client_id) : undefined));
}

export async function listDay(ctx: AppContext, date: ISODate, opts: { includeCancelled?: boolean } = {}) {
  return listAppointments(ctx, date, addDays(date, 1), opts);
}

export async function getAppointmentView(ctx: AppContext, id: ID): Promise<AppointmentView | null> {
  const a = await ctx.store.get("appointments", id);
  if (!a) return null;
  const client = a.client_id ? await ctx.store.get("clients", a.client_id) : null;
  return toView(ctx, a, client ?? undefined);
}

export interface AppointmentInput {
  client_id: ID | null;
  date: ISODate;
  time: string;
  duration_minutes: number;
  intervention_type: string;
  title?: string;
  address?: string | null;
  city?: string | null;
  status?: AppointmentStatus;
  notes?: string | null;
}

export async function createAppointment(ctx: AppContext, input: AppointmentInput): Promise<AppointmentView> {
  const client = input.client_id ? await ctx.store.get("clients", input.client_id) : null;
  const row = await ctx.store.insert("appointments", {
    client_id: input.client_id,
    title: input.title || input.intervention_type,
    intervention_type: input.intervention_type,
    start_at: zonedToUtc(input.date, input.time, ctx.tz),
    duration_minutes: input.duration_minutes,
    address: input.address ?? client?.address ?? null,
    city: input.city ?? client?.city ?? null,
    status: input.status ?? "confirmed",
    notes: input.notes ?? null,
    external_event_id: null,
  });
  // Synchronisation avec l'agenda externe (mock tant qu'aucune intégration n'est connectée).
  const { calendar } = await getIntegrations(ctx);
  const ext = await calendar.upsertEvent({
    externalId: null,
    title: `${row.title}${client ? ` — ${clientDisplayName(client)}` : ""}`,
    startAt: row.start_at,
    durationMinutes: row.duration_minutes,
    location: [row.address, row.city].filter(Boolean).join(", "),
    description: row.notes ?? "",
  });
  const saved = ext.externalId ? await ctx.store.update("appointments", row.id, { external_event_id: ext.externalId }) : row;
  return toView(ctx, saved, client ?? undefined);
}

export interface AppointmentPatch extends Partial<Omit<AppointmentInput, "date" | "time">> {
  date?: ISODate;
  time?: string;
}

export async function updateAppointment(ctx: AppContext, id: ID, patch: AppointmentPatch): Promise<AppointmentView> {
  const current = await ctx.store.get("appointments", id);
  if (!current) throw new Error("Rendez-vous introuvable");
  const date = patch.date ?? localDate(current.start_at, ctx.tz);
  const time = patch.time ?? localTime(current.start_at, ctx.tz);
  const { date: _d, time: _t, ...rest } = patch;
  const updated = await ctx.store.update("appointments", id, {
    ...rest,
    ...(patch.intervention_type && !patch.title ? { title: patch.intervention_type } : {}),
    start_at: zonedToUtc(date, time, ctx.tz),
  });
  const { calendar } = await getIntegrations(ctx);
  await calendar.upsertEvent({
    externalId: updated.external_event_id,
    title: updated.title,
    startAt: updated.start_at,
    durationMinutes: updated.duration_minutes,
    location: [updated.address, updated.city].filter(Boolean).join(", "),
    description: updated.notes ?? "",
    cancelled: updated.status === "cancelled",
  });
  const client = updated.client_id ? await ctx.store.get("clients", updated.client_id) : null;
  return toView(ctx, updated, client ?? undefined);
}

export async function deleteAppointment(ctx: AppContext, id: ID): Promise<void> {
  const current = await ctx.store.get("appointments", id);
  if (current?.external_event_id) {
    const { calendar } = await getIntegrations(ctx);
    await calendar.deleteEvent(current.external_event_id);
  }
  await ctx.store.remove("appointments", id);
}

export interface Availability {
  available: boolean;
  conflicts: AppointmentView[];
  warnings: string[];
  dayCount: number;
  freeSlots: string[];
}

/**
 * Vérifie un créneau selon les paramètres de l'entreprise :
 * jours travaillés, horaires (et urgences), chevauchements, nombre max d'interventions.
 */
export async function checkAvailability(ctx: AppContext, date: ISODate, time: string, durationMinutes: number, excludeId?: ID): Promise<Availability> {
  const s = ctx.settings;
  const day = (await listDay(ctx, date)).filter((a) => a.id !== excludeId);
  const start = timeToMinutes(time);
  const end = start + durationMinutes;
  const warnings: string[] = [];

  const weekday = isoWeekday(date);
  if (!s.working_days.includes(weekday)) warnings.push(`Vous ne travaillez normalement pas le ${weekdayNameFr(weekday)}.`);

  const workStart = timeToMinutes(s.work_start);
  const workEnd = timeToMinutes(s.work_end);
  if (start < workStart || end > workEnd) {
    const emergencyEnd = s.emergencies_accepted && s.emergency_until ? timeToMinutes(s.emergency_until) : null;
    if (emergencyEnd !== null && start >= workStart && end <= emergencyEnd) {
      warnings.push(`Ce créneau dépasse vos horaires (${s.work_start}–${s.work_end}) : à réserver aux urgences.`);
    } else {
      warnings.push(`Ce créneau est en dehors de vos horaires (${s.work_start}–${s.work_end}).`);
    }
  }

  const conflicts = day.filter((a) => {
    const aStart = timeToMinutes(a.time);
    return aStart < end && start < aStart + a.duration_minutes;
  });
  if (day.length >= s.max_appointments_per_day) {
    warnings.push(`Vous avez déjà ${day.length} interventions ce jour-là (maximum : ${s.max_appointments_per_day}).`);
  }

  return {
    available: conflicts.length === 0,
    conflicts,
    warnings,
    dayCount: day.length,
    freeSlots: freeSlots(day, s.work_start, s.work_end, durationMinutes),
  };
}

/** Créneaux libres (pas de 30 min) pouvant accueillir une intervention de la durée donnée. */
export function freeSlots(day: AppointmentView[], workStart: string, workEnd: string, duration: number): string[] {
  const slots: string[] = [];
  for (let t = timeToMinutes(workStart); t + duration <= timeToMinutes(workEnd); t += 30) {
    const overlaps = day.some((a) => {
      const s = timeToMinutes(a.time);
      return s < t + duration && t < s + a.duration_minutes;
    });
    if (!overlaps) slots.push(minutesToTime(t));
  }
  return slots;
}

export function describeSlot(date: ISODate, time: string): string {
  return `${formatDayFr(date)} à ${time.replace(":", "h")}`;
}
