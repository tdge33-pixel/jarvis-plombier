import "server-only";
import { z } from "zod";
import { addDays, formatDayFr, formatDurationFr, formatTimeFr, localTime, relativeDayFr, today } from "@/lib/dates";
import { clientAddressLine, clientDisplayName } from "@/lib/format";
import {
  checkAvailability,
  createAppointment,
  getAppointmentView,
  listAppointments,
  listDay,
  updateAppointment,
  type AppointmentView,
} from "@/lib/services/appointments";
import { APPOINTMENT_STATUS_LABELS } from "@/lib/domain/types";
import { defineTool, type ToolContext } from "../types";
import { resolveClient, toAppointmentCard } from "./helpers";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format AAAA-MM-JJ");
const hhmm = z.string().regex(/^\d{2}:\d{2}$/, "Format HH:MM");

function headline(items: AppointmentView[], label: string): string {
  if (items.length === 0) return `Vous n'avez aucune intervention ${label}.`;
  return items.length === 1 ? `Vous avez 1 intervention ${label} :` : `Vous avez ${items.length} interventions ${label} :`;
}

function describeList(items: AppointmentView[], label: string): string {
  if (items.length === 0) return `Vous n'avez aucune intervention ${label}.`;
  const lines = items.map((a) => `${a.time} — ${a.client_name ?? "Sans client"}\n${a.intervention_type}${a.city ? `\n${a.city}` : ""}`);
  const intro = items.length === 1 ? `Vous avez 1 intervention ${label} :` : `Vous avez ${items.length} interventions ${label} :`;
  return `${intro}\n\n${lines.join("\n\n")}`;
}

export const getAppointmentsTool = defineTool({
  name: "getAppointments",
  intent: "READ_CALENDAR",
  level: 1,
  confirmation: "never",
  audit: false,
  description: "Lire le planning : interventions d'un jour (date) ou d'une période (from/to, to exclu). Sans paramètre : aujourd'hui.",
  schema: z.object({
    date: isoDate.optional().describe("Jour précis AAAA-MM-JJ"),
    from: isoDate.optional().describe("Début de période AAAA-MM-JJ"),
    to: isoDate.optional().describe("Fin de période AAAA-MM-JJ (exclue)"),
  }),
  async execute({ ctx }, args) {
    if (args.from && args.to) {
      const items = await listAppointments(ctx, args.from, args.to);
      const label = `du ${formatDayFr(args.from)} au ${formatDayFr(addDays(args.to, -1))}`;
      return {
        ok: true,
        summary: describeList(items, label),
        headline: headline(items, label),
        data: items.map((a) => ({ id: a.id, date: a.date, time: a.time, client: a.client_name, type: a.intervention_type, city: a.city, status: a.status })),
        blocks: [{ type: "appointments", title: `Interventions ${label}`, items: items.map(toAppointmentCard) }],
      };
    }
    const date = args.date ?? today(ctx.tz);
    const items = await listDay(ctx, date);
    const rel = relativeDayFr(date, ctx.tz);
    const label = ["aujourd'hui", "demain", "après-demain", "hier"].includes(rel) ? rel : `le ${rel}`;
    return {
      ok: true,
      summary: describeList(items, label),
      headline: headline(items, label),
      data: items.map((a) => ({ id: a.id, time: a.time, end: a.end_time, client: a.client_name, type: a.intervention_type, city: a.city, status: a.status })),
      blocks: [
        {
          type: "appointments",
          // « Demain — mardi 20 octobre », mais pas « Jeudi 22 octobre — jeudi 22 octobre ».
          title: rel === formatDayFr(date) ? `${rel.charAt(0).toUpperCase()}${rel.slice(1)}` : `${rel.charAt(0).toUpperCase()}${rel.slice(1)} — ${formatDayFr(date)}`,
          date,
          items: items.map(toAppointmentCard),
        },
      ],
    };
  },
});

