"use client";

import { Download, Plug, RotateCcw, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import {
  clearConversationsAction,
  resetDemoAction,
  saveBusinessAction,
  saveHoursAction,
  savePermissionsAction,
  saveProfileAction,
  saveRatesAction,
  saveSignatureAction,
} from "@/app/(app)/parametres/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Toggle } from "@/components/ui/misc";
import type { JarvisPermissions } from "@/lib/domain/types";
import { cn } from "@/lib/format";

function Section({ title, description, children, onSave }: { title: string; description?: string; children: React.ReactNode; onSave?: () => Promise<void> }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<"idle" | "saved" | "error">("idle");
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      <div className="mt-5">{children}</div>
      {onSave && (
        <div className="mt-6 flex items-center justify-end gap-3">
          {state === "saved" && <span className="text-sm text-emerald-700">✓ Enregistré</span>}
          {state === "error" && <span className="text-sm text-red-600">Vérifiez les champs</span>}
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                try {
                  await onSave();
                  setState("saved");
                } catch {
                  setState("error");
                }
              })
            }
          >
            {pending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      )}
    </Card>
  );
}

function useForm<T extends Record<string, unknown>>(initial: T) {
  const [form, setForm] = useState(initial);
  const bind = (k: keyof T) => ({
    value: String(form[k] ?? ""),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value })),
  });
  return { form, setForm, bind };
}

