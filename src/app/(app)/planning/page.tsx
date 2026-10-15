import { PlanningView } from "@/components/planning/planning-view";
import { requireContext } from "@/lib/context";
import { addDays, startOfWeek, today } from "@/lib/dates";
import { clientDisplayName } from "@/lib/format";
import { listAppointments } from "@/lib/services/appointments";
import { listClients } from "@/lib/services/clients";
import { getVertical } from "@/verticals";

export const metadata = { title: "Planning" };

export default async function PlanningPage({ searchParams }: { searchParams: Promise<{ view?: string; date?: string }> }) {
  const ctx = await requireContext();
  const sp = await searchParams;
  const view = sp.view === "week" || sp.view === "list" ? sp.view : "day";
  const t = today(ctx.tz);
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : t;

  const [from, to] = view === "day" ? [date, addDays(date, 1)] : view === "week" ? [startOfWeek(date), addDays(startOfWeek(date), 7)] : [date, addDays(date, 60)];
  const [appointments, clients] = await Promise.all([listAppointments(ctx, from, to, { includeCancelled: view !== "list" }), listClients(ctx)]);

  return (
    <PlanningView
      view={view}
      date={date}
      today={t}
      appointments={appointments}
      settings={{ work_start: ctx.settings.work_start, work_end: ctx.settings.work_end, max: ctx.settings.max_appointments_per_day }}
      clients={clients.map((c) => ({ id: c.id, label: `${clientDisplayName(c, { withFirstName: true })}${c.city ? ` — ${c.city}` : ""}`, address: c.address, city: c.city }))}
      interventionTypes={getVertical(ctx.business.vertical).interventionTypes.map((i) => ({ label: i.label, defaultDurationMinutes: i.defaultDurationMinutes }))}
    />
  );
}
