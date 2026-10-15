"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveClientAction, type ClientFormInput } from "@/app/(app)/clients/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";

export const EMPTY_CLIENT: ClientFormInput = {
  civility: "",
  first_name: "",
  last_name: "",
  company: "",
  phone: "",
  email: "",
  address: "",
  postal_code: "",
  city: "",
  notes: "",
  important_info: "",
};

export function ClientFormModal({ open, onClose, id, initial }: { open: boolean; onClose: () => void; id: string | null; initial: ClientFormInput }) {
  return (
    <Modal open={open} onClose={onClose} title={id ? "Modifier le client" : "Nouveau client"}>
      {open && <ClientForm id={id} initial={initial} onDone={onClose} />}
    </Modal>
  );
}

function ClientForm({ id, initial, onDone }: { id: string | null; initial: ClientFormInput; onDone: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState<ClientFormInput>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const bind = (k: keyof ClientFormInput) => ({
    value: (form[k] as string | null | undefined) ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value })),
  });

  return (
    <form
      className="grid gap-4 sm:grid-cols-6"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await saveClientAction(id, form);
          if (res.error) return setError(res.error);
          onDone();
          if (!id && res.id) router.push(`/clients/${res.id}`);
          else router.refresh();
        });
      }}
    >
      <Field label="Civilité" className="sm:col-span-2">
        <Select {...bind("civility")}>
          <option value="">—</option>
          <option value="Mme">Mme</option>
          <option value="M.">M.</option>
        </Select>
      </Field>
      <Field label="Prénom" className="sm:col-span-2">
        <Input {...bind("first_name")} autoComplete="off" />
      </Field>
      <Field label="Nom *" className="sm:col-span-2">
        <Input {...bind("last_name")} required autoComplete="off" />
      </Field>
      <Field label="Téléphone" className="sm:col-span-3">
        <Input {...bind("phone")} type="tel" />
      </Field>
      <Field label="Email" className="sm:col-span-3">
        <Input {...bind("email")} type="email" />
      </Field>
      <Field label="Adresse" className="sm:col-span-6">
        <Input {...bind("address")} />
      </Field>
      <Field label="Code postal" className="sm:col-span-2">
        <Input {...bind("postal_code")} inputMode="numeric" />
      </Field>
      <Field label="Ville" className="sm:col-span-4">
        <Input {...bind("city")} />
      </Field>
      <Field label="Informations importantes" hint="Ex : code portail, disponible le matin, chien…" className="sm:col-span-6">
        <Input {...bind("important_info")} />
      </Field>
      <Field label="Notes" className="sm:col-span-6">
        <Textarea {...bind("notes")} rows={3} />
      </Field>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-6">{error}</p>}
      <div className="flex justify-end gap-2 sm:col-span-6">
        <Button variant="ghost" onClick={onDone}>
          Annuler
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}