export function ProfileForm({ initial }: { initial: { first_name: string; last_name: string; phone: string; email: string; signature: string } }) {
  const { form, bind } = useForm(initial);
  return (
    <Section
      title="Mon profil"
      onSave={async () => {
        await saveProfileAction({ first_name: form.first_name, last_name: form.last_name, phone: form.phone });
        await saveSignatureAction(form.signature);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Prénom">
          <Input {...bind("first_name")} />
        </Field>
        <Field label="Nom">
          <Input {...bind("last_name")} />
        </Field>
        <Field label="Téléphone">
          <Input {...bind("phone")} type="tel" />
        </Field>
        <Field label="Email de connexion">
          <Input value={form.email} disabled />
        </Field>
        <Field label="Signature des messages clients" hint="Utilisée par Jarvis à la fin des SMS et emails." className="sm:col-span-2">
          <Input {...bind("signature")} placeholder="Ex : Thomas — Martin Plomberie" />
        </Field>
      </div>
    </Section>
  );
}

export function BusinessForm({ initial }: { initial: { name: string; phone: string; email: string; address: string; postal_code: string; city: string; siret: string; zone_radius_km: number | string; works_alone: boolean; team_size: number } }) {
  const { form, setForm, bind } = useForm(initial);
  return (
    <Section
      title="Mon entreprise"
      description="Ces informations apparaissent sur vos devis."
      onSave={() => saveBusinessAction({ ...form, zone_radius_km: form.zone_radius_km === "" ? null : Number(form.zone_radius_km) })}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom de l'entreprise" className="sm:col-span-2">
          <Input {...bind("name")} />
        </Field>
        <Field label="Téléphone">
          <Input {...bind("phone")} />
        </Field>
        <Field label="Email">
          <Input {...bind("email")} />
        </Field>
        <Field label="Adresse" className="sm:col-span-2">
          <Input {...bind("address")} />
        </Field>
        <Field label="Code postal">
          <Input {...bind("postal_code")} />
        </Field>
        <Field label="Ville">
          <Input {...bind("city")} />
        </Field>
        <Field label="SIRET">
          <Input {...bind("siret")} />
        </Field>
        <Field label="Zone d'intervention (km)">
          <Input {...bind("zone_radius_km")} type="number" min={0} />
        </Field>
        <div className="sm:col-span-2">
          <Toggle checked={form.works_alone} onChange={(v) => setForm((f) => ({ ...f, works_alone: v, team_size: v ? 1 : Math.max(2, f.team_size) }))} label="Je travaille seul" />
          {!form.works_alone && (
            <Field label="Nombre de personnes dans l'équipe">
              <Input {...bind("team_size")} type="number" min={2} />
            </Field>
          )}
        </div>
      </div>
    </Section>
  );
}

export function RatesForm({ initial }: { initial: { hourly_rate: number; travel_fee: number; vat_rate: number; quote_validity_days: number } }) {
  const { form, bind } = useForm(initial);
  return (
    <Section title="Mes tarifs" description="Jarvis les utilise pour préparer vos devis." onSave={() => saveRatesAction(form)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tarif horaire (€ HT)">
          <Input {...bind("hourly_rate")} type="number" min={0} step="0.5" />
        </Field>
        <Field label="Déplacement (€)" hint="0 si vous ne le facturez pas">
          <Input {...bind("travel_fee")} type="number" min={0} step="0.5" />
        </Field>
        <Field label="TVA par défaut (%)" hint="10 % en rénovation, 20 % dans le neuf">
          <Input {...bind("vat_rate")} type="number" min={0} max={30} step="0.5" />
        </Field>
        <Field label="Validité des devis (jours)">
          <Input {...bind("quote_validity_days")} type="number" min={1} />
        </Field>
      </div>
    </Section>
  );
}

const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export function HoursForm({ initial }: { initial: { work_start: string; work_end: string; working_days: number[]; emergencies_accepted: boolean; emergency_until: string | null; max_appointments_per_day: number } }) {
  const { form, setForm, bind } = useForm(initial);
  return (
    <Section title="Mes horaires" onSave={() => saveHoursAction({ ...form, max_appointments_per_day: Number(form.max_appointments_per_day), emergency_until: form.emergencies_accepted ? form.emergency_until || "20:00" : null })}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Début de journée">
          <Input {...bind("work_start")} type="time" />
        </Field>
        <Field label="Fin de journée">
          <Input {...bind("work_end")} type="time" />
        </Field>
        <div className="sm:col-span-2">
          <p className="mb-2 text-sm font-medium">Jours travaillés</p>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((d, i) => {
              const n = i + 1;
              const on = form.working_days.includes(n);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, working_days: on ? f.working_days.filter((x) => x !== n) : [...f.working_days, n].sort() }))}
                  className={cn("h-11 w-14 rounded-xl border text-sm font-medium", on ? "border-brand-500 bg-brand-500 text-white" : "border-line bg-white text-muted")}
                  aria-pressed={on}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>
        <Field label="Maximum d'interventions par jour">
          <Input {...bind("max_appointments_per_day")} type="number" min={1} />
        </Field>
        <div className="sm:col-span-2">
          <Toggle checked={form.emergencies_accepted} onChange={(v) => setForm((f) => ({ ...f, emergencies_accepted: v }))} label="J'accepte les urgences" />
          {form.emergencies_accepted && (
            <Field label="Urgences acceptées jusqu'à">
              <Input value={form.emergency_until ?? "20:00"} onChange={(e) => setForm((f) => ({ ...f, emergency_until: e.target.value }))} type="time" className="max-w-40" />
            </Field>
          )}
        </div>
      </div>
    </Section>
  );
}

const PERMISSION_ITEMS: Array<{ key: keyof JarvisPermissions; label: string; description: string }> = [
  { key: "auto_create_tasks", label: "Créer automatiquement des tâches", description: "Sinon, Jarvis vous demande avant chaque tâche." },
  { key: "create_appointments", label: "Créer des rendez-vous après validation", description: "Jarvis vous montre toujours le rendez-vous avant de le créer." },
  { key: "modify_appointments", label: "Modifier des rendez-vous", description: "Déplacer ou annuler, toujours après votre validation." },
  { key: "prepare_quotes", label: "Préparer des devis", description: "En brouillon uniquement : rien n'est envoyé sans vous." },
  { key: "save_preferences", label: "Enregistrer de nouvelles préférences", description: "Ce que vous lui demandez de retenir, et ses suggestions." },
  { key: "draft_messages", label: "Préparer des messages clients", description: "Brouillons de SMS et d'emails, jamais envoyés automatiquement." },
];

export function PermissionsForm({ initial }: { initial: JarvisPermissions }) {
  const [form, setForm] = useState(initial);
  return (
    <Section title="Permissions Jarvis" description="Choisissez ce que Jarvis a le droit de faire. Les actions sensibles (envoi de devis, factures…) demandent toujours votre confirmation." onSave={() => savePermissionsAction({ ...form })}>
      <p className="mb-1 text-sm font-medium">Autoriser Jarvis à :</p>
      <div className="divide-y divide-line">
        {PERMISSION_ITEMS.map((p) => (
          <Toggle key={p.key} checked={form[p.key]} onChange={(v) => setForm((f) => ({ ...f, [p.key]: v }))} label={p.label} description={p.description} />
        ))}
      </div>
      <div className="mt-4 grid gap-2 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-3">
        <p>
          <span className="font-semibold">Niveau 1</span>
          <br />
          <span className="text-muted">Consulter, rechercher, préparer : immédiat.</span>
        </p>
        <p>
          <span className="font-semibold">Niveau 2</span>
          <br />
          <span className="text-muted">Rendez-vous, tâches : selon vos réglages.</span>
        </p>
        <p>
          <span className="font-semibold">Niveau 3</span>
          <br />
          <span className="text-muted">Envois, actions sensibles : toujours votre accord.</span>
        </p>
      </div>
    </Section>
  );
}

export function IntegrationsPanel({ composio, catalog, current }: { composio: boolean; catalog: Array<{ kind: string; app: string; label: string; description: string }>; current: { calendar: string | null; invoicing: string | null } }) {
  return (
    <Section title="Intégrations" description="Connectez vos outils pour que Jarvis travaille avec eux.">
      {(current.calendar || current.invoicing) && (
        <p className="mb-4 rounded-xl bg-slate-50 p-3 text-sm text-muted">
          Vous utilisez actuellement : {[current.calendar && `${current.calendar} (agenda)`, current.invoicing && `${current.invoicing} (devis et factures)`].filter(Boolean).join(", ")}.
        </p>
      )}
      <ul className="divide-y divide-line">
        {catalog.map((i) => (
          <li key={i.app} className="flex items-center gap-4 py-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
              <Plug className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{i.label}</span>
              <span className="block text-sm text-muted">{i.description}</span>
            </span>
            {composio ? (
              <Button size="sm" variant="secondary" disabled title="Le parcours de connexion OAuth Composio sera branché ici">
                Connecter
              </Button>
            ) : (
              <Badge>Bientôt</Badge>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-muted">En attendant, Jarvis utilise son propre agenda et prépare vos messages sans les envoyer.</p>
    </Section>
  );
}

export function PrivacyPanel({ demo }: { demo: boolean }) {
  const [pending, start] = useTransition();
  return (
    <div className="space-y-4">
      <Section title="Vos données vous appartiennent">
        <ul className="space-y-2 text-sm text-muted">
          <li>• Vos clients, rendez-vous, devis et mémoires sont strictement réservés à votre entreprise : aucune autre entreprise ne peut y accéder.</li>
          <li>• Jarvis n&apos;envoie jamais de message, devis ou facture sans votre accord.</li>
          <li>• Jarvis n&apos;est pas entraîné sur vos données : il les consulte uniquement pour vous répondre.</li>
          <li>• Vous pouvez à tout moment modifier ou supprimer ce que Jarvis a retenu (page Mémoire).</li>
        </ul>
        <div className="mt-5 flex flex-wrap gap-2">
          <a href="/api/export" className="inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-white px-4 text-[15px] font-medium hover:bg-brand-50">
            <Download className="size-4" /> Télécharger mes données
          </a>
          <Button variant="danger" disabled={pending} onClick={() => confirm("Effacer tout l'historique des conversations avec Jarvis ?") && start(() => clearConversationsAction())}>
            <Trash2 className="size-4" /> Effacer les conversations
          </Button>
        </div>
      </Section>
      {demo && (
        <Section title="Démonstration" description="Remet les données d'exemple (Martin Plomberie) dans leur état initial. Les comptes créés pendant la démo sont supprimés.">
          <Button variant="danger" disabled={pending} onClick={() => confirm("Réinitialiser toutes les données de démonstration ?") && start(() => resetDemoAction())}>
            <RotateCcw className="size-4" /> Réinitialiser la démo
          </Button>
        </Section>
      )}
    </div>
  );
}

const STATUS_LABELS: Record<string, { label: string; tone: "green" | "amber" | "red" | "neutral" | "blue" }> = {
  PENDING_CONFIRMATION: { label: "En attente", tone: "amber" },
  CONFIRMED: { label: "Confirmée", tone: "blue" },
  EXECUTED: { label: "Réalisée", tone: "green" },
  FAILED: { label: "Échec", tone: "red" },
  CANCELLED: { label: "Annulée", tone: "neutral" },
};

const ACTION_LABELS: Record<string, string> = {
  CREATE_APPOINTMENT: "Rendez-vous",
  UPDATE_APPOINTMENT: "Modification de rendez-vous",
  CREATE_QUOTE: "Devis",
  SEND_QUOTE: "Envoi de devis",
  CREATE_TASK: "Tâche",
  ADD_MEMORY: "Mémoire",
  SUGGEST_MEMORY: "Suggestion",
  DRAFT_MESSAGE: "Message client",
  CREATE_CLIENT: "Client",
};

export function ActionHistory({ actions }: { actions: Array<{ id: string; action: string; summary: string; status: string; initiated_by: string; confirmed: boolean; level: number; when: string }> }) {
  return (
    <Section title="Historique des actions" description="Tout ce que Jarvis a fait ou proposé de faire, pour garder une trace.">
      {actions.length === 0 ? (
        <p className="text-muted">Aucune action pour l&apos;instant.</p>
      ) : (
        <ul className="divide-y divide-line">
          {actions.map((a) => {
            const st = STATUS_LABELS[a.status] ?? { label: a.status, tone: "neutral" as const };
            return (
              <li key={a.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:gap-4">
                <span className="w-32 shrink-0 text-xs text-muted tabular-nums">{a.when}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{ACTION_LABELS[a.action] ?? a.action}</span>
                  <span className="block text-sm text-muted">{a.summary}</span>
                </span>
                <span className="flex shrink-0 gap-1.5">
                  <Badge tone="neutral">{a.initiated_by === "AI" ? "Proposée par Jarvis" : "Par vous"}</Badge>
                  {a.confirmed && <Badge tone="violet">Validée par vous</Badge>}
                  <Badge tone={st.tone}>{st.label}</Badge>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
