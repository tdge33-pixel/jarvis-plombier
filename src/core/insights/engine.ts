import "server-only";
import type { AppContext } from "@/lib/context";
import type { Client } from "@/lib/domain/types";
import { addDays, formatTimeFr, isoWeekday, relativeDayFr, today } from "@/lib/dates";
import { distanceKm } from "@/lib/geo";
import { getIntegrations } from "@/lib/integrations";
import type { StockLevel } from "@/lib/integrations/types";
import { freeSlots, listAppointments, type AppointmentView } from "@/lib/services/appointments";
import { clientIndex } from "@/lib/services/clients";
import { listQuotes, type QuoteView } from "@/lib/services/quotes";
import { listTasks, type TaskView } from "@/lib/services/tasks";

/**
 * Proactivité : « Jarvis a remarqué ».
 * V1 = règles simples évaluées à l'affichage. L'architecture (règles pures sur un
 * instantané de données) permettra plus tard de les exécuter en tâche de fond
 * (cron / file de messages) et de notifier l'artisan.
 */

export interface Insight {
  id: string;
  kind: "quote_followup" | "nearby_appointments" | "low_stock" | "overdue_tasks" | "empty_slot" | "overloaded_day" | "unconfirmed";
  severity: "info" | "warning";
  title: string;
  detail?: string;
  href?: string;
  /** Demande pré-remplie pour Jarvis. */
  prompt?: string;
}

export interface InsightSnapshot {
  today: string;
  tz: string;
  settings: AppContext["settings"];
  appointments: AppointmentView[]; // aujourd'hui → J+7
  quotes: QuoteView[];
  tasks: TaskView[];
  clients: Map<string, Client>;
  lowStock: StockLevel[];
}

export type InsightRule = (s: InsightSnapshot) => Insight[];

const quoteFollowup: InsightRule = (s) =>
  s.quotes
    .filter((q) => q.status === "sent" && (q.days_since_sent ?? 0) >= 10)
    .map((q) => ({
      id: `quote-${q.id}`,
      kind: "quote_followup",
      severity: "warning",
      title: `Le devis ${q.client_name ?? q.number} est sans réponse depuis ${q.days_since_sent} jours.`,
      detail: `${q.number} — ${q.title}`,
      href: `/devis/${q.id}`,
      prompt: `Prépare un SMS pour relancer ${q.client_name ?? "le client"} au sujet de son devis`,
    }));

const nearbyTomorrow: InsightRule = (s) => {
  const tomorrow = addDays(s.today, 1);
  const day = s.appointments.filter((a) => a.date === tomorrow && a.client_id);
  const out: Insight[] = [];
  for (let i = 0; i < day.length; i++) {
    for (let j = i + 1; j < day.length; j++) {
      const a = s.clients.get(day[i]!.client_id!);
      const b = s.clients.get(day[j]!.client_id!);
      if (a?.lat == null || a.lng == null || b?.lat == null || b.lng == null) continue;
      const d = distanceKm({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng });
      if (d < 3) {
        out.push({
          id: `nearby-${day[i]!.id}-${day[j]!.id}`,
          kind: "nearby_appointments",
          severity: "info",
          title: `Vous avez deux interventions situées à moins de 3 km demain.`,
          detail: `${day[i]!.client_name} (${day[i]!.city}) et ${day[j]!.client_name} (${day[j]!.city}) — ${d.toFixed(1).replace(".", ",")} km`,
          href: `/planning?view=day&date=${tomorrow}`,
        });
      }
    }
  }
  return out.slice(0, 1);
};

const lowStock: InsightRule = (s) =>
  s.lowStock.map((item) => ({
    id: `stock-${item.label}`,
    kind: "low_stock",
    severity: "warning",
    title: `Votre stock de ${item.label.toLowerCase()} semble faible.`,
    detail: `${item.quantity} restants (seuil : ${item.threshold})`,
    prompt: `Ajoute une tâche : commander des ${item.label.toLowerCase()}`,
  }));

const overdueTasks: InsightRule = (s) => {
  const overdue = s.tasks.filter((t) => t.status === "todo" && t.due_date && t.due_date < s.today);
  return overdue.length
    ? [{ id: "overdue-tasks", kind: "overdue_tasks", severity: "warning", title: `${overdue.length} tâche${overdue.length > 1 ? "s" : ""} en retard.`, detail: overdue.map((t) => t.title).slice(0, 2).join(" · "), href: "/taches" }]
    : [];
};

const emptySlot: InsightRule = (s) => {
  const tomorrow = addDays(s.today, 1);
  if (!s.settings.working_days.includes(isoWeekday(tomorrow))) return [];
  const day = s.appointments.filter((a) => a.date === tomorrow);
  if (day.length === 0) return [];
  const slots = freeSlots(day, s.settings.work_start, s.settings.work_end, 120);
  // Premier créneau libre d'au moins 2 h dans une journée déjà entamée.
  const contiguous = slots[0];
  return contiguous
    ? [{ id: `slot-${tomorrow}`, kind: "empty_slot", severity: "info", title: `Créneau libre ${relativeDayFr(tomorrow, s.tz)} à partir de ${formatTimeFr(contiguous)}.`, detail: "Idéal pour une visite de devis ou une urgence.", href: `/planning?view=day&date=${tomorrow}` }]
    : [];
};

const overloaded: InsightRule = (s) => {
  const byDay = new Map<string, number>();
  for (const a of s.appointments) byDay.set(a.date, (byDay.get(a.date) ?? 0) + 1);
  return [...byDay.entries()]
    .filter(([, n]) => n > s.settings.max_appointments_per_day)
    .map(([date, n]) => ({ id: `overload-${date}`, kind: "overloaded_day" as const, severity: "warning" as const, title: `${n} interventions prévues ${relativeDayFr(date, s.tz)} : au-delà de votre limite de ${s.settings.max_appointments_per_day}.`, href: `/planning?view=day&date=${date}` }));
};

const unconfirmed: InsightRule = (s) => {
  const soon = s.appointments.filter((a) => a.status === "to_confirm" && a.date <= addDays(s.today, 2));
  return soon.slice(0, 2).map((a) => ({
    id: `unconfirmed-${a.id}`,
    kind: "unconfirmed",
    severity: "info",
    title: `Le rendez-vous de ${a.client_name ?? "votre client"} ${relativeDayFr(a.date, s.tz)} n'est pas encore confirmé.`,
    detail: `${formatTimeFr(a.time)} — ${a.intervention_type}`,
    prompt: `Prépare un SMS pour confirmer le rendez-vous de ${a.client_name ?? "mon client"}`,
  }));
};

/** Règles génériques (valables pour tous les métiers). Un métier peut en ajouter. */
export const DEFAULT_RULES: InsightRule[] = [quoteFollowup, unconfirmed, nearbyTomorrow, lowStock, overdueTasks, overloaded, emptySlot];

export async function computeInsights(ctx: AppContext, rules: InsightRule[] = DEFAULT_RULES): Promise<Insight[]> {
  const t = today(ctx.tz);
  const [appointments, quotes, tasks, clients, integrations] = await Promise.all([
    listAppointments(ctx, t, addDays(t, 8)),
    listQuotes(ctx),
    listTasks(ctx),
    clientIndex(ctx),
    getIntegrations(ctx),
  ]);
  const snapshot: InsightSnapshot = { today: t, tz: ctx.tz, settings: ctx.settings, appointments, quotes, tasks, clients, lowStock: await integrations.inventory.lowStock() };
  return rules.flatMap((rule) => rule(snapshot));
}
