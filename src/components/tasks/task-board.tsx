"use client";

import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { createTaskAction, deleteTaskAction, toggleTaskAction, updateTaskAction } from "@/app/(app)/taches/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/misc";
import { relativeDayFr } from "@/lib/dates";
import { cn } from "@/lib/format";
import type { TaskGroups, TaskView } from "@/lib/services/tasks";

type ClientOption = { id: string; label: string };

export function TaskBoard({ groups, today, clients }: { groups: TaskGroups; today: string; clients: ClientOption[] }) {
  const [tab, setTab] = useState<"today" | "upcoming" | "overdue" | "done">(groups.overdue.length && !groups.today.length ? "overdue" : "today");
  const tabs = [
    { key: "today", label: "Aujourd'hui", items: groups.today },
    { key: "upcoming", label: "À venir", items: groups.upcoming },
    { key: "overdue", label: "En retard", items: groups.overdue },
    { key: "done", label: "Terminées", items: groups.done },
  ] as const;
  const current = tabs.find((t) => t.key === tab)!;

  return (
    <div>
      <PageHeader title="Mes tâches" subtitle="Ce qu'il ne faut pas oublier. Jarvis peut aussi en ajouter pour vous." />
      <QuickAdd today={today} clients={clients} />
      <div className="my-5 flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium",
              tab === t.key ? "border-night bg-night text-white" : "border-line bg-white text-muted hover:text-ink",
            )}
          >
            {t.label}
            <span className={cn("rounded-full px-1.5 text-xs", t.key === "overdue" && t.items.length ? "bg-red-500 text-white" : tab === t.key ? "bg-white/20" : "bg-slate-100")}>{t.items.length}</span>
          </button>
        ))}
      </div>
      {current.items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-white/60 p-8 text-center text-muted">{tab === "overdue" ? "Rien en retard, bravo !" : "Aucune tâche ici."}</p>
      ) : (
        <Card className="divide-y divide-line">
          {current.items.map((t) => (
            <TaskRow key={t.id} task={t} today={today} />
          ))}
        </Card>
      )}
    </div>
  );
}

function QuickAdd({ today, clients }: { today: string; clients: ClientOption[] }) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState(today);
  const [priority, setPriority] = useState<"normal" | "high">("normal");
  const [clientId, setClientId] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        start(async () => {
          await createTaskAction({ title, due_date: due || null, priority, client_id: clientId || null });
          setTitle("");
          setPriority("normal");
          setClientId("");
        });
      }}
      className="flex flex-col gap-2 rounded-2xl border border-line bg-white p-2 shadow-card md:flex-row"
    >
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nouvelle tâche : rappeler M. Dupont, commander…" className="border-0 focus:ring-0 md:flex-1" />
      <div className="flex flex-wrap gap-2">
        <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="w-auto" aria-label="Échéance" />
        <Select value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-auto max-w-44" aria-label="Client">
          <option value="">Client…</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </Select>
        <Select value={priority} onChange={(e) => setPriority(e.target.value as "normal" | "high")} className="w-auto" aria-label="Priorité">
          <option value="normal">Normale</option>
          <option value="high">Importante</option>
        </Select>
        <Button type="submit" disabled={pending || !title.trim()}>
          <Plus className="size-4" /> Ajouter
        </Button>
      </div>
    </form>
  );
}

function TaskRow({ task, today }: { task: TaskView; today: string }) {
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [due, setDue] = useState(task.due_date ?? "");
  const done = task.status === "done";
  const late = !done && task.due_date && task.due_date < today;

  if (editing) {
    return (
      <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} className="flex-1" autoFocus />
        <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="w-auto" />
        <div className="flex gap-1">
          <Button size="sm" onClick={() => start(async () => {
            await updateTaskAction(task.id, { title, due_date: due || null, priority: task.priority, client_id: task.client_id });
            setEditing(false);
          })}>
            <Check className="size-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            <X className="size-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-3 px-4 py-3", pending && "opacity-60")}>
      <button
        onClick={() => start(() => toggleTaskAction(task.id, !done))}
        className={cn("grid size-7 shrink-0 place-items-center rounded-lg border-2 transition", done ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 hover:border-brand-400")}
        aria-label={done ? "Marquer comme à faire" : "Marquer comme terminée"}
      >
        {done && <Check className="size-4" />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn("font-medium", done && "text-muted line-through")}>{task.title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-muted">
          {task.due_date && <span className={cn(late && "font-medium text-red-600")}>{late ? "En retard · " : ""}{relativeDayFr(task.due_date)}</span>}
          {task.client_name && <span>· {task.client_name}</span>}
          {task.priority === "high" && !done && <Badge tone="amber">Important</Badge>}
          {task.created_by === "ai" && <Badge tone="violet">Créée par Jarvis</Badge>}
        </p>
      </div>
      <button onClick={() => setEditing(true)} className="grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-ink" aria-label="Modifier">
        <Pencil className="size-4" />
      </button>
      <button onClick={() => confirm("Supprimer cette tâche ?") && start(() => deleteTaskAction(task.id))} className="grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Supprimer">
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}
