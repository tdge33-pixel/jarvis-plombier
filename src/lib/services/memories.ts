import "server-only";
import type { AppContext } from "@/lib/context";
import type { ID, Memory, MemoryCategory, MemorySection } from "@/lib/domain/types";
import { addDays, localDate, localTime, today, timeToMinutes } from "@/lib/dates";
import { normalize } from "@/lib/format";

/**
 * Mémoire structurée de Jarvis (« Ce que Jarvis sait de moi »).
 *
 * Principe : pas de fine-tuning. Jarvis lit ces mémoires à chaque conversation.
 * Règle d'or : une mémoire INFERRED (déduite) ne devient JAMAIS une RULE
 * automatiquement. Elle reste « pending » jusqu'à validation explicite et devient
 * alors une PREFERENCE.
 */

export async function listMemories(ctx: AppContext): Promise<Memory[]> {
  const rows = await ctx.store.list("memories", { order: { column: "created_at", ascending: true } });
  return rows.filter((m) => m.status !== "rejected" && (m.user_id === null || m.user_id === ctx.user.id));
}

/** Mémoires utilisées par Jarvis : actives, non expirées, de l'entreprise ou de l'utilisateur courant. */
export async function activeMemories(ctx: AppContext): Promise<Memory[]> {
  const nowIso = new Date().toISOString();
  return (await listMemories(ctx)).filter((m) => m.status === "active" && m.category !== "INFERRED" && (!m.expires_at || m.expires_at > nowIso));
}

/** Suggestions en attente de validation (non reportées). */
export async function pendingSuggestions(ctx: AppContext): Promise<Memory[]> {
  const nowIso = new Date().toISOString();
  return (await listMemories(ctx)).filter((m) => m.status === "pending" && (!m.snoozed_until || m.snoozed_until <= nowIso));
}

