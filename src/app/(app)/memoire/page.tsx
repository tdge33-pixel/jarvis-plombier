import { MemoryManager } from "@/components/memory/memory-manager";
import { requireContext } from "@/lib/context";
import { weekdayNameFr } from "@/lib/dates";
import { formatEuro } from "@/lib/format";
import { detectInferredPreferences, listMemories, pendingSuggestions } from "@/lib/services/memories";

export const metadata = { title: "Ce que Jarvis sait de moi" };

export default async function MemoirePage() {
  const ctx = await requireContext();
  await detectInferredPreferences(ctx);
  const [memories, suggestions] = await Promise.all([listMemories(ctx), pendingSuggestions(ctx)]);
  const s = ctx.settings;

  // Informations structurées issues des paramètres (affichées en tête des rubriques).
  const facts = {
    business: [
      `Entreprise : ${ctx.business.name}${ctx.business.city ? ` (${ctx.business.city})` : ""}`,
      ...(ctx.business.zone_radius_km ? [`Zone maximale : ${ctx.business.zone_radius_km} km`] : []),
      `Horaires : ${s.work_start.replace(":", "h")} - ${s.work_end.replace(":", "h")}, ${s.working_days.map(weekdayNameFr).join(", ")}`,
      `Urgences : ${s.emergencies_accepted ? `acceptées jusqu'à ${(s.emergency_until ?? s.work_end).replace(":", "h")}` : "non acceptées"}`,
    ],
    pricing: [`Tarif horaire : ${formatEuro(s.hourly_rate)} HT`, `Déplacement : ${formatEuro(s.travel_fee)}`, `TVA par défaut : ${s.vat_rate} %`],
    suppliers: s.suppliers.length ? [`Fournisseurs : ${s.suppliers.join(", ")}`] : [],
  };

  return (
    <MemoryManager
      memories={memories.filter((m) => m.status !== "pending").map((m) => ({ id: m.id, content: m.content, category: m.category, section: m.section, status: m.status, source: m.source, personal: m.user_id !== null }))}
      suggestions={suggestions.map((m) => ({ id: m.id, content: m.content, evidence: m.evidence }))}
      facts={facts}
    />
  );
}
