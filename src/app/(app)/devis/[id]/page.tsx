import { notFound } from "next/navigation";
import { QuoteEditor } from "@/components/quotes/quote-editor";
import { requireContext } from "@/lib/context";
import { formatShortDate } from "@/lib/dates";
import { clientAddressLine, clientDisplayName } from "@/lib/format";
import { listClients } from "@/lib/services/clients";
import { getQuote } from "@/lib/services/quotes";

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext();
  const { id } = await params;
  const isNew = id === "nouveau";
  const [data, clients] = await Promise.all([isNew ? Promise.resolve(null) : getQuote(ctx, id), listClients(ctx)]);
  if (!isNew && !data) notFound();

  return (
    <QuoteEditor
      id={isNew ? null : id}
      number={data?.quote.number ?? null}
      validUntil={data?.quote.valid_until ? formatShortDate(data.quote.valid_until) : null}
      createdByAi={data?.quote.created_by === "ai"}
      initial={{
        client_id: data?.quote.client_id ?? null,
        title: data?.quote.title ?? "",
        description: data?.quote.description ?? "",
        notes: data?.quote.notes ?? "",
        vat_rate: data?.quote.vat_rate ?? ctx.settings.vat_rate,
        status: data?.quote.status ?? "draft",
        items: data?.items.map((i) => ({ kind: i.kind, label: i.label, quantity: i.quantity, unit_price: i.unit_price })) ?? [
          { kind: "labor", label: "Main-d'œuvre", quantity: 1, unit_price: ctx.settings.hourly_rate },
          ...(ctx.settings.travel_fee > 0 ? [{ kind: "travel" as const, label: "Déplacement", quantity: 1, unit_price: ctx.settings.travel_fee }] : []),
        ],
      }}
      business={{ name: ctx.business.name, address: [ctx.business.address, [ctx.business.postal_code, ctx.business.city].filter(Boolean).join(" ")].filter(Boolean).join(", "), siret: ctx.business.siret, phone: ctx.business.phone, email: ctx.business.email }}
      rates={{ hourly: ctx.settings.hourly_rate, travel: ctx.settings.travel_fee }}
      clients={clients.map((c) => ({ id: c.id, label: clientDisplayName(c, { withFirstName: true }), address: clientAddressLine(c), email: c.email }))}
    />
  );
}
