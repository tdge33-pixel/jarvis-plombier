import "server-only";
import { z } from "zod";
import type { AppContext } from "@/lib/context";
import type { Client } from "@/lib/domain/types";
import { addDays, formatTimeFr, relativeDayFr, today } from "@/lib/dates";
import { clientDisplayName } from "@/lib/format";
import { getIntegrations } from "@/lib/integrations";
import { listAppointments, type AppointmentView } from "@/lib/services/appointments";
import { listQuotes } from "@/lib/services/quotes";
import { defineTool } from "../types";
import { resolveClient } from "./helpers";

async function nextAppointment(ctx: AppContext, clientId?: string): Promise<AppointmentView | null> {
  const now = Date.now();
  const t = today(ctx.tz);
  const items = await listAppointments(ctx, t, addDays(t, 60));
  return (
    items.find((a) => {
      if (a.status === "done" || a.status === "cancelled") return false;
      const start = Date.parse(a.start_at);
      // Pour un client précis : rendez-vous en cours ou à venir ; sinon : le prochain qui n'a pas commencé.
      return clientId ? a.client_id === clientId && start + a.duration_minutes * 60_000 > now : start > now;
    }) ?? null
  );
}

export const draftCustomerMessageTool = defineTool({
  name: "draftCustomerMessage",
  intent: "DRAFT_MESSAGE",
  level: 1,
  permission: "draft_messages",
  confirmation: "never",
  audit: true,
  description:
    "Rédiger un BROUILLON de SMS ou d'email pour un client (retard, rappel de rendez-vous, relance de devis…). Le message n'est jamais envoyé automatiquement. Tu peux fournir le texte dans `body` ; sinon un modèle est utilisé.",
  schema: z.object({
    client: z.string().optional().describe("Nom du client"),
    target: z.enum(["next_appointment"]).optional().describe("Le client du prochain rendez-vous"),
    channel: z.enum(["sms", "email"]).optional(),
    purpose: z.enum(["delay", "reminder", "confirmation", "quote_followup", "custom"]),
    delayMinutes: z.number().int().positive().optional(),
    instructions: z.string().optional().describe("Ce que le message doit dire (pour purpose=custom)"),
    body: z.string().optional().describe("Texte complet du message si tu le rédiges toi-même"),
  }),
  async execute({ ctx }, args) {
    let client: Client | null = null;
    let appt: AppointmentView | null = null;
    if (args.client) {
      const res = await resolveClient(ctx, args.client);
      if (res.kind !== "one") return res.result;
      client = res.client;
      appt = await nextAppointment(ctx, client.id);
    } else {
      appt = await nextAppointment(ctx);
      if (!appt) return { ok: false, summary: "Je ne trouve pas de prochain rendez-vous aujourd'hui ou dans les jours qui viennent." };
      client = appt.client_id ? await ctx.store.get("clients", appt.client_id) : null;
    }
    const name = client ? clientDisplayName(client) : "Madame, Monsieur";
    const signature = ctx.settings.signature || ctx.profile.first_name;
    const when = appt ? `${relativeDayFr(appt.date, ctx.tz) === "aujourd'hui" ? "" : `${relativeDayFr(appt.date, ctx.tz)} `}à ${formatTimeFr(appt.time)}` : "";
    let body = args.body?.trim();
    if (!body) {
      switch (args.purpose) {
        case "delay":
          body = `Bonjour ${name},\nje vous informe que j'aurai environ ${args.delayMinutes ?? 15} minutes de retard pour notre rendez-vous${when ? ` de ${formatTimeFr(appt!.time)}` : ""}.\nMerci pour votre compréhension.\n${signature}`;
          break;
        case "reminder":
          body = `Bonjour ${name},\nje vous rappelle notre rendez-vous ${when || "prévu"}${appt ? ` pour : ${appt.intervention_type.toLowerCase()}` : ""}.\nÀ bientôt,\n${signature}`;
          break;
        case "confirmation":
          body = `Bonjour ${name},\nje vous confirme notre rendez-vous ${when || "prévu"}.\nBien cordialement,\n${signature}`;
          break;
        case "quote_followup": {
          const quote = client ? (await listQuotes(ctx, "sent")).find((q) => q.client_id === client!.id) : undefined;
          body = `Bonjour ${name},\navez-vous pu consulter mon devis${quote ? ` ${quote.number} (${quote.title.toLowerCase()})` : ""} ? Je reste à votre disposition pour toute question.\nBien cordialement,\n${signature}`;
          break;
        }
        default:
          body = `Bonjour ${name},\n${(args.instructions ?? "").replace(/^./, (c) => c.toUpperCase())}${/[.!?]$/.test(args.instructions ?? "") ? "" : "."}\nBien cordialement,\n${signature}`;
      }
    }
    const channel = args.channel ?? (client?.phone ? "sms" : "email");
    const { sms, email } = await getIntegrations(ctx);
    const canSend = channel === "sms" ? sms.connected : email.connected;
    return {
      ok: true,
      summary: `Voici un brouillon de ${channel === "sms" ? "SMS" : "email"} pour ${name}. Il n'est pas envoyé : relisez-le puis envoyez-le vous-même.`,
      data: { recipient: name, channel, body },
      blocks: [
        {
          type: "message_draft",
          channel,
          recipient: name,
          phone: client?.phone ?? null,
          email: client?.email ?? null,
          ...(channel === "email" ? { subject: `${ctx.business.name}` } : {}),
          body,
          canSend,
        },
      ],
    };
  },
});
