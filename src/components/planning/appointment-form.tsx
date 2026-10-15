"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteAppointmentAction, saveAppointmentAction, type AppointmentFormInput } from "@/app/(app)/planning/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { APPOINTMENT_STATUS_LABELS, type AppointmentStatus } from "@/lib/domain/types";

export interface ClientOption {
  id: string;
  label: string;
  address: string | null;
  city: string | null;
}

export interface AppointmentDraft {
  id: string | null;
  client_id: string | null;
  date: string;
  time: string;
  duration_minutes: number;
  intervention_type: string;
  address: string | null;
  city: string | null;
  status: AppointmentStatus;
  notes: string | null;
}

export function AppointmentFormModal({
  draft,
  clients,
  interventionTypes,
  onClose,
}: {
  draft: AppointmentDraft | null;
  clients: ClientOption[];
  interventionTypes: Array<{ label: string; defaultDurationMinutes: number }>;
  onClose: () => void;
}) {
  return (
    <Modal open={draft !== null} onClose={onClose} title={draft?.id ? "Modifier le rendez-vous" : "Nouveau rendez-vous"}>
      {draft && <Form key={draft.id ?? "new"} draft={draft} clients={clients} interventionTypes={interventionTypes} onClose={onClose} />}
    </Modal>
  );
}

function Form({ draft, clients, interventionTypes, onClose }: { draft: AppointmentDraft; clients: ClientOption[]; interventionTypes: Array<{ label: string; defaultDurationMinutes: number }>; onClose: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState<AppointmentFormInput>({ ...draft });
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const set = <K extends keyof AppointmentFormInput>(k: K, v: AppointmentFormInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () =>
    start(async () => {
      const res = await saveAppointmentAction(draft.id, form);
      if (res.error) return setError(res.error);
      if (res.warnings?.length) {
        setWarnings(res.warnings);
        router.refresh();
        return;
      }
      router.refresh();
      onClose();
    });

  if (warnings.length) {
    return (
      <div className="space-y-4">
        <p className="font-medium">Rendez-vous enregistré. À noter :</p>
        <ul className="space-y-1 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          {warnings.map((w) => (
            <li key={w}>• {w}</li>
          ))}
        </ul>
        <Button onClick={onClose}>Fermer</Button>
      </div>
    );
  }

  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Field label="Client" className="sm:col-span-2">
        <Select
          value={form.client_id ?? ""}
          onChange={(e) => {
            const c = clients.find((x) => x.id === e.target.value);
            setForm((f) => ({ ...f, client_id: e.target.value || null, address: c?.address ?? f.address, city: c?.city ?? f.city }));
          }}
        >
          <option value="">— Sans client —</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Type d'intervention" className="sm:col-span-2">
        <Input
          list="intervention-types"
          value={form.intervention_type}
          onChange={(e) => {
            const t = interventionTypes.find((x) => x.label === e.target.value);
            setForm((f) => ({ ...f, intervention_type: e.target.value, ...(t && !draft.id ? { duration_minutes: t.defaultDurationMinutes } : {}) }));
          }}
          required
        />
        <datalist id="intervention-types">
          {interventionTypes.map((t) => (
            <option key={t.label} value={t.label} />
          ))}
        </datalist>
      </Field>
      <Field label="Date">
        <Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Heure">
          <Input type="time" value={form.time} onChange={(e) => set("time", e.target.value)} required />
        </Field>
        <Field label="Durée (min)">
          <Input type="number" min={15} step={15} value={String(form.duration_minutes)} onChange={(e) => set("duration_minutes", Number(e.target.value))} required />
        </Field>
      </div>
      <Field label="Adresse">
        <Input value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} />
      </Field>
      <Field label="Ville">
        <Input value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} />
      </Field>
      <Field label="Statut" className="sm:col-span-2">
        <Select value={form.status} onChange={(e) => set("status", e.target.value as AppointmentStatus)}>
          {Object.entries(APPOINTMENT_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Notes" className="sm:col-span-2">
        <Textarea value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} rows={3} placeholder="Code d'accès, matériel à prévoir…" />
      </Field>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2">
        {draft.id ? (
          <Button
            variant="danger"
            disabled={pending}
            onClick={() => {
              if (!confirm("Supprimer définitivement ce rendez-vous ?")) return;
              start(async () => {
                await deleteAppointmentAction(draft.id!);
                router.refresh();
                onClose();
              });
            }}
          >
            <Trash2 className="size-4" /> Supprimer
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      </div>
    </form>
  );
}
