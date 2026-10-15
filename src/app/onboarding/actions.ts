"use server";

import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/context";
import { getBackend } from "@/lib/data";
import type { MemoryCategory, MemorySection } from "@/lib/domain/types";
import { DEFAULT_VERTICAL, getVertical } from "@/verticals";

type Answers = Record<string, unknown>;

const DAY_NAMES = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const num = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(",", ".").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
};
const list = (v: unknown) =>
  (Array.isArray(v) ? v.map(String) : str(v).split(/[,;\n]|\bet\b/))
    .map((s) => s.trim())
    .filter(Boolean);

/** "20h", "20h30", "20:00" → "20:00" */
function toTime(v: unknown, fallback: string): string {
  const m = str(v).match(/(\d{1,2})\s*[h:]\s*(\d{2})?/i);
  return m ? `${m[1]!.padStart(2, "0")}:${m[2] ?? "00"}` : fallback;
}

/**
 * Transforme les réponses de l'onboarding en :
 *  - profil d'entreprise + paramètres (données structurées) ;
 *  - premières mémoires de Jarvis (source « onboarding »).
 */
export async function completeOnboardingAction(answers: Answers): Promise<{ error?: string }> {
  const user = await getAuthUser();
  if (!user) redirect("/connexion");
  const backend = await getBackend();
  const account = await backend.account();
  if (await account.getMembership(user.id)) redirect("/");

  const vertical = getVertical(DEFAULT_VERTICAL);
  const name = str(answers.business_name);
  if (!name) return { error: "Le nom de l'entreprise est nécessaire." };

  const worksAlone = answers.works_alone !== false;
  const city = str(answers.city) || null;
  const radius = num(answers.zone_radius_km);
  const hours = (answers.hours ?? {}) as { start?: string; end?: string };
  const workStart = toTime(hours.start, "08:00");
  const workEnd = toTime(hours.end, "18:00");
  const dayLabels = list(answers.working_days).map((d) => d.toLowerCase());
  const workingDays = dayLabels.length ? DAY_NAMES.map((d, i) => (dayLabels.includes(d) ? i + 1 : 0)).filter(Boolean) : [1, 2, 3, 4, 5];
  const emergencies = answers.emergencies === true;
  const emergencyUntil = emergencies ? toTime(answers.emergency_until, "20:00") : null;
  const hourly = num(answers.hourly_rate) ?? 60;
  const travel = answers.charges_travel === true ? (num(answers.travel_fee) ?? 30) : 0;
  const services = list(answers.services);
  const refused = list(answers.refused_services);
  const suppliers = list(answers.suppliers);
  const brand = str(answers.preferred_brand);

  const business = await account.createBusiness(user.id, {
    name,
    vertical: vertical.id,
    business: {
      city,
      works_alone: worksAlone,
      team_size: worksAlone ? 1 : (num(answers.team_size) ?? 2),
      zone_radius_km: radius,
      onboarded_at: new Date().toISOString(),
    },
    settings: {
      hourly_rate: hourly,
      travel_fee: travel,
      work_start: workStart,
      work_end: workEnd,
      working_days: workingDays,
      emergencies_accepted: emergencies,
      emergency_until: emergencyUntil,
      services: services.length ? services : vertical.defaultServices,
      refused_services: refused,
      suppliers,
      calendar_tool: str(answers.calendar_tool) || null,
      invoicing_tool: str(answers.invoicing_tool) || null,
    },
  });

  const fmt = (t: string) => t.replace(":", "h");
  const memories: Array<{ content: string; category: MemoryCategory; section: MemorySection }> = [
    { content: worksAlone ? "Je travaille seul." : `Nous sommes ${num(answers.team_size) ?? 2} dans l'entreprise.`, category: "FACT", section: "business" },
    ...(radius ? [{ content: `Zone d'intervention : ${radius} km${city ? ` autour de ${city}` : ""}.`, category: "BUSINESS_INFO" as const, section: "business" as const }] : []),
    { content: `Horaires : ${fmt(workStart)} - ${fmt(workEnd)}.`, category: "BUSINESS_INFO", section: "business" },
    ...DAY_NAMES.filter((_, i) => !workingDays.includes(i + 1)).map((d) => ({ content: `Je ne travaille pas le ${d}.`, category: "RULE" as const, section: "rules" as const })),
    { content: emergencies ? `Urgences acceptées jusqu'à ${fmt(emergencyUntil ?? "20:00")}.` : "Je ne prends pas d'urgences.", category: emergencies ? "BUSINESS_INFO" : "RULE", section: emergencies ? "business" : "rules" },
    { content: `Je facture ${hourly} € HT / heure.`, category: "BUSINESS_INFO", section: "pricing" },
    { content: travel ? `Déplacement : ${travel} €.` : "Je ne facture pas les déplacements.", category: "BUSINESS_INFO", section: "pricing" },
    ...(refused.length ? [{ content: `Je refuse les interventions suivantes : ${refused.join(", ")}.`, category: "RULE" as const, section: "rules" as const }] : []),
    ...(suppliers.length ? [{ content: `Mes fournisseurs : ${suppliers.join(", ")}.`, category: "FACT" as const, section: "suppliers" as const }] : []),
    ...(brand ? [{ content: `Je préfère ${brand} pour les chauffe-eaux.`, category: "PREFERENCE" as const, section: "suppliers" as const }] : []),
  ];
  const store = await backend.tenant(business.id);
  for (const m of memories) {
    await store.insert("memories", { ...m, user_id: null, key: null, status: "active", source: "onboarding", confidence: null, evidence: null, snoozed_until: null, expires_at: null });
  }
  redirect("/");
}
