"use client";

import { ChevronLeft, Plus, Printer, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { deleteQuoteAction, saveQuoteAction, setQuoteStatusAction, type QuoteFormInput } from "@/app/(app)/devis/actions";
import { Badge, QUOTE_TONES } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { QUOTE_STATUS_LABELS, type QuoteItemKind, type QuoteStatus } from "@/lib/domain/types";
import { formatEuro, round2 } from "@/lib/format";

interface Item {
  kind: QuoteItemKind;
  label: string;
  quantity: number;
  unit_price: number;
}

interface Props {
  id: string | null;
  number: string | null;
  validUntil: string | null;
  createdByAi: boolean;
  initial: Omit<QuoteFormInput, "items" | "vat_rate" | "status"> & { items: Item[]; vat_rate: number; status: QuoteStatus };
  business: { name: string; address: string; siret: string | null; phone: string | null; email: string | null };
  rates: { hourly: number; travel: number };
  clients: Array<{ id: string; label: string; address: string; email: string | null }>;
}

const KIND_LABELS: Record<QuoteItemKind, string> = { labor: "Main-d'œuvre", material: "Matériel", travel: "Déplacement", other: "Autre" };

export function QuoteEditor({ id, number, validUntil, createdByAi, initial, business, rates, clients }: Props) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [pending, start] = useTransition();

  const totals = useMemo(() => {
    const sum = (k?: QuoteItemKind) => round2(form.items.filter((i) => !k || i.kind === k).reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0), 0));
    const ht = sum();
    const vat = round2((ht * form.vat_rate) / 100);
    return { labor: sum("labor"), material: sum("material"), travel: sum("travel"), ht, vat, ttc: round2(ht + vat) };
  }, [form.items, form.vat_rate]);

  const client = clients.find((c) => c.id === form.client_id);
  const setItem = (i: number, patch: Partial<Item>) => setForm((f) => ({ ...f, items: f.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) }));
  const addItem = (kind: QuoteItemKind) =>
    setForm((f) => ({
      ...f,
      items: [...f.items, { kind, label: kind === "labor" ? "Main-d'œuvre" : kind === "travel" ? "Déplacement" : "", quantity: 1, unit_price: kind === "labor" ? rates.hourly : kind === "travel" ? rates.travel : 0 }],
    }));

  const save = (status?: QuoteStatus) =>
    start(async () => {
      setError(null);
      const res = await saveQuoteAction(id, { ...form, ...(status ? { status } : {}) });
      if (res.error) return setError(res.error);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      if (!id && res.id) router.replace(`/devis/${res.id}`);
      else router.refresh();
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/devis" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
          <ChevronLeft className="size-4" /> Mes devis
        </Link>
        <div className="flex flex-wrap gap-2">
          {id && (
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer className="size-4" /> Imprimer / PDF
            </Button>
          )}
          {id && form.status === "draft" && (
            <Button variant="secondary" onClick={() => setConfirmSend(true)}>
              <Send className="size-4" /> Marquer comme envoyé
            </Button>
          )}
          <Button onClick={() => save()} disabled={pending}>
            {pending ? "Enregistrement…" : saved ? "✓ Enregistré" : "Enregistrer"}
          </Button>
        </div>
      </div>

      {createdByAi && form.status === "draft" && (
        <p className="rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-700 print:hidden">Ce brouillon a été préparé par Jarvis. Relisez les lignes et les prix avant de l&apos;envoyer : rien n&apos;a été envoyé au client.</p>
      )}

      <Card className="p-5 sm:p-8">
        {/* En-tête du devis */}
        <div className="flex flex-col gap-6 border-b border-line pb-6 sm:flex-row sm:justify-between">
          <div>
            <p className="text-lg font-semibold">{business.name}</p>
            <p className="text-sm text-muted">{business.address}</p>
            {business.phone && <p className="text-sm text-muted">{business.phone}</p>}
            {business.email && <p className="text-sm text-muted">{business.email}</p>}
            {business.siret && <p className="text-sm text-muted">SIRET {business.siret}</p>}
          </div>
          <div className="sm:text-right">
            <p className="text-2xl font-semibold">Devis {number ?? "(nouveau)"}</p>
            {validUntil && <p className="text-sm text-muted">Valable jusqu&apos;au {validUntil}</p>}
            <div className="mt-2 flex items-center gap-2 sm:justify-end print:hidden">
              <Badge tone={QUOTE_TONES[form.status]}>{QUOTE_STATUS_LABELS[form.status]}</Badge>
              {id && (
                <Select
                  value={form.status}
                  onChange={(e) => {
                    const status = e.target.value as QuoteStatus;
                    if (status === "sent") return setConfirmSend(true);
                    setForm((f) => ({ ...f, status }));
                    start(() => setQuoteStatusAction(id, status));
                  }}
                  className="h-9 w-auto text-sm"
                  aria-label="Statut du devis"
                >
                  {Object.entries(QUOTE_STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-4 py-6 sm:grid-cols-2">
          <Field label="Client">
            <Select value={form.client_id ?? ""} onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value || null }))} className="print:border-0 print:p-0">
              <option value="">— Choisir un client —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
            {client?.address && <span className="block text-sm text-muted">{client.address}</span>}
          </Field>
          <Field label="Objet">
            <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Ex : Remplacement chauffe-eau 200 L" />
          </Field>
          <Field label="Description des travaux" className="sm:col-span-2">
            <Textarea value={form.description ?? ""} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} />
          </Field>
        </div>

        {/* Lignes */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs tracking-wider text-muted uppercase">
                <th className="py-2 pr-2 font-semibold">Type</th>
                <th className="py-2 pr-2 font-semibold">Désignation</th>
                <th className="w-24 py-2 pr-2 text-right font-semibold">Qté</th>
                <th className="w-32 py-2 pr-2 text-right font-semibold">P.U. HT</th>
                <th className="w-28 py-2 text-right font-semibold">Total HT</th>
                <th className="w-10 print:hidden" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {form.items.map((it, i) => (
                <tr key={i}>
                  <td className="py-2 pr-2">
                    <Select value={it.kind} onChange={(e) => setItem(i, { kind: e.target.value as QuoteItemKind })} className="h-9 text-sm">
                      {Object.entries(KIND_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="py-2 pr-2">
                    <Input value={it.label} onChange={(e) => setItem(i, { label: e.target.value })} className="h-9 text-sm" />
                  </td>
                  <td className="py-2 pr-2">
                    <Input type="number" step="0.25" min={0} value={String(it.quantity)} onChange={(e) => setItem(i, { quantity: Number(e.target.value) })} className="h-9 text-right text-sm" />
                  </td>
                  <td className="py-2 pr-2">
                    <Input type="number" step="0.01" min={0} value={String(it.unit_price)} onChange={(e) => setItem(i, { unit_price: Number(e.target.value) })} className="h-9 text-right text-sm" />
                  </td>
                  <td className="py-2 text-right font-medium tabular-nums">{formatEuro((Number(it.quantity) || 0) * (Number(it.unit_price) || 0))}</td>
                  <td className="py-2 pl-1 print:hidden">
                    <button onClick={() => setForm((f) => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }))} className="grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Supprimer la ligne">
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 print:hidden">
          {(["material", "labor", "travel", "other"] as const).map((k) => (
            <Button key={k} size="sm" variant="secondary" onClick={() => addItem(k)}>
              <Plus className="size-3.5" /> {KIND_LABELS[k]}
            </Button>
          ))}
        </div>

        {/* Totaux */}
        <div className="mt-6 flex flex-col gap-6 border-t border-line pt-6 sm:flex-row sm:justify-between">
          <Field label="Notes (conditions, délais…)" className="sm:w-1/2">
            <Textarea value={form.notes ?? ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3} />
          </Field>
          <div className="space-y-1.5 text-sm sm:w-72">
            <Row label="Main-d'œuvre" value={totals.labor} />
            <Row label="Matériel" value={totals.material} />
            <Row label="Déplacement" value={totals.travel} />
            <div className="border-t border-line pt-1.5" />
            <Row label="Total HT" value={totals.ht} strong />
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-muted">
                TVA
                <Select value={String(form.vat_rate)} onChange={(e) => setForm((f) => ({ ...f, vat_rate: Number(e.target.value) }))} className="h-8 w-24 text-sm">
                  {[0, 5.5, 10, 20].map((v) => (
                    <option key={v} value={v}>
                      {String(v).replace(".", ",")} %
                    </option>
                  ))}
                </Select>
              </span>
              <span className="tabular-nums">{formatEuro(totals.vat)}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-night px-3 py-2.5 text-base font-semibold text-white">
              <span>Total TTC</span>
              <span className="tabular-nums">{formatEuro(totals.ttc)}</span>
            </div>
          </div>
        </div>
        {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </Card>

      {id && (
        <div className="flex justify-end print:hidden">
          <Button variant="danger" onClick={() => confirm("Supprimer définitivement ce devis ?") && start(() => deleteQuoteAction(id))}>
            <Trash2 className="size-4" /> Supprimer le devis
          </Button>
        </div>
      )}

      <Modal open={confirmSend} onClose={() => setConfirmSend(false)} title="Marquer le devis comme envoyé">
        <p>Confirmez-vous avoir envoyé ce devis{client ? ` à ${client.label}` : ""} ?</p>
        <p className="mt-2 text-sm text-muted">Jarvis n&apos;envoie rien automatiquement. Ce statut lui permet de vous rappeler de relancer le client.</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmSend(false)}>
            Annuler
          </Button>
          <Button
            onClick={() => {
              setConfirmSend(false);
              setForm((f) => ({ ...f, status: "sent" }));
              save("sent");
            }}
          >
            Oui, il est envoyé
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "font-semibold" : "text-muted"}`}>
      <span>{label}</span>
      <span className="tabular-nums">{formatEuro(value)}</span>
    </div>
  );
}
