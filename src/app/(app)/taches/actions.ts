"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireContext } from "@/lib/context";
import { createTask, deleteTask, setTaskDone, updateTask } from "@/lib/services/tasks";

const schema = z.object({
  title: z.string().trim().min(1, "Intitulé requis"),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
  priority: z.enum(["normal", "high"]).optional(),
  client_id: z
    .string()
    .nullable()
    .optional()
    .transform((v) => v || null),
});

function refresh() {
  revalidatePath("/taches");
  revalidatePath("/");
}

export async function createTaskAction(input: z.input<typeof schema>): Promise<{ error?: string }> {
  const ctx = await requireContext();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  await createTask(ctx, { ...parsed.data, created_by: "user" });
  refresh();
  return {};
}

export async function updateTaskAction(id: string, input: z.input<typeof schema>): Promise<{ error?: string }> {
  const ctx = await requireContext();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  await updateTask(ctx, id, parsed.data);
  refresh();
  return {};
}

export async function toggleTaskAction(id: string, done: boolean) {
  const ctx = await requireContext();
  await setTaskDone(ctx, id, done);
  refresh();
}

export async function deleteTaskAction(id: string) {
  const ctx = await requireContext();
  await deleteTask(ctx, id);
  refresh();
}