export const getCalendarAvailabilityTool = defineTool({
  name: "getCalendarAvailability",
  intent: "READ_CALENDAR",
  level: 1,
  confirmation: "never",
  audit: false,
  description:
    "Trouver les créneaux libres d'une journée pour une intervention d'une durée donnée. `after` / `before` limitent à une partie de la journée (ex : après-midi → after 12:00).",
  schema: z.object({
    date: isoDate.describe("Jour AAAA-MM-JJ"),
    durationMinutes: z.number().int().min(15).max(600).optional().describe("Durée en minutes (60 par défaut)"),
    after: hhmm.optional().describe("Ne garder que les créneaux commençant à partir de HH:MM"),
    before: hhmm.optional().describe("Ne garder que les créneaux commençant avant HH:MM"),
  }),
  async execute({ ctx }, args) {
    const duration = args.durationMinutes ?? 60;
    const av = await checkAvailability(ctx, args.date, ctx.settings.work_start, duration);
    // Aujourd'hui : pas de créneau déjà passé.
    const now = args.date === today(ctx.tz) ? localTime(new Date().toISOString(), ctx.tz) : null;
    const slots = av.freeSlots.filter((s) => (!now || s > now) && (!args.after || s >= args.after) && (!args.before || s < args.before));
    const day = formatDayFr(args.date);
    const part = args.after && !args.before ? ` après ${formatTimeFr(args.after)}` : args.before && !args.after ? ` avant ${formatTimeFr(args.before)}` : "";
    const notWorking = av.warnings.find((w) => w.startsWith("Vous ne travaillez"));
    const summary = notWorking
      ? `${notWorking} Voulez-vous quand même prévoir quelque chose le ${day} ?`
      : slots.length === 0
        ? `Le ${day}, aucun créneau libre${part} pour une intervention de ${formatDurationFr(duration)}.`
        : `Le ${day}, vous êtes libre${part} à : ${slots.slice(0, 8).map(formatTimeFr).join(", ")}${slots.length > 8 ? "…" : ""}`;
    return {
      ok: true,
      summary,
      data: { date: args.date, freeSlots: slots, appointmentsThatDay: av.dayCount, warnings: av.warnings },
      blocks: [{ type: "availability", date: args.date, freeSlots: slots, warnings: notWorking ? [notWorking] : [] }],
    };
  },
});

const createAppointmentSchema = z.object({
  client: z.string().min(1).describe("Nom du client tel que dit par l'utilisateur (ex : « Mme Martin ») ou son identifiant"),
  date: isoDate.describe("Jour AAAA-MM-JJ"),
  time: hhmm.describe("Heure de début HH:MM"),
  durationMinutes: z.number().int().min(15).max(720).optional().describe("Durée en minutes"),
  interventionType: z.string().min(1).describe("Type d'intervention (ex : « Recherche de fuite »)"),
  notes: z.string().optional(),
});

export const createAppointmentTool = defineTool({
  name: "createAppointment",
  intent: "CREATE_APPOINTMENT",
  level: 2,
  permission: "create_appointments",
  confirmation: "always",
  audit: true,
  description:
    "Créer un rendez-vous / une intervention pour un client existant. L'utilisateur validera avant création : appelle cet outil directement, sans demander de confirmation toi-même.",
  schema: createAppointmentSchema,
  async prepare({ ctx, vertical }, args) {
    const res = await resolveClient(ctx, args.client);
    if (res.kind !== "one") return { kind: "result", result: res.result };
    const client = res.client;
    const type = vertical.interventionTypes.find((t) => t.label.toLowerCase() === args.interventionType.toLowerCase());
    const duration = args.durationMinutes ?? type?.defaultDurationMinutes ?? 60;
    const av = await checkAvailability(ctx, args.date, args.time, duration);
    const name = clientDisplayName(client);
    const when = `${formatDayFr(args.date)} à ${formatTimeFr(args.time)}`;
    const warnings = [
      ...av.conflicts.map((c) => `Chevauche : ${c.time} — ${c.client_name ?? "sans client"} (${c.intervention_type}).`),
      ...av.warnings,
    ];
    const status = av.available && av.warnings.length === 0 ? `${capitalize(when)} est disponible.` : `${capitalize(when)} : attention, voir ci-dessous.`;
    return {
      kind: "confirm",
      args: { ...args, client: client.id, durationMinutes: duration },
      title: "Nouveau rendez-vous",
      question: `J'ai trouvé ${name}.\n${status}\n\nCréer le rendez-vous ?`,
      lines: [
        `Client : ${clientDisplayName(client, { withFirstName: true })}`,
        `Date : ${formatDayFr(args.date)}`,
        `Heure : ${formatTimeFr(args.time)} (${formatDurationFr(duration)})`,
        `Intervention : ${args.interventionType}`,
        ...(clientAddressLine(client) ? [`Adresse : ${clientAddressLine(client)}`] : []),
      ],
      warnings,
      fields: [
        { key: "date", label: "Date", type: "date", value: args.date },
        { key: "time", label: "Heure", type: "time", value: args.time },
        { key: "durationMinutes", label: "Durée (min)", type: "number", value: duration },
        { key: "interventionType", label: "Intervention", type: "text", value: args.interventionType },
        { key: "notes", label: "Notes", type: "textarea", value: args.notes ?? "" },
      ],
    };
  },
  async execute({ ctx }, args) {
    const res = await resolveClient(ctx, args.client);
    if (res.kind !== "one") return res.result;
    const created = await createAppointment(ctx, {
      client_id: res.client.id,
      date: args.date,
      time: args.time,
      duration_minutes: args.durationMinutes ?? 60,
      intervention_type: args.interventionType,
      notes: args.notes || null,
      status: "confirmed",
    });
    return {
      ok: true,
      summary: `C'est fait : rendez-vous avec ${created.client_name} ${formatDayFr(created.date)} à ${formatTimeFr(created.time)} (${created.intervention_type}).`,
      data: { id: created.id, date: created.date, time: created.time },
      blocks: [{ type: "appointments", title: "Rendez-vous créé", items: [toAppointmentCard(created)] }],
    };
  },
});

