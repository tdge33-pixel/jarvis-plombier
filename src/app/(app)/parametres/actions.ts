"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireContext } from "@/lib/context";
import { dataBackendKind } from "@/lib/data";
import { deleteConversation, listConversations } from "@/lib/services/conversations";

const opt = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable();

const time = z.string().regex(/^\d{2}:\d{2}$/, "Heure invalide");

function refresh() {
  revalidatePath("/", "layout");
}

export async function saveProfileAction(input: { first_name: string; last_name: string; phone: string }) {
  const ctx = await requireContext();
  const data = z.object({ first_name: z.string().trim().min(1), last_name: z.string().trim().min(1), phone: opt }).parse(input);
  await ctx.account.updateProfile(ctx.user.id, data);
  refresh();
}

export async function saveBusinessAction(input: Record<string, unknown>) {
  const ctx = await requireContext();
  const data = z
    .object({
      name: z.string().trim().min(1, "Nom requis"),
      phone: opt,
      email: opt,
      address: opt,
      postal_code: opt,
      city: opt,
      siret: opt,
      zone_radius_km: z.coerce.number().int().min(0).max(500).nullable(),
      works_alone: z.boolean(),
      team_size: z.coerce.number().int().min(1).max(500),
    })
    .parse(input);
  await ctx.account.updateBusiness(ctx.business.id, data);
  refresh();
}

export async function saveRatesAction(input: Record<string, unknown>) {
  const ctx = await requireContext();
  const data = z
    .object({
      hourly_rate: z.coerce.number().min(0),
      travel_fee: z.coerce.number().min(0),
      vat_rate: z.coerce.number().min(0).max(30),
      quote_validity_days: z.coerce.number().int().min(1).max(365),
    })
    .parse(input);
  await ctx.account.updateSettings(ctx.business.id, data);
  refresh();
}

export async function saveHoursAction(input: Record<string, unknown>) {
  const ctx = await requireContext();
  const data = z
    .object({
      work_start: time,
      work_end: time,
      working_days: z.array(z.number().int().min(1).max(7)),
      emergencies_accepted: z.boolean(),
      emergency_until: time.nullable(),
      max_appointments_per_day: z.coerce.number().int().min(1).max(30),
    })
    .parse(input);
  await ctx.account.updateSettings(ctx.business.id, data);
  refresh();
}

export async function savePermissionsAction(input: Record<string, boolean>) {
  const ctx = await requireContext();
  const data = z
    .object({
      auto_create_tasks: z.boolean(),
      create_appointments: z.boolean(),
      modify_appointments: z.boolean(),
      prepare_quotes: z.boolean(),
      save_preferences: z.boolean(),
      draft_messages: z.boolean(),
    })
    .parse(input);
  await ctx.account.updateSettings(ctx.business.id, { permissions: data });
  refresh();
}

export async function saveSignatureAction(signature: string) {
  const ctx = await requireContext();
  await ctx.account.updateSettings(ctx.business.id, { signature: signature.trim() || null });
  refresh();
}

export async function clearConversationsAction() {
  const ctx = await requireContext();
  const conversations = await listConversations(ctx);
  for (const c of conversations) await deleteConversation(ctx, c.id);
  refresh();
}

/** Mode démo uniquement : remet les données d'exemple à zéro. */
export async function resetDemoAction() {
  if (dataBackendKind() !== "demo") return;
  const { resetDemoDb } = await import("@/lib/data/demo/db");
  resetDemoDb();
  redirect("/connexion");
}
