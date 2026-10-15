"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireContext } from "@/lib/context";
import { checkAvailability, createAppointment, deleteAppointment, updateAppointment } from "@/lib/services/appointments";

const schema = z.object({
  client_id: z.string().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  duration_minutes: z.coerce.number().int().min(15).max(720),
  intervention_type: z.string().trim().min(1, "Type d'intervention requis"),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  status: z.enum(["to_confirm", "confirmed", "in_progress", "done", "cancelled"]),
  notes: z.string().nullable().optional(),
});

export type AppointmentFormInput = z.input<typeof schema>;

function refresh() {
  revalidatePath("/planning");
  revalidatePath("/");
  revalidatePath("/clients", "layout");
}

export async function saveAppointmentAction(id: string | null, input: AppointmentFormInput): Promise<{ error?: string; warnings?: string[] }> {
  const ctx = await requireContext();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  const data = { ...parsed.data, address: parsed.data.address || null, city: parsed.data.city || null, notes: parsed.data.notes || null };
  const av = await checkAvailability(ctx, data.date, data.time, data.duration_minutes, id ?? undefined);
  if (id) await updateAppointment(ctx, id, data);
  else await createAppointment(ctx, data);
  refresh();
  return { warnings: [...av.conflicts.map((c) => `Chevauche le rendez-vous de ${c.client_name ?? "sans client"} à ${c.time}.`), ...av.warnings] };
}

export async function deleteAppointmentAction(id: string) {
  const ctx = await requireContext();
  await deleteAppointment(ctx, id);
  refresh();
}

export async function setAppointmentStatusAction(id: string, status: "to_confirm" | "confirmed" | "in_progress" | "done" | "cancelled") {
  const ctx = await requireContext();
  await updateAppointment(ctx, id, { status });
  refresh();
}
