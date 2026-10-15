import type { CalendarProvider, EmailProvider, ExternalCalendarEvent } from "../types";
import type { ComposioClient } from "./client";

/** Google Calendar via Composio. */
export class ComposioCalendarProvider implements CalendarProvider {
  readonly id = "composio-googlecalendar";
  readonly label = "Google Agenda (Composio)";
  readonly connected = true;

  constructor(private readonly client: ComposioClient) {}

  async upsertEvent(event: Parameters<CalendarProvider["upsertEvent"]>[0]) {
    if (event.externalId && event.cancelled) {
      await this.deleteEvent(event.externalId);
      return { externalId: null };
    }
    const args = {
      summary: event.title,
      start_datetime: event.startAt,
      event_duration_hour: Math.floor(event.durationMinutes / 60),
      event_duration_minutes: event.durationMinutes % 60,
      location: event.location,
      description: event.description,
    };
    if (event.externalId) {
      await this.client.execute("GOOGLECALENDAR_UPDATE_EVENT", { ...args, event_id: event.externalId });
      return { externalId: event.externalId };
    }
    const data = await this.client.execute<{ response_data?: { id?: string } }>("GOOGLECALENDAR_CREATE_EVENT", args);
    return { externalId: data?.response_data?.id ?? null };
  }

  async deleteEvent(externalId: string) {
    await this.client.execute("GOOGLECALENDAR_DELETE_EVENT", { event_id: externalId });
  }

  async listEvents(fromIso: string, toIso: string): Promise<ExternalCalendarEvent[]> {
    const data = await this.client.execute<{ items?: Array<{ id: string; summary?: string; start?: { dateTime?: string }; end?: { dateTime?: string } }> }>(
      "GOOGLECALENDAR_FIND_EVENT",
      { timeMin: fromIso, timeMax: toIso },
    );
    return (data?.items ?? []).map((e) => ({
      externalId: e.id,
      title: e.summary ?? "",
      startAt: e.start?.dateTime ?? fromIso,
      endAt: e.end?.dateTime ?? fromIso,
    }));
  }
}

/** Gmail ou Outlook via Composio. */
export class ComposioEmailProvider implements EmailProvider {
  readonly connected = true;
  readonly id: string;
  readonly label: string;

  constructor(
    private readonly client: ComposioClient,
    private readonly app: "gmail" | "outlook",
  ) {
    this.id = `composio-${app}`;
    this.label = app === "gmail" ? "Gmail (Composio)" : "Outlook (Composio)";
  }

  async send(message: Parameters<EmailProvider["send"]>[0]) {
    const slug = this.app === "gmail" ? "GMAIL_SEND_EMAIL" : "OUTLOOK_SEND_EMAIL";
    await this.client.execute(slug, { recipient_email: message.to, subject: message.subject, body: message.body });
    return { ok: true, simulated: false };
  }

  async createDraft(message: Parameters<EmailProvider["createDraft"]>[0]) {
    const slug = this.app === "gmail" ? "GMAIL_CREATE_EMAIL_DRAFT" : "OUTLOOK_CREATE_DRAFT";
    await this.client.execute(slug, { recipient_email: message.to, subject: message.subject, body: message.body });
    return { ok: true, simulated: false };
  }
}