/** Devine la section d'affichage à partir du contenu. */
export function guessSection(content: string, category: MemoryCategory): MemorySection {
  const t = normalize(content);
  if (/(€|eur|tarif|taux|ht\b|ttc|factur|prix|deplacement)/.test(t)) return "pricing";
  if (/(fournisseur|marque|cedeo|point p|atlantic|grohe|thermor|chez .* pour)/.test(t)) return "suppliers";
  if (category === "RULE" || /\b(jamais|toujours|interdit|pas de|ne .* pas|ne .* plus|aucun)\b/.test(t)) return "rules";
  if (category === "BUSINESS_INFO" || /(entreprise|siret|zone|horaire|salarie|seul)/.test(t)) return "business";
  if (/(habitude|souvent|d'habitude|en general|generalement)/.test(t)) return "habits";
  return "preferences";
}

export interface MemoryInput {
  content: string;
  category: Exclude<MemoryCategory, "INFERRED">;
  section?: MemorySection;
  personal?: boolean;
  expires_at?: string | null;
  source?: Memory["source"];
}

export async function addMemory(ctx: AppContext, input: MemoryInput): Promise<Memory> {
  const expires = input.category === "TEMPORARY" ? (input.expires_at ?? addDays(today(ctx.tz), 7) + "T23:59:00.000Z") : (input.expires_at ?? null);
  return ctx.store.insert("memories", {
    user_id: input.personal ? ctx.user.id : null,
    category: input.category,
    section: input.section ?? guessSection(input.content, input.category),
    content: input.content.trim(),
    key: null,
    status: "active",
    source: input.source ?? "user",
    confidence: null,
    evidence: null,
    snoozed_until: null,
    expires_at: expires,
  });
}

/** Jarvis propose une préférence déduite. Elle n'est PAS utilisée tant qu'elle n'est pas validée. */
export async function suggestInferredMemory(ctx: AppContext, input: { content: string; evidence: string; key?: string; section?: MemorySection; confidence?: number }): Promise<Memory> {
  if (input.key) {
    const existing = (await ctx.store.list("memories", { eq: { key: input.key } }))[0];
    if (existing) return existing;
  }
  return ctx.store.insert("memories", {
    user_id: null,
    category: "INFERRED",
    section: input.section ?? guessSection(input.content, "PREFERENCE"),
    content: input.content,
    key: input.key ?? null,
    status: "pending",
    source: "jarvis",
    confidence: input.confidence ?? null,
    evidence: input.evidence,
    snoozed_until: null,
    expires_at: null,
  });
}

/** Validation explicite par l'utilisateur : INFERRED → PREFERENCE (jamais RULE). */
export async function acceptSuggestion(ctx: AppContext, id: ID): Promise<Memory> {
  const m = await ctx.store.get("memories", id);
  if (!m) throw new Error("Mémoire introuvable");
  return ctx.store.update("memories", id, {
    category: m.category === "INFERRED" ? "PREFERENCE" : m.category,
    status: "active",
    snoozed_until: null,
  });
}

export async function rejectSuggestion(ctx: AppContext, id: ID): Promise<Memory> {
  return ctx.store.update("memories", id, { status: "rejected" });
}

export async function snoozeSuggestion(ctx: AppContext, id: ID, days = 7): Promise<Memory> {
  return ctx.store.update("memories", id, { snoozed_until: new Date(Date.now() + days * 86_400_000).toISOString() });
}

export async function updateMemory(ctx: AppContext, id: ID, patch: { content?: string; category?: Exclude<MemoryCategory, "INFERRED">; section?: MemorySection }): Promise<Memory> {
  const current = await ctx.store.get("memories", id);
  if (!current) throw new Error("Mémoire introuvable");
  // Une suggestion non validée ne peut pas être promue en règle par simple modification.
  if (current.category === "INFERRED" && current.status === "pending" && patch.category) {
    throw new Error("Validez d'abord la suggestion de Jarvis.");
  }
  return ctx.store.update("memories", id, patch);
}

export async function setMemoryEnabled(ctx: AppContext, id: ID, enabled: boolean): Promise<Memory> {
  return ctx.store.update("memories", id, { status: enabled ? "active" : "disabled" });
}

export async function deleteMemory(ctx: AppContext, id: ID): Promise<void> {
  await ctx.store.remove("memories", id);
}

/** Recherche simple par mots-clés (remplaçable plus tard par une recherche sémantique). */
export async function searchMemories(ctx: AppContext, query: string): Promise<Memory[]> {
  const all = await activeMemories(ctx);
  const terms = normalize(query)
    .split(/\s+/)
    .filter((t) => t.length >= 3);
  if (terms.length === 0) return all;
  const hits = all.filter((m) => {
    const text = normalize(m.content);
    return terms.some((t) => text.includes(t));
  });
  return hits;
}

/**
 * Détection de préférences implicites — règles simples pour la V1.
 * Exemple : plusieurs interventions après 18h annulées ⇒ suggestion « éviter après 18h ».
 * Le résultat est toujours une suggestion INFERRED en attente de validation.
 */
export async function detectInferredPreferences(ctx: AppContext): Promise<void> {
  const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const recent = await ctx.store.list("appointments", { gte: { start_at: since } });
  const lateCancelled = recent.filter((a) => a.status === "cancelled" && timeToMinutes(localTime(a.start_at, ctx.tz)) >= 18 * 60);
  if (lateCancelled.length >= 3) {
    const memories = await ctx.store.list("memories");
    const alreadyKnown = memories.some((m) => m.key === "inferred:avoid_after_18h" || (m.status === "active" && /apres 18 ?h/.test(normalize(m.content))));
    if (!alreadyKnown) {
      await suggestInferredMemory(ctx, {
        key: "inferred:avoid_after_18h",
        content: "J'évite les interventions qui commencent après 18h.",
        evidence: `${lateCancelled.length} interventions prévues après 18h ont été annulées ces 3 derniers mois (dernière le ${localDate(lateCancelled[lateCancelled.length - 1]!.start_at, ctx.tz).split("-").reverse().join("/")}).`,
        section: "preferences",
        confidence: Math.min(0.95, 0.5 + lateCancelled.length * 0.1),
      });
    }
  }
}
