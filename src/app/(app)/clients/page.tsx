import { ClientsList } from "@/components/clients/clients-list";
import { requireContext } from "@/lib/context";
import { localDate } from "@/lib/dates";
import { clientAddressLine, clientDisplayName } from "@/lib/format";
import { listClients } from "@/lib/services/clients";

export const metadata = { title: "Clients" };

export default async function ClientsPage() {
  const ctx = await requireContext();
  const [clients, appointments] = await Promise.all([listClients(ctx), ctx.store.list("appointments", { order: { column: "start_at", ascending: false } })]);
  const nowIso = new Date().toISOString();
  const lastVisit = new Map<string, string>();
  for (const a of appointments) {
    if (a.client_id && a.status === "done" && a.start_at <= nowIso && !lastVisit.has(a.client_id)) lastVisit.set(a.client_id, localDate(a.start_at, ctx.tz));
  }
  return (
    <ClientsList
      clients={clients.map((c) => ({
        id: c.id,
        name: clientDisplayName(c, { withFirstName: true }),
        initials: `${(c.first_name ?? "").charAt(0)}${c.last_name.charAt(0)}`.toUpperCase(),
        phone: c.phone,
        email: c.email,
        address: clientAddressLine(c),
        city: c.city,
        important: c.important_info,
        lastVisit: lastVisit.get(c.id) ?? null,
      }))}
    />
  );
}
