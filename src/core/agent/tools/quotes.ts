import "server-only";
import { z } from "zod";
import type { AppContext } from "@/lib/context";
import { QUOTE_STATUS_LABELS } from "@/lib/domain/types";
import { clientDisplayName, formatEuro, normalize } from "@/lib/format";
import { getIntegrations } from "@/lib/integrations";
import { activeMemories } from "@/lib/services/memories";
import { createQuote, getQuote, listQuotes, setQuoteStatus, type QuoteItemInput, type QuoteView } from "@/lib/services/quotes";
import type { UIBlock } from "../blocks";
import { defineTool } from "../types";
import { resolveClient } from "./helpers";

/** Applique les marques préférées mémorisées (« Je préfère Atlantic pour les chauffe-eaux »). */
async function applyPreferredBrands(ctx: AppContext, items: QuoteItemInput[]): Promise<QuoteItemInput[]> {
  const prefs = (await activeMemories(ctx))
    .map((m) => normalize(m.content).match(/prefere\s+([a-z0-9-]+)\s+pour\s+(?:les?|la|l')?\s*([a-z-]+)/))
    .filter((m): m is RegExpMatchArray => Boolean(m));
  return items.map((it) => {
    const label = normalize(it.label);
    for (const p of prefs) {
      const brand = p[1]!;
      const subject = p[2]!.replace(/(x|s)$/, "");
      if (label.includes(subject) && !label.includes(brand)) {
        return { ...it, label: `${it.label} ${brand.charAt(0).toUpperCase()}${brand.slice(1)}` };
      }
    }
    return it;
  });
}

function quoteBlock(q: { id: string; number: string; title: string; status: string; total_ht: number; total_ttc: number; vat_rate: number }, clientName: string | null, items: QuoteItemInput[]): UIBlock {
  return {
    type: "quote",
    id: q.id,
    number: q.number,
    title: q.title,
    client_name: clientName,
    status: QUOTE_STATUS_LABELS[q.status as keyof typeof QUOTE_STATUS_LABELS] ?? q.status,
    lines: items.map((i) => ({ label: i.label, quantity: i.quantity, unit_price: i.unit_price, kind: i.kind })),
    total_ht: q.total_ht,
    total_ttc: q.total_ttc,
    vat_rate: q.vat_rate,
  };
}

export const createQuoteDraftTool = defineTool({
  name: "createQuoteDraft",
  intent: "CREATE_QUOTE",
  level: 1,
  permission: "prepare_quotes",
  confirmation: "never",
  audit: true,
  description:
    "Préparer un BROUILLON de devis (jamais envoyé). La main-d'œuvre utilise le taux horaire de l'entreprise, le déplacement son forfait. N'invente pas de prix de matériel : utilise ceux donnés par l'utilisateur.",
  schema: z.object({
    client: z.string().optional().describe("Nom du client (facultatif)"),
    title: z.string().min(1).describe("Objet du devis, ex : « Remplacement chauffe-eau 200 L »"),
    description: z.string().optional(),
    laborHours: z.number().min(0).max(200).optional().describe("Heures de main-d'œuvre"),
    materials: z
      .array(z.object({ label: z.string().min(1), quantity: z.number().positive().optional(), unitPrice: z.number().min(0) }))
      .optional()
      .describe("Matériel avec prix unitaire HT"),
    includeTravel: z.boolean().optional().describe("Ajouter le forfait déplacement (oui par défaut)"),
    notes: z.string().optional(),
  }),
  async execute({ ctx }, args) {
    let clientId: string | null = null;
    let clientName: string | null = null;
    if (args.client) {
      const res = await resolveClient(ctx, args.client);
      if (res.kind !== "one") return res.result;
      clientId = res.client.id;
      clientName = clientDisplayName(res.client);
    }
    const s = ctx.settings;
    let items: QuoteItemInput[] = (args.materials ?? []).map((m) => ({ kind: "material", label: m.label, quantity: m.quantity ?? 1, unit_price: m.unitPrice }));
    items = await applyPreferredBrands(ctx, items);
    if (args.laborHours && args.laborHours > 0) items.push({ kind: "labor", label: "Main-d'œuvre", quantity: args.laborHours, unit_price: s.hourly_rate });
    if (args.includeTravel !== false && s.travel_fee > 0) items.push({ kind: "travel", label: "Déplacement", quantity: 1, unit_price: s.travel_fee });

    const { quote } = await createQuote(ctx, {
      client_id: clientId,
      title: args.title,
      description: args.description ?? null,
      notes: args.notes ?? null,
      items,
      created_by: "ai",
    });
    const who = clientName ? ` pour ${clientName}` : "";
    const missing = clientName ? "" : " Aucun client n'est encore associé : précisez-le dans le devis.";
    return {
      ok: true,
      summary: `J'ai préparé le brouillon de devis ${quote.number}${who} : ${formatEuro(quote.total_ttc)} TTC (${formatEuro(quote.total_ht)} HT).${missing}\nIl n'a pas été envoyé : relisez-le et validez-le avant envoi.`,
      data: { id: quote.id, number: quote.number, total_ht: quote.total_ht, total_ttc: quote.total_ttc, status: "draft" },
      blocks: [quoteBlock(quote, clientName, items)],
    };
  },
});

export const listQuotesTool = defineTool({
  name: "listQuotes",
  intent: "LIST_QUOTES",
  level: 1,
  confirmation: "never",
  audit: false,
  description: "Lister les devis, éventuellement par statut (draft, sent = en attente de réponse, accepted, refused, expired).",
  schema: z.object({ status: z.enum(["draft", "sent", "accepted", "refused", "expired"]).optional() }),
  async execute({ ctx }, args) {
    const quotes = await listQuotes(ctx, args.status);
    const label = args.status ? QUOTE_STATUS_LABELS[args.status].toLowerCase() : "";
    const summary =
      quotes.length === 0
        ? `Aucun devis ${label}.`
        : `${quotes.length} devis${label ? ` ${label}${quotes.length > 1 && !label.endsWith("s") ? "s" : ""}` : ""} :\n${quotes
            .slice(0, 8)
            .map((q) => `• ${q.number} — ${q.client_name ?? "sans client"} — ${q.title} — ${formatEuro(q.total_ttc)}${q.status === "sent" && q.days_since_sent !== null ? ` (envoyé il y a ${q.days_since_sent} j)` : ""}`)
            .join("\n")}`;
    return {
      ok: true,
      summary,
      headline: quotes.length === 0 ? summary : summary.split("\n")[0],
      data: quotes.map((q) => ({ id: q.id, number: q.number, client: q.client_name, title: q.title, status: q.status, total_ttc: q.total_ttc, days_since_sent: q.days_since_sent })),
      blocks: [{ type: "quotes", items: quotes.slice(0, 10).map((q) => ({ id: q.id, number: q.number, title: q.title, client_name: q.client_name, status: QUOTE_STATUS_LABELS[q.status], total_ttc: q.total_ttc, days_since_sent: q.days_since_sent })) }],
    };
  },
});

const sendSchema = z.object({
  quoteNumber: z.string().optional().describe("Numéro du devis, ex : D-2026-014"),
  client: z.string().optional().describe("Nom du client (dernier devis en brouillon)"),
});

async function findQuote(ctx: AppContext, args: z.infer<typeof sendSchema>): Promise<QuoteView | string> {
  const quotes = await listQuotes(ctx);
  if (args.quoteNumber) return quotes.find((q) => q.number.toUpperCase() === args.quoteNumber!.toUpperCase()) ?? `Je ne trouve pas le devis ${args.quoteNumber}.`;
  if (args.client) {
    const res = await resolveClient(ctx, args.client);
    if (res.kind !== "one") return res.result.summary;
    const q = quotes.find((x) => x.client_id === res.client.id && x.status === "draft");
    return q ?? `Aucun devis en brouillon pour ${clientDisplayName(res.client)}.`;
  }
  return "Quel devis voulez-vous envoyer ?";
}

export const sendQuoteTool = defineTool({
  name: "sendQuote",
  intent: "SEND_QUOTE",
  level: 3,
  permission: "prepare_quotes",
  confirmation: "always",
  audit: true,
  description: "Envoyer un devis au client par email. Action sensible : l'utilisateur doit toujours valider explicitement.",
  schema: sendSchema,
  async prepare({ ctx }, args) {
    const q = await findQuote(ctx, args);
    if (typeof q === "string") return { kind: "result", result: { ok: false, summary: q } };
    const detail = await getQuote(ctx, q.id);
    const client = q.client_id ? await ctx.store.get("clients", q.client_id) : null;
    const { email } = await getIntegrations(ctx);
    const warnings = [
      ...(!client?.email ? ["Ce client n'a pas d'adresse email."] : []),
      ...(!email.connected ? ["Aucune messagerie connectée : l'envoi sera simulé et le devis marqué « Envoyé »."] : []),
    ];
    return {
      kind: "confirm",
      args: { quoteNumber: q.number },
      title: "Envoyer le devis",
      question: `Envoyer le devis ${q.number} à ${q.client_name ?? "ce client"} ?`,
      lines: [
        `Devis : ${q.number} — ${q.title}`,
        `Client : ${q.client_name ?? "—"}${client?.email ? ` (${client.email})` : ""}`,
        `Montant : ${formatEuro(q.total_ttc)} TTC`,
        `Lignes : ${detail?.items.length ?? 0}`,
      ],
      warnings,
      fields: [],
    };
  },
  async execute({ ctx }, args) {
    const q = await findQuote(ctx, args);
    if (typeof q === "string") return { ok: false, summary: q };
    const client = q.client_id ? await ctx.store.get("clients", q.client_id) : null;
    const { email } = await getIntegrations(ctx);
    let simulated = true;
    if (client?.email) {
      const res = await email.send({
        to: client.email,
        subject: `Devis ${q.number} — ${ctx.business.name}`,
        body: `Bonjour,\n\nVeuillez trouver ci-joint notre devis ${q.number} (${q.title}) d'un montant de ${formatEuro(q.total_ttc)} TTC.\n\nCordialement,\n${ctx.settings.signature ?? ctx.profile.first_name}`,
      });
      simulated = res.simulated;
    }
    await setQuoteStatus(ctx, q.id, "sent");
    return {
      ok: true,
      summary: simulated
        ? `Devis ${q.number} marqué comme envoyé. Aucune messagerie n'étant connectée, l'email n'est pas réellement parti : transmettez-le vous-même ou connectez Gmail/Outlook dans Paramètres › Intégrations.`
        : `Devis ${q.number} envoyé à ${client?.email}.`,
      data: { number: q.number, simulated },
    };
  },
});
