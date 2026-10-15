import "server-only";
import type { AppContext } from "@/lib/context";
import { ComposioClient } from "./composio/client";
import { ComposioCalendarProvider, ComposioEmailProvider } from "./composio/providers";
import { MockCalendarProvider, MockDriveProvider, MockEmailProvider, MockInventoryProvider, MockSmsProvider } from "./mock";
import type { IntegrationSet } from "./types";

export type { IntegrationSet } from "./types";

export function isComposioConfigured(): boolean {
  return Boolean(process.env.COMPOSIO_API_KEY);
}

/**
 * Fabrique les fournisseurs d'intégration pour une entreprise.
 * Composio est utilisé seulement si la clé est présente ET que l'entreprise a connecté
 * le service ; sinon on retombe sur les implémentations simulées.
 */
export async function getIntegrations(ctx: AppContext): Promise<IntegrationSet> {
  const rows = await ctx.store.list("integrations", { eq: { status: "connected", provider: "composio" } });
  const find = (kind: string) => rows.find((r) => r.kind === kind);

  const calendarRow = find("calendar");
  const emailRow = find("email");
  const calendarClient = calendarRow ? ComposioClient.fromEnv(ctx.business.id, calendarRow.external_account_id) : null;
  const emailClient = emailRow ? ComposioClient.fromEnv(ctx.business.id, emailRow.external_account_id) : null;

  return {
    calendar: calendarClient ? new ComposioCalendarProvider(calendarClient) : new MockCalendarProvider(),
    email: emailClient ? new ComposioEmailProvider(emailClient, emailRow?.app === "outlook" ? "outlook" : "gmail") : new MockEmailProvider(),
    sms: new MockSmsProvider(),
    drive: new MockDriveProvider(),
    inventory: new MockInventoryProvider(ctx.business.is_demo),
  };
}

/** Catalogue affiché dans Paramètres > Intégrations. */
export const INTEGRATION_CATALOG = [
  { kind: "calendar", app: "googlecalendar", label: "Google Agenda", description: "Vos interventions apparaissent aussi dans Google Agenda." },
  { kind: "calendar", app: "outlookcalendar", label: "Agenda Outlook", description: "Synchronisation avec l'agenda Outlook." },
  { kind: "email", app: "gmail", label: "Gmail", description: "Envoyer vos devis par email après validation." },
  { kind: "email", app: "outlook", label: "Outlook", description: "Envoyer vos devis depuis Outlook." },
  { kind: "drive", app: "googledrive", label: "Google Drive", description: "Ranger automatiquement devis et photos de chantier." },
  { kind: "sms", app: "sms", label: "SMS", description: "Envoyer les messages clients directement par SMS." },
] as const;
