import { FileText, Plus } from "lucide-react";
import Link from "next/link";
import { Badge, QUOTE_TONES } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requireContext } from "@/lib/context";
import { QUOTE_STATUS_LABELS, type QuoteStatus } from "@/lib/domain/types";
import { formatShortDate, localDate } from "@/lib/dates";
import { cn, formatEuro } from "@/lib/format";
import { listQuotes } from "@/lib/services/quotes";

export const metadata = { title: "Devis" };

const FILTERS: Array<{ key: QuoteStatus | "all"; label: string }> = [
  { key: "all", label: "Tous" },
  { key: "draft", label: "Brouillons" },
  { key: "sent", label: "Envoyés" },
  { key: "accepted", label: "Acceptés" },
  { key: "refused", label: "Refusés" },
  { key: "expired", label: "Expirés" },
];

export default async function DevisPage({ searchParams }: { searchParams: Promise<{ statut?: string }> }) {
  const ctx = await requireContext();
  const { statut } = await searchParams;
  const all = await listQuotes(ctx);
  const filter = FILTERS.find((f) => f.key === statut)?.key ?? "all";
  const quotes = filter === "all" ? all : all.filter((q) => q.status === filter);
  const pendingTotal = all.filter((q) => q.status === "sent").reduce((s, q) => s + q.total_ttc, 0);

  return (
    <div>
      <PageHeader
        title="Mes devis"
        subtitle={pendingTotal > 0 ? `${formatEuro(pendingTotal)} TTC en attente de réponse` : "Préparez vos devis ici ou demandez à Jarvis."}
        actions={
          <ButtonLink href="/devis/nouveau">
            <Plus className="size-4" /> Nouveau devis
          </ButtonLink>
        }
      />
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => {
          const count = f.key === "all" ? all.length : all.filter((q) => q.status === f.key).length;
          return (
            <Link
              key={f.key}
              href={f.key === "all" ? "/devis" : `/devis?statut=${f.key}`}
              className={cn("flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium", filter === f.key ? "border-night bg-night text-white" : "border-line bg-white text-muted hover:text-ink")}
            >
              {f.label} <span className="opacity-60">{count}</span>
            </Link>
          );
        })}
      </div>
      {quotes.length === 0 ? (
        <EmptyState icon={<FileText className="size-6" />} title="Aucun devis ici" text="Essayez : « Prépare un devis pour Mme Martin : remplacement mitigeur, 1h de main-d'œuvre, mitigeur 95 € »." />
      ) : (
        <Card className="divide-y divide-line">
          {quotes.map((q) => (
            <Link key={q.id} href={`/devis/${q.id}`} className="flex items-center gap-4 px-4 py-3.5 hover:bg-slate-50">
              <span className="hidden w-28 shrink-0 text-sm text-muted sm:block">
                <span className="block font-medium text-ink">{q.number}</span>
                {formatShortDate(localDate(q.created_at, ctx.tz))}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{q.client_name ?? "Client non précisé"}</span>
                <span className="block truncate text-sm text-muted">{q.title}</span>
                {q.status === "sent" && q.days_since_sent !== null && (
                  <span className={cn("text-xs", q.days_since_sent >= 10 ? "font-medium text-amber-700" : "text-muted")}>Envoyé il y a {q.days_since_sent} jour{q.days_since_sent > 1 ? "s" : ""}</span>
                )}
                {q.created_by === "ai" && q.status === "draft" && <span className="text-xs text-brand-600">Préparé par Jarvis · à relire</span>}
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-semibold tabular-nums">{formatEuro(q.total_ttc)}</span>
                <Badge tone={QUOTE_TONES[q.status]}>{QUOTE_STATUS_LABELS[q.status]}</Badge>
              </span>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
