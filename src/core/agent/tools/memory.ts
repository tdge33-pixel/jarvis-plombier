import "server-only";
import { z } from "zod";
import { MEMORY_CATEGORY_LABELS, MEMORY_SECTION_LABELS } from "@/lib/domain/types";
import { addMemory, searchMemories, suggestInferredMemory } from "@/lib/services/memories";
import { defineTool } from "../types";

export const addMemoryTool = defineTool({
  name: "addMemory",
  intent: "ADD_MEMORY",
  level: 2,
  permission: "save_preferences",
  confirmation: "never",
  audit: true,
  description:
    "Mémoriser une information que l'utilisateur demande EXPLICITEMENT de retenir (« note que… », « retiens que… »). RULE = règle stricte, PREFERENCE = préférence, FACT = information, BUSINESS_INFO = info entreprise, CLIENT_INFO = info sur un client, TEMPORARY = valable quelques jours. Formule à la 1re personne.",
  schema: z.object({
    content: z.string().min(3).describe("Formulation à la première personne : « Je ne travaille pas le dimanche. »"),
    category: z.enum(["FACT", "PREFERENCE", "RULE", "BUSINESS_INFO", "CLIENT_INFO", "TEMPORARY"]),
    personal: z.boolean().optional().describe("Préférence personnelle de l'utilisateur plutôt que règle de l'entreprise"),
  }),
  async execute({ ctx }, args) {
    const m = await addMemory(ctx, { content: args.content, category: args.category, personal: args.personal, source: "user" });
    return {
      ok: true,
      summary: `C'est noté. Je retiens : « ${m.content} » (${MEMORY_CATEGORY_LABELS[m.category].toLowerCase()}, rubrique « ${MEMORY_SECTION_LABELS[m.section]} »).`,
      data: { id: m.id, category: m.category },
      blocks: [{ type: "memory", id: m.id, content: m.content, category: MEMORY_CATEGORY_LABELS[m.category], section: MEMORY_SECTION_LABELS[m.section] }],
    };
  },
});

export const suggestPreferenceTool = defineTool({
  name: "suggestPreference",
  intent: "SUGGEST_MEMORY",
  level: 1,
  permission: "save_preferences",
  confirmation: "never",
  audit: true,
  description:
    "Proposer à l'utilisateur de retenir une habitude que TU as remarquée (non demandée explicitement). Elle reste une suggestion tant qu'il ne l'a pas validée ; elle ne devient jamais une règle automatiquement.",
  schema: z.object({
    content: z.string().min(3).describe("Préférence formulée à la 1re personne"),
    evidence: z.string().min(3).describe("Ce qui t'a fait remarquer cette habitude"),
  }),
  async execute({ ctx }, args) {
    const m = await suggestInferredMemory(ctx, { content: args.content, evidence: args.evidence });
    return {
      ok: true,
      summary: `J'ai remarqué ceci : « ${m.content} » Souhaitez-vous que je retienne cette préférence ?`,
      data: { id: m.id, status: m.status },
      blocks: [{ type: "memory_suggestion", memoryId: m.id, content: m.content, evidence: m.evidence }],
    };
  },
});

export const searchMemoryTool = defineTool({
  name: "searchMemory",
  intent: "SEARCH_MEMORY",
  level: 1,
  confirmation: "never",
  audit: false,
  description: "Consulter ce que Jarvis sait de l'utilisateur (règles, préférences, tarifs, fournisseurs). Sans requête : tout.",
  schema: z.object({ query: z.string().optional() }),
  async execute({ ctx }, args) {
    const items = await searchMemories(ctx, args.query ?? "");
    const summary = items.length === 0 ? "Je n'ai rien mémorisé à ce sujet." : `Voici ce que je sais${args.query ? ` (« ${args.query} »)` : ""} :\n${items.map((m) => `• ${m.content}`).join("\n")}`;
    return {
      ok: true,
      summary,
      headline: summary.split("\n")[0],
      data: items.map((m) => ({ content: m.content, category: m.category })),
      blocks: [{ type: "memories", items: items.map((m) => ({ id: m.id, content: m.content, category: MEMORY_CATEGORY_LABELS[m.category], section: MEMORY_SECTION_LABELS[m.section] })) }],
    };
  },
});
