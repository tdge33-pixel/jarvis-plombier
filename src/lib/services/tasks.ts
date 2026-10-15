import "server-only";
import type { AppContext } from "@/lib/context";
import type { ID, ISODate, Task, TaskPriority } from "@/lib/domain/types";
import { today } from "@/lib/dates";
import { clientDisplayName } from "@/lib/format";
import { clientIndex } from "./clients";

export interface TaskView extends Task {
  client_name: string | null;
}

export interface TaskGroups {
  overdue: TaskView[];
  today: TaskView[];
  upcoming: TaskView[];
  done: TaskView[];
}

export async function listTasks(ctx: AppContext): Promise<TaskView[]> {
  const [rows, clients] = await Promise.all([ctx.store.list("tasks", { order: { column: "created_at", ascending: false } }), clientIndex(ctx)]);
  return rows.map((t) => {
    const c = t.client_id ? clients.get(t.client_id) : undefined;
    return { ...t, client_name: c ? clientDisplayName(c) : null };
  });
}

export function groupTasks(tasks: TaskView[], todayDate: ISODate): TaskGroups {
  const byDue = (a: TaskView, b: TaskView) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") || (a.priority === "high" ? -1 : 1);
  const open = tasks.filter((t) => t.status === "todo");
  return {
    overdue: open.filter((t) => t.due_date && t.due_date < todayDate).sort(byDue),
    today: open.filter((t) => t.due_date === todayDate).sort((a, b) => (a.priority === b.priority ? 0 : a.priority === "high" ? -1 : 1)),
    upcoming: open.filter((t) => !t.due_date || t.due_date > todayDate).sort(byDue),
    done: tasks
      .filter((t) => t.status === "done")
      .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""))
      .slice(0, 30),
  };
}

export async function getTaskGroups(ctx: AppContext): Promise<TaskGroups> {
  return groupTasks(await listTasks(ctx), today(ctx.tz));
}

export interface TaskInput {
  title: string;
  description?: string | null;
  due_date?: ISODate | null;
  priority?: TaskPriority;
  client_id?: ID | null;
  quote_id?: ID | null;
  created_by?: "user" | "ai";
}

export async function createTask(ctx: AppContext, input: TaskInput): Promise<Task> {
  return ctx.store.insert("tasks", {
    title: input.title,
    description: input.description ?? null,
    due_date: input.due_date ?? null,
    priority: input.priority ?? "normal",
    status: "todo",
    client_id: input.client_id ?? null,
    quote_id: input.quote_id ?? null,
    created_by: input.created_by ?? "user",
    completed_at: null,
  });
}

export async function updateTask(ctx: AppContext, id: ID, patch: Partial<TaskInput>): Promise<Task> {
  return ctx.store.update("tasks", id, patch);
}

export async function setTaskDone(ctx: AppContext, id: ID, done: boolean): Promise<Task> {
  return ctx.store.update("tasks", id, { status: done ? "done" : "todo", completed_at: done ? new Date().toISOString() : null });
}

export async function deleteTask(ctx: AppContext, id: ID): Promise<void> {
  await ctx.store.remove("tasks", id);
}
