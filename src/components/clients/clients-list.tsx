"use client";

import { Mail, Phone, Plus, Search, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { Avatar, EmptyState, PageHeader } from "@/components/ui/misc";
import { formatShortDate } from "@/lib/dates";
import { normalize } from "@/lib/format";
import { ClientFormModal, EMPTY_CLIENT } from "./client-form";

export interface ClientRow {
  id: string;
  name: string;
  initials: string;
  phone: string | null;
  email: string | null;
  address: string;
  city: string | null;
  important: string | null;
  lastVisit: string | null;
}

export function ClientsList({ clients }: { clients: ClientRow[] }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const filtered = useMemo(() => {
    const n = normalize(q);
    if (!n) return clients;
    return clients.filter((c) => normalize(`${c.name} ${c.address} ${c.phone ?? ""} ${c.email ?? ""}`).includes(n));
  }, [clients, q]);

  return (
    <div>
      <PageHeader
        title="Mes clients"
        subtitle={`${clients.length} client${clients.length > 1 ? "s" : ""}`}
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" /> Nouveau client
          </Button>
        }
      />
      <div className="relative mb-4">
        <Search className="absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-slate-400" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un nom, une ville, un téléphone…" className="h-12 pl-11" />
      </div>
      {filtered.length === 0 ? (
        <EmptyState icon={<Users className="size-6" />} title={clients.length ? "Aucun client ne correspond" : "Aucun client pour l'instant"} text="Ajoutez votre premier client, ou dites à Jarvis : « Nouveau client : Mme Petit, 06…, à Talence »." />
      ) : (
        <Card className="divide-y divide-line">
          {filtered.map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
              <Link href={`/clients/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar text={c.initials} />
                <span className="min-w-0">
                  <span className="block font-medium">{c.name}</span>
                  <span className="block truncate text-sm text-muted">{c.address || "Adresse non renseignée"}</span>
                  {c.important && <span className="block truncate text-xs text-amber-800">⚑ {c.important}</span>}
                </span>
              </Link>
              <span className="hidden shrink-0 text-right text-sm text-muted md:block">
                {c.lastVisit ? (
                  <>
                    Dernière intervention
                    <br />
                    {formatShortDate(c.lastVisit)}
                  </>
                ) : (
                  "Pas encore d'intervention"
                )}
              </span>
              <span className="flex shrink-0 gap-1">
                {c.phone && (
                  <a href={`tel:${c.phone.replace(/\s/g, "")}`} className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-600" aria-label={`Appeler ${c.name}`}>
                    <Phone className="size-4" />
                  </a>
                )}
                {c.email && (
                  <a href={`mailto:${c.email}`} className="hidden size-10 place-items-center rounded-xl bg-brand-50 text-brand-600 sm:grid" aria-label={`Écrire à ${c.name}`}>
                    <Mail className="size-4" />
                  </a>
                )}
              </span>
            </div>
          ))}
        </Card>
      )}
      <ClientFormModal open={open} onClose={() => setOpen(false)} id={null} initial={EMPTY_CLIENT} />
    </div>
  );
}
