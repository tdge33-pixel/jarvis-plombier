import "server-only";
import { z } from "zod";
import { formatDayFr, relativeDayFr, today } from "@/lib/dates";
import { clientDisplayName } from "@/lib/format";
import { createTask, getTaskGroups } from "@/lib/services/tasks";
import { defineTool } from "../types";
import { resolveClient } from "./helpers";

const schema = z.object({
  title: z.string().min(1).describe("Intitulé court, à l'infinitif : « Rappeler M. Dupont »"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Échéance AAAA-MM-JJ"),
  priority: z.enum(["normal", "high"]).optional(),
  client: z.string().optional().describe("Client concerné (facultatif)"),
});

export const createTaskTool = defineTool({
  name: "createTask",
  intent: "CREATE_TASK",
  level: 2,
  permission: "auto_create_tasks",
  confirmation: (p) => !p.auto_create_tasks,
  audit: true,
  description: "Créer une tâche / un rappel dans la liste de choses à faire.",
  schema,
  async prepare({ ctx }, args) {
    return {
      kind: "confirm",
      args,
      title: "Nouvelle tâche",
      question: `J'ajoute la tâche « ${args.title} » ?`,
      lines: [`Tâche : ${args.title}`, `Échéance : ${args.dueDate ? formatDayFr(args.dueDate) : "aucune"}`, ...(args.client ? [`Client : ${args.client}`] : [])],
      warnings: [],
      fields: [
        { key: "title", label: "Tâche", type: "text", value: args.title },
        { key: "dueDate", label: "Échéance", type: "date", value: args.dueDate ?? today(ctx.tz) },
      ],
    };
  },
  async execute({ ctx }, args) {
    let clientId: string | null = null;
    let clientName: string | null = null;
    if (args.client) {
      const res = await resolveClient(ctx, args.client);
      if (res.kind === "one") {
        clientId = res.client.id;
        clientName = clientDisplayName(res.client);
      }
    }
    const task = await createTask(ctx, { title: args.title, due_date: args.dueDate ?? null, priority: args.priority ?? "normal", client_id: clientId, created_by: "ai" });
    const when = task.due_date ? ` pour ${relativeDayFr(task.due_date, ctx.tz)}` : "";
    return {
      ok: true,
      summary: `Tâche ajoutée${when} : « ${task.title} ».`,
      data: { id: task.id },
      blocks: [{ type: "task", id: task.id, title: task.title, due_date: task.due_date, priority: task.priority, client_name: clientName }],
    };
  },
});

export const listTasksTool = defineTool({
  name: "listTasks",
  intent: "LIST_TASKS",
  level: 1,
  confirmation: "never",
  audit: false,
  description: "Lister les tâches : today (aujourd'hui), overdue (en retard), upcoming (à venir) ou all.",
  schema: z.object({ scope: z.enum(["today", "overdue", "upcoming", "all"]).optional() }),
  async execute({ ctx }, args) {
    const g = await getTaskGroups(ctx);
    const scope = args.scope ?? "all";
    const items = scope === "today" ? g.today : scope === "overdue" ? g.overdue : scope === "upcoming" ? g.upcoming : [...g.overdue, ...g.today, ...g.upcoming];
    const title = { today: "Tâches du jour", overdue: "Tâches en retard", upcoming: "Tâches à venir", all: "Tâches à faire" }[scope];
    const summary = items.length === 0 ? "Rien à faire de ce côté-là." : `${title} (${items.length}) :\n${items.slice(0, 10).map((t) => `• ${t.title}`).join("\n")}`;
    return {
      ok: true,
      summary,
      headline: summary.split("\n")[0],
      data: items.map((t) => ({ id: t.id, title: t.title, due: t.due_date, priority: t.priority })),
      blocks: [{ type: "tasks", title, items: items.slice(0, 10).map((t) => ({ id: t.id, title: t.title, due_date: t.due_date, priority: t.priority, client_name: t.client_name })) }],
    };
  },
});
