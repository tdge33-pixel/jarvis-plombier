import "server-only";
import type { AppContext } from "@/lib/context";
import type { ID, Quote, QuoteItem, QuoteItemKind, QuoteStatus } from "@/lib/domain/types";
import { addDays, localDate, today } from "@/lib/dates";
import { clientDisplayName, round2 } from "@/lib/format";
import { clientIndex } from "./clients";

export interface QuoteItemInput {
  kind: QuoteItemKind;
  label: string;
  quantity: number;
  unit_price: number;
}

export interface QuoteTotals {
  labor: number;
  material: number;
  travel: number;
  other: number;
  total_ht: number;
  total_vat: number;
  total_ttc: number;
}

export function computeTotals(items: QuoteItemInput[], vatRate: number): QuoteTotals {
  const sum = (kind: QuoteItemKind) => round2(items.filter((i) => i.kind === kind).reduce((s, i) => s + i.quantity * i.unit_price, 0));
  const total_ht = round2(items.reduce((s, i) => s + i.quantity * i.unit_price, 0));
  const total_vat = round2((total_ht * vatRate) / 100);
  return {
    labor: sum("labor"),
    material: sum("material"),
    travel: sum("travel"),
    other: sum("other"),
    total_ht,
    total_vat,
    total_ttc: round2(total_ht + total_vat),
  };
}

export interface QuoteView extends Quote {
  client_name: string | null;
  days_since_sent: number | null;
}

/** Les devis envoyés dont la date de validité est dépassée passent automatiquement « Expiré ». */
async function expireOutdated(ctx: AppContext, quotes: Quote[]): Promise<Quote[]> {
  const t = today(ctx.tz);
  return Promise.all(
    quotes.map((q) => (q.status === "sent" && q.valid_until && q.valid_until < t ? ctx.store.update("quotes", q.id, { status: "expired" }) : q)),
  );
}

export async function listQuotes(ctx: AppContext, status?: QuoteStatus): Promise<QuoteView[]> {
  const [rows, clients] = await Promise.all([ctx.store.list("quotes", { order: { column: "created_at", ascending: false } }), clientIndex(ctx)]);
  const fresh = await expireOutdated(ctx, rows);
  const t = today(ctx.tz);
  return fresh
    .filter((q) => !status || q.status === status)
    .map((q) => {
      const c = q.client_id ? clients.get(q.client_id) : undefined;
      return {
        ...q,
        client_name: c ? clientDisplayName(c) : null,
        days_since_sent: q.sent_at ? Math.max(0, Math.round((Date.parse(t) - Date.parse(localDate(q.sent_at, ctx.tz))) / 86_400_000)) : null,
      };
    });
}

export async function getQuote(ctx: AppContext, id: ID): Promise<{ quote: QuoteView; items: QuoteItem[] } | null> {
  const quote = await ctx.store.get("quotes", id);
  if (!quote) return null;
  const [items, client] = await Promise.all([
    ctx.store.list("quote_items", { eq: { quote_id: id }, order: { column: "position" } }),
    quote.client_id ? ctx.store.get("clients", quote.client_id) : Promise.resolve(null),
  ]);
  return { quote: { ...quote, client_name: client ? clientDisplayName(client) : null, days_since_sent: null }, items };
}

async function nextNumber(ctx: AppContext): Promise<string> {
  const year = today(ctx.tz).slice(0, 4);
  const quotes = await ctx.store.list("quotes");
  const max = quotes
    .map((q) => q.number.match(/^D-(\d{4})-(\d+)$/))
    .filter((m): m is RegExpMatchArray => Boolean(m) && m![1] === year)
    .reduce((acc, m) => Math.max(acc, Number(m[2])), 0);
  return `D-${year}-${String(max + 1).padStart(3, "0")}`;
}

export interface QuoteInput {
  client_id: ID | null;
  title: string;
  description?: string | null;
  notes?: string | null;
  vat_rate?: number;
  items: QuoteItemInput[];
  created_by?: "user" | "ai";
}

/** Crée un devis en BROUILLON. Un devis n'est jamais envoyé automatiquement. */
export async function createQuote(ctx: AppContext, input: QuoteInput): Promise<{ quote: Quote; items: QuoteItem[] }> {
  const vat = input.vat_rate ?? ctx.settings.vat_rate;
  const totals = computeTotals(input.items, vat);
  const quote = await ctx.store.insert("quotes", {
    client_id: input.client_id,
    number: await nextNumber(ctx),
    title: input.title,
    description: input.description ?? null,
    status: "draft",
    vat_rate: vat,
    total_ht: totals.total_ht,
    total_vat: totals.total_vat,
    total_ttc: totals.total_ttc,
    notes: input.notes ?? null,
    valid_until: addDays(today(ctx.tz), ctx.settings.quote_validity_days),
    sent_at: null,
    created_by: input.created_by ?? "user",
  });
  const items = await Promise.all(input.items.map((it, position) => ctx.store.insert("quote_items", { ...it, quote_id: quote.id, position })));
  return { quote, items };
}

export async function updateQuote(ctx: AppContext, id: ID, input: Omit<QuoteInput, "created_by"> & { status?: QuoteStatus }): Promise<Quote> {
  const existing = await ctx.store.list("quote_items", { eq: { quote_id: id } });
  await Promise.all(existing.map((it) => ctx.store.remove("quote_items", it.id)));
  await Promise.all(input.items.map((it, position) => ctx.store.insert("quote_items", { ...it, quote_id: id, position })));
  const vat = input.vat_rate ?? ctx.settings.vat_rate;
  const totals = computeTotals(input.items, vat);
  const current = await ctx.store.get("quotes", id);
  return ctx.store.update("quotes", id, {
    ...(input.status === "sent" && !current?.sent_at ? { sent_at: new Date().toISOString() } : {}),
    client_id: input.client_id,
    title: input.title,
    description: input.description ?? null,
    notes: input.notes ?? null,
    vat_rate: vat,
    total_ht: totals.total_ht,
    total_vat: totals.total_vat,
    total_ttc: totals.total_ttc,
    ...(input.status ? { status: input.status } : {}),
  });
}

export async function setQuoteStatus(ctx: AppContext, id: ID, status: QuoteStatus): Promise<Quote> {
  return ctx.store.update("quotes", id, {
    status,
    ...(status === "sent" ? { sent_at: new Date().toISOString() } : {}),
  });
}

export async function deleteQuote(ctx: AppContext, id: ID): Promise<void> {
  const items = await ctx.store.list("quote_items", { eq: { quote_id: id } });
  await Promise.all(items.map((it) => ctx.store.remove("quote_items", it.id)));
  await ctx.store.remove("quotes", id);
}