const statusEnum = z.enum(["to_confirm", "confirmed", "in_progress", "done", "cancelled"]);

const updateSchema = z.object({
  appointmentId: z.string().optional().describe("Identifiant du rendez-vous si connu"),
  client: z.string().optional().describe("Nom du client pour retrouver son prochain rendez-vous"),
  date: isoDate.optional().describe("Date actuelle du rendez-vous à modifier, si précisée"),
  newDate: isoDate.optional(),
  newTime: hhmm.optional(),
  newDurationMinutes: z.number().int().min(15).max(720).optional(),
  status: statusEnum.optional().describe("Nouveau statut (cancelled pour annuler)"),
  notes: z.string().optional(),
});

async function findAppointment({ ctx }: ToolContext, args: z.infer<typeof updateSchema>): Promise<AppointmentView | string> {
  if (args.appointmentId) {
    const a = await getAppointmentView(ctx, args.appointmentId);
    return a ?? "Je ne retrouve pas ce rendez-vous.";
  }
  if (!args.client) return "De quel rendez-vous s'agit-il ? Précisez le client.";
  const res = await resolveClient(ctx, args.client);
  if (res.kind !== "one") return res.result.summary;
  const from = args.date ?? today(ctx.tz);
  const to = args.date ? addDays(args.date, 1) : addDays(from, 90);
  const upcoming = (await listAppointments(ctx, from, to)).filter((a) => a.client_id === res.client.id);
  if (upcoming.length === 0) return `Je ne trouve aucun rendez-vous à venir pour ${clientDisplayName(res.client)}.`;
  return upcoming[0]!;
}

export const updateAppointmentTool = defineTool({
  name: "updateAppointment",
  intent: "UPDATE_APPOINTMENT",
  level: 2,
  permission: "modify_appointments",
  confirmation: "always",
  audit: true,
  description: "Déplacer, modifier ou annuler un rendez-vous existant (le prochain du client si aucune date n'est donnée). L'utilisateur validera.",
  schema: updateSchema,
  async prepare(tc, args) {
    const found = await findAppointment(tc, args);
    if (typeof found === "string") return { kind: "result", result: { ok: false, summary: found } };
    const newDate = args.newDate ?? found.date;
    const newTime = args.newTime ?? found.time;
    const duration = args.newDurationMinutes ?? found.duration_minutes;
    const cancelling = args.status === "cancelled";
    const av = cancelling ? null : await checkAvailability(tc.ctx, newDate, newTime, duration, found.id);
    const warnings = av ? [...av.conflicts.map((c) => `Chevauche : ${c.time} — ${c.client_name ?? "sans client"}.`), ...av.warnings] : [];
    const lines = [
      `Client : ${found.client_name ?? "—"}`,
      `Actuellement : ${formatDayFr(found.date)} à ${formatTimeFr(found.time)} — ${found.intervention_type}`,
      cancelling ? "Nouveau statut : Annulé" : `Nouveau créneau : ${formatDayFr(newDate)} à ${formatTimeFr(newTime)} (${formatDurationFr(duration)})`,
      ...(args.status && !cancelling ? [`Statut : ${APPOINTMENT_STATUS_LABELS[args.status]}`] : []),
    ];
    return {
      kind: "confirm",
      args: { ...args, appointmentId: found.id },
      title: cancelling ? "Annuler le rendez-vous" : "Modifier le rendez-vous",
      question: cancelling ? `Annuler le rendez-vous de ${found.client_name} du ${formatDayFr(found.date)} ?` : `Je déplace le rendez-vous de ${found.client_name} ?`,
      lines,
      warnings,
      fields: cancelling
        ? []
        : [
            { key: "newDate", label: "Nouvelle date", type: "date", value: newDate },
            { key: "newTime", label: "Nouvelle heure", type: "time", value: newTime },
            { key: "newDurationMinutes", label: "Durée (min)", type: "number", value: duration },
          ],
    };
  },
  async execute(tc, args) {
    const found = await findAppointment(tc, args);
    if (typeof found === "string") return { ok: false, summary: found };
    const updated = await updateAppointment(tc.ctx, found.id, {
      ...(args.newDate ? { date: args.newDate } : {}),
      ...(args.newTime ? { time: args.newTime } : {}),
      ...(args.newDurationMinutes ? { duration_minutes: args.newDurationMinutes } : {}),
      ...(args.status ? { status: args.status } : {}),
      ...(args.notes ? { notes: args.notes } : {}),
    });
    const summary =
      updated.status === "cancelled"
        ? `Rendez-vous de ${updated.client_name} du ${formatDayFr(updated.date)} annulé.`
        : `Rendez-vous de ${updated.client_name} déplacé au ${formatDayFr(updated.date)} à ${formatTimeFr(updated.time)}.`;
    return { ok: true, summary, data: { id: updated.id, date: updated.date, time: updated.time, status: updated.status }, blocks: [{ type: "appointments", title: "Rendez-vous mis à jour", items: [toAppointmentCard(updated)] }] };
  },
});

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
