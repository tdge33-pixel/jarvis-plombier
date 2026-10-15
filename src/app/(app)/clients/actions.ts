"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireContext } from "@/lib/context";
import { addClientNote, createClient, deleteClient, deleteClientNote, updateClient } from "@/lib/services/clients";

const nullable = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional()
  .transform((v) => v ?? null);

const schema = z.object({
  civility: z.enum(["M.", "Mme", ""]).transform((v) => (v === "" ? null : v)),
  first_name: nullable,
  last_name: z.string().trim().min(1, "Le nom est obligatoire"),
  company: nullable,
  phone: nullable,
  email: nullable.refine((v) => !v || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "Email invalide"),
  address: nullable,
  postal_code: nullable,
  city: nullable,
  notes: nullable,
  important_info: nullable,
});

export type ClientFormInput = z.input<typeof schema>;

export async function saveClientAction(id: string | null, input: ClientFormInput): Promise<{ error?: string; id?: string }> {
  const ctx = await requireContext();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  const client = id ? await updateClient(ctx, id, parsed.data) : await createClient(ctx, parsed.data);
  revalidatePath("/clients", "layout");
  return { id: client.id };
}

export async function deleteClientAction(id: string) {
  const ctx = await requireContext();
  await deleteClient(ctx, id);
  revalidatePath("/clients", "layout");
  redirect("/clients");
}

export async function addNoteAction(clientId: string, content: string) {
  const ctx = await requireContext();
  if (!content.trim()) return;
  await addClientNote(ctx, clientId, content.trim());
  revalidatePath(`/clients/${clientId}`);
}

export async function deleteNoteAction(clientId: string, noteId: string) {
  const ctx = await requireContext();
  await deleteClientNote(ctx, noteId);
  revalidatePath(`/clients/${clientId}`);
}
