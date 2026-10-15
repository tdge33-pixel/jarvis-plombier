import "server-only";
import { z } from "zod";
import { APPOINTMENT_STATUS_LABELS, QUOTE_STATUS_LABELS } from "@/lib/domain/types";
import { formatDayFr, formatShortDate, localDate } from "@/lib/dates";
import { clientDisplayName } from "@/lib/format";
import { createClient, getClientHistory, searchClients } from "@/lib/services/clients";
import { defineTool } from "../types";
import { resolveClient, toClientCard } from "./helpers";

export const searchClientTool = defineTool({
  name: "searchClient",
  intent: "SEARCH_CLIENT",
  level: 1,
  confirmation: "never",
  audit: false,
  description: "Rechercher un client par nom, ville ou téléphone. Renvoie coordonnées et informations importantes.",
  schema: z.object({ query: z.string().min(1).describe("Nom, ville ou numéro") }),
  async execute({ ctx }, args) {
    const matches = await searchClients(ctx, args.query);
    if (matches.length === 0) return { ok: false, summary: `Aucun client trouvé pour « ${args.query} ».`, data: { results: [] } };
    const first = matches[0]!;
    const summary =
      matches.length === 1
        ? `${clientDisplayName(first, { withFirstName: true })}${first.phone ? ` — ${first.phone}` : ""}${first.city ? `, ${first.city}` : ""}.${first.important_info ? `\nÀ savoir : ${first.important_info}` : ""}`
        : `${matches.length} clients correspondent à « ${args.query} ».`;
    return { ok: true, summary, data: { results: matches.slice(0, 8).map(toClientCard) }, blocks: [{ type: "clients", items: matches.slice(0, 8).map(toClientCard) }] };
  },
});

export const getClientHistoryTool = defineTool({
  name: "getClientHistory",
  intent: "SEARCH_HISTORY",
  level: 1,
  confirmation: "never",
  audit: false,
  description: "Historique d'un client : interventions passées et à venir, devis, notes. Pour « qu'est-ce qu'on avait fait chez X ».",
  schema: z.object({ client: z.string().min(1).describe("Nom du client ou identifiant") }),
  async execute({ ctx }, args) {
    const res = await resolveClient(ctx, args.client);
    if (res.kind !== "one") return res.result;
    const h = await getClientHistory(ctx, res.client.id);
    if (!h) return { ok: false, summary: "Client introuvable." };
    const name = clientDisplayName(h.client);
    const past = h.appointments.filter((a) => a.status === "done");
    const last = past[0];
    const lines: string[] = [];
    if (last) {
      lines.push(`Dernière intervention chez ${name} : ${formatShortDate(localDate(last.start_at, ctx.tz))} — ${last.intervention_type}.`);
      if (last.notes) lines.push(`Note : ${last.notes}`);
    } else {
      lines.push(`Aucune intervention terminée chez ${name} pour l'instant.`);
    }
    const upcoming = h.appointments.filter((a) => a.status !== "done" && a.status !== "cancelled" && a.start_at > new Date().toISOString());
    if (upcoming.length) {
      const next = upcoming[upcoming.length - 1]!;
      lines.push(`Prochain rendez-vous : ${formatDayFr(localDate(next.start_at, ctx.tz))} — ${next.intervention_type}.`);
    }
    if (h.quotes.length) lines.push(`Devis : ${h.quotes.map((q) => `${q.number} (${QUOTE_STATUS_LABELS[q.status].toLowerCase()})`).join(", ")}.`);
    if (h.client.important_info) lines.push(`À savoir : ${h.client.important_info}`);
    return {
      ok: true,
      summary: lines.join("\n"),
      data: {
        client: toClientCard(h.client),
        appointments: h.appointments.slice(0, 10).map((a) => ({ date: localDate(a.start_at, ctx.tz), type: a.intervention_type, status: a.status, notes: a.notes })),
        quotes: h.quotes.map((q) => ({ number: q.number, title: q.title, status: q.status, total_ttc: q.total_ttc })),
        notes: h.notes.map((n) => n.content),
      },
      blocks: [
        {
          type: "client_history",
          client: toClientCard(h.client),
          appointments: h.appointments.slice(0, 6).map((a) => ({ date: localDate(a.start_at, ctx.tz), intervention_type: a.intervention_type, status: APPOINTMENT_STATUS_LABELS[a.status], notes: a.notes })),
          quotes: h.quotes.slice(0, 5).map((q) => ({ id: q.id, number: q.number, title: q.title, status: QUOTE_STATUS_LABELS[q.status], total_ttc: q.total_ttc })),
          notes: h.notes.slice(0, 5).map((n) => ({ date: localDate(n.created_at, ctx.tz), content: n.content })),
        },
      ],
    };
  },
});

export const createClientTool = defineTool({
  name: "createClient",
  intent: "CREATE_CLIENT",
  level: 2,
  confirmation: "never",
  audit: true,
  description: "Créer une nouvelle fiche client. Vérifie d'abord avec searchClient qu'il n'existe pas déjà.",
  schema: z.object({
    civility: z.enum(["M.", "Mme"]).optional(),
    firstName: z.string().optional(),
    lastName: z.string().min(1),
    phone: z.string().optional(),
    email: z.string().optional(),
    address: z.string().optional(),
    postalCode: z.string().optional(),
    city: z.string().optional(),
    notes: z.string().optional(),
  }),
  async execute({ ctx }, args) {
    const existing = await searchClients(ctx, args.lastName);
    const duplicate = existing.find((c) => c.last_name.toLowerCase() === args.lastName.toLowerCase() && (!args.firstName || (c.first_name ?? "").toLowerCase() === args.firstName.toLowerCase()));
    if (duplicate) {
      return { ok: false, summary: `${clientDisplayName(duplicate, { withFirstName: true })} existe déjà dans vos clients.`, blocks: [{ type: "clients", items: [toClientCard(duplicate)] }] };
    }
    const c = await createClient(ctx, {
      civility: args.civility ?? null,
      first_name: args.firstName ?? null,
      last_name: args.lastName,
      company: null,
      phone: args.phone ?? null,
      email: args.email ?? null,
      address: args.address ?? null,
      postal_code: args.postalCode ?? null,
      city: args.city ?? null,
      notes: args.notes ?? null,
      important_info: null,
    });
    return { ok: true, summary: `Fiche client créée : ${clientDisplayName(c, { withFirstName: true })}.`, data: { id: c.id }, blocks: [{ type: "clients", items: [toClientCard(c)] }] };
  },
});
