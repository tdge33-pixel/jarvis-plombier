"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireContext } from "@/lib/context";
import { createQuote, deleteQuote, setQuoteStatus, updateQuote } from "@/lib/services/quotes";

const itemSchema = z.object({
  kind: z.enum(["labor", "material", "travel", "other"]),
  label: z.string().trim().min(1, "Chaque ligne doit avoir un libellé"),
  quantity: z.coerce.number().min(0),
  unit_price: z.coerce.number().min(0),
});

const schema = z.object({
  client_id: z.string().nullable(),
  title: z.string().trim().min(1, "L'objet du devis est obligatoire"),
  description: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  vat_rate: z.coerce.number().min(0).max(30),
  status: z.enum(["draft", "sent", "accepted", "refused", "expired"]).optional(),
  items: z.array(itemSchema),
});

export type QuoteFormInput = z.input<typeof schema>;

function refresh(id?: string) {
  revalidatePath("/devis");
  if (id) revalidatePath(`/devis/${id}`);
  revalidatePath("/");
}

export async function saveQuoteAction(id: string | null, input: QuoteFormInput): Promise<{ error?: string; id?: string }> {
  const ctx = await requireContext();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  const data = { ...parsed.data, description: parsed.data.description || null, notes: parsed.data.notes || null };
  if (id) {
    await updateQuote(ctx, id, data);
    refresh(id);
    return { id };
  }
  const { quote } = await createQuote(ctx, { ...data, created_by: "user" });
  refresh(quote.id);
  return { id: quote.id };
}

/** Changement de statut manuel (le passage à « Envoyé » est confirmé explicitement dans l'interface). */
export async function setQuoteStatusAction(id: string, status: "draft" | "sent" | "accepted" | "refused" | "expired") {
  const ctx = await requireContext();
  await setQuoteStatus(ctx, id, status);
  refresh(id);
}

export async function deleteQuoteAction(id: string) {
  const ctx = await requireContext();
  await deleteQuote(ctx, id);
  refresh();
  redirect("/devis");
}
