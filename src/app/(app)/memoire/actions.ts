"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireContext } from "@/lib/context";
import { MEMORY_SECTIONS } from "@/lib/domain/types";
import {
  acceptSuggestion,
  addMemory,
  deleteMemory,
  rejectSuggestion,
  setMemoryEnabled,
  snoozeSuggestion,
  updateMemory,
} from "@/lib/services/memories";

const categories = z.enum(["FACT", "PREFERENCE", "RULE", "BUSINESS_INFO", "CLIENT_INFO", "TEMPORARY"]);

function refresh() {
  revalidatePath("/memoire");
  revalidatePath("/");
}

export async function addMemoryAction(input: { content: string; category: string; section?: string; personal?: boolean }) {
  const ctx = await requireContext();
  const data = z
    .object({ content: z.string().trim().min(3), category: categories, section: z.enum(MEMORY_SECTIONS).optional(), personal: z.boolean().optional() })
    .parse(input);
  await addMemory(ctx, { ...data, source: "user" });
  refresh();
}

export async function updateMemoryAction(id: string, input: { content: string; category?: string; section?: string }) {
  const ctx = await requireContext();
  const data = z.object({ content: z.string().trim().min(3), category: categories.optional(), section: z.enum(MEMORY_SECTIONS).optional() }).parse(input);
  await updateMemory(ctx, id, data);
  refresh();
}

export async function toggleMemoryAction(id: string, enabled: boolean) {
  const ctx = await requireContext();
  await setMemoryEnabled(ctx, id, enabled);
  refresh();
}

export async function deleteMemoryAction(id: string) {
  const ctx = await requireContext();
  await deleteMemory(ctx, id);
  refresh();
}

/** Réponse à « Souhaitez-vous que je retienne cette préférence ? » */
export async function answerSuggestionAction(id: string, answer: "yes" | "no" | "later") {
  const ctx = await requireContext();
  if (answer === "yes") await acceptSuggestion(ctx, id);
  else if (answer === "no") await rejectSuggestion(ctx, id);
  else await snoozeSuggestion(ctx, id);
  refresh();
}
