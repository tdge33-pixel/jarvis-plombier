"use client";

import { NotebookPen, Pencil, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { addNoteAction, deleteClientAction, deleteNoteAction, type ClientFormInput } from "@/app/(app)/clients/actions";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/field";
import { formatShortDate } from "@/lib/dates";
import { ClientFormModal } from "./client-form";

export function ClientActions({ id, name, initial }: { id: string; name: string; initial: ClientFormInput }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-2">
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Pencil className="size-4" /> Modifier
      </Button>
      <Button
        variant="danger"
        disabled={pending}
        onClick={() => {
          if (confirm(`Supprimer ${name} ? Ses interventions et devis seront conservés sans client.`)) start(() => deleteClientAction(id));
        }}
      >
        <Trash2 className="size-4" /> Supprimer
      </Button>
      <ClientFormModal open={open} onClose={() => setOpen(false)} id={id} initial={initial} />
    </div>
  );
}

export function ClientNotes({ clientId, notes }: { clientId: string; notes: Array<{ id: string; content: string; date: string }> }) {
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  return (
    <Card>
      <CardHeader title="Notes" icon={<NotebookPen className="size-4" />} />
      <CardBody className="space-y-3">
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              await addNoteAction(clientId, text);
              setText("");
            });
          }}
        >
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Ajouter une note (matériel en place, remarque…)" className="min-h-0 flex-1" />
          <Button type="submit" disabled={pending || !text.trim()} className="sm:self-end">
            Ajouter
          </Button>
        </form>
        <ul className="divide-y divide-line">
          {notes.map((n) => (
            <li key={n.id} className="group flex items-start justify-between gap-3 py-2">
              <span>
                <span className="text-xs text-muted">{formatShortDate(n.date)}</span>
                <span className="block text-sm whitespace-pre-wrap">{n.content}</span>
              </span>
              <button onClick={() => start(() => deleteNoteAction(clientId, n.id))} className="text-slate-400 hover:text-red-600" aria-label="Supprimer la note">
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
