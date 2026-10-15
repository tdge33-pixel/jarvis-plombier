import { TaskBoard } from "@/components/tasks/task-board";
import { requireContext } from "@/lib/context";
import { today } from "@/lib/dates";
import { clientDisplayName } from "@/lib/format";
import { listClients } from "@/lib/services/clients";
import { getTaskGroups } from "@/lib/services/tasks";

export const metadata = { title: "Tâches" };

export default async function TachesPage() {
  const ctx = await requireContext();
  const [groups, clients] = await Promise.all([getTaskGroups(ctx), listClients(ctx)]);
  return <TaskBoard groups={groups} today={today(ctx.tz)} clients={clients.map((c) => ({ id: c.id, label: clientDisplayName(c, { withFirstName: true }) }))} />;
}
