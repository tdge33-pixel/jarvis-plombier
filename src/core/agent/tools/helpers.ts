import "server-only";
import type { AppContext } from "@/lib/context";
import type { Client } from "@/lib/domain/types";
import { APPOINTMENT_STATUS_LABELS } from "@/lib/domain/types";
import { clientAddressLine, clientDisplayName } from "@/lib/format";
import type { AppointmentView } from "@/lib/services/appointments";
import { searchClients } from "@/lib/services/clients";
import type { AppointmentCard, ClientCard } from "../blocks";
import type { ToolResult } from "../types";

export function toClientCard(c: Client): ClientCard {
  return {
    id: c.id,
    name: clientDisplayName(c, { withFirstName: true }),
    phone: c.phone,
    email: c.email,
    address: clientAddressLine(c),
    notes: c.notes,
    important_info: c.important_info,
  };
}

export function toAppointmentCard(a: AppointmentView): AppointmentCard {
  return {
    id: a.id,
    date: a.date,
    time: a.time,
    end_time: a.end_time,
    client_name: a.client_name,
    client_phone: a.client_phone,
    intervention_type: a.intervention_type,
    city: a.city,
    address: a.address,
    status: APPOINTMENT_STATUS_LABELS[a.status],
  };
}

export type ClientResolution = { kind: "one"; client: Client } | { kind: "none" | "many"; result: ToolResult };

/** Trouve UN client à partir d'un nom ; sinon prépare une réponse claire (introuvable / ambigu). */
export async function resolveClient(ctx: AppContext, query: string): Promise<ClientResolution> {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(query)) {
    const byId = await ctx.store.get("clients", query);
    if (byId) return { kind: "one", client: byId };
  }
  const matches = await searchClients(ctx, query);
  if (matches.length === 1) return { kind: "one", client: matches[0]! };
  if (matches.length === 0) {
    return {
      kind: "none",
      result: {
        ok: false,
        summary: `Je n'ai trouvé aucun client « ${query} ». Voulez-vous que je le crée ? Donnez-moi son nom complet, son téléphone et sa ville.`,
        data: { error: "CLIENT_NOT_FOUND", query },
      },
    };
  }
  return {
    kind: "many",
    result: {
      ok: false,
      summary: `J'ai trouvé plusieurs clients pour « ${query} » : ${matches
        .slice(0, 5)
        .map((c) => `${clientDisplayName(c, { withFirstName: true })} (${c.city ?? "ville inconnue"})`)
        .join(", ")}. Lequel ?`,
      data: { error: "AMBIGUOUS_CLIENT", candidates: matches.slice(0, 5).map((c) => ({ id: c.id, name: clientDisplayName(c, { withFirstName: true }), city: c.city })) },
      blocks: [{ type: "clients", items: matches.slice(0, 5).map(toClientCard) }],
    },
  };
}
