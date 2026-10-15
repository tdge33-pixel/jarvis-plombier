import "server-only";
import type { AppContext } from "@/lib/context";
import type { Appointment, Client, ClientNote, ID, Quote, Task } from "@/lib/domain/types";
import { normalize } from "@/lib/format";

export type ClientInput = Pick<
  Client,
  "civility" | "first_name" | "last_name" | "company" | "phone" | "email" | "address" | "postal_code" | "city" | "notes" | "important_info"
>;

export async function listClients(ctx: AppContext): Promise<Client[]> {
  const clients = await ctx.store.list("clients");
  return clients.sort((a, b) => a.last_name.localeCompare(b.last_name, "fr"));
}

export async function getClient(ctx: AppContext, id: ID): Promise<Client | null> {
  return ctx.store.get("clients", id);
}

const STOP_WORDS = new Set(["mme", "madame", "m", "mr", "monsieur", "mlle", "chez", "le", "la", "les", "client", "cliente", "de", "du"]);

/**
 * Recherche tolérante : "Mme Martin", "martin", "chez dupont", "Cenon", "06 98…".
 * Renvoie les clients triés par pertinence (le nom de famille exact en premier).
 */
export async function searchClients(ctx: AppContext, query: string): Promise<Client[]> {
  const terms = normalize(query)
    .replace(/[.,;:!?'’]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !STOP_WORDS.has(t));
  if (terms.length === 0) return [];
  const digits = query.replace(/\D/g, "");
  const clients = await ctx.store.list("clients");
  const scored = clients
    .map((c) => {
      const last = normalize(c.last_name);
      const first = normalize(c.first_name ?? "");
      const haystack = normalize([c.last_name, c.first_name, c.company, c.city, c.email, c.address].filter(Boolean).join(" "));
      let score = 0;
      for (const t of terms) {
        if (last === t) score += 10;
        else if (first === t) score += 4;
        else if (last.startsWith(t) && t.length >= 3) score += 6;
        else if (haystack.includes(t) && t.length >= 3) score += 2;
      }
      if (digits.length >= 6 && (c.phone ?? "").replace(/\D/g, "").includes(digits)) score += 10;
      return { c, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0) return [];
  // Si un nom de famille correspond exactement, on ne garde que les meilleurs résultats.
  const best = scored[0]!.score;
  return scored.filter((x) => x.score >= Math.min(best, 10) || best < 10).map((x) => x.c);
}

export async function createClient(ctx: AppContext, input: ClientInput): Promise<Client> {
  return ctx.store.insert("clients", { ...input, lat: null, lng: null });
}

export async function updateClient(ctx: AppContext, id: ID, input: Partial<ClientInput>): Promise<Client> {
  return ctx.store.update("clients", id, input);
}

/** Supprime le client ; ses interventions, devis et tâches sont conservés (détachés). */
export async function deleteClient(ctx: AppContext, id: ID): Promise<void> {
  const [appointments, quotes, tasks, notes] = await Promise.all([
    ctx.store.list("appointments", { eq: { client_id: id } }),
    ctx.store.list("quotes", { eq: { client_id: id } }),
    ctx.store.list("tasks", { eq: { client_id: id } }),
    ctx.store.list("client_notes", { eq: { client_id: id } }),
  ]);
  await Promise.all([
    ...appointments.map((a) => ctx.store.update("appointments", a.id, { client_id: null })),
    ...quotes.map((q) => ctx.store.update("quotes", q.id, { client_id: null })),
    ...tasks.map((t) => ctx.store.update("tasks", t.id, { client_id: null })),
    ...notes.map((n) => ctx.store.remove("client_notes", n.id)),
  ]);
  await ctx.store.remove("clients", id);
}

export interface ClientHistory {
  client: Client;
  appointments: Appointment[];
  quotes: Quote[];
  tasks: Task[];
  notes: ClientNote[];
}

export async function getClientHistory(ctx: AppContext, id: ID): Promise<ClientHistory | null> {
  const client = await getClient(ctx, id);
  if (!client) return null;
  const [appointments, quotes, tasks, notes] = await Promise.all([
    ctx.store.list("appointments", { eq: { client_id: id }, order: { column: "start_at", ascending: false } }),
    ctx.store.list("quotes", { eq: { client_id: id }, order: { column: "created_at", ascending: false } }),
    ctx.store.list("tasks", { eq: { client_id: id }, order: { column: "created_at", ascending: false } }),
    ctx.store.list("client_notes", { eq: { client_id: id }, order: { column: "created_at", ascending: false } }),
  ]);
  return { client, appointments, quotes, tasks, notes };
}

export async function addClientNote(ctx: AppContext, clientId: ID, content: string): Promise<ClientNote> {
  return ctx.store.insert("client_notes", { client_id: clientId, content, created_by: ctx.user.id });
}

export async function deleteClientNote(ctx: AppContext, id: ID): Promise<void> {
  await ctx.store.remove("client_notes", id);
}

/** Index id → client, pratique pour afficher les noms dans les listes. */
export async function clientIndex(ctx: AppContext): Promise<Map<ID, Client>> {
  const clients = await ctx.store.list("clients");
  return new Map(clients.map((c) => [c.id, c]));
}
