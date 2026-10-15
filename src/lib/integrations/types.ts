/**
 * Contrats des intégrations externes.
 * La logique métier ne connaît QUE ces interfaces : on peut passer de
 * MockCalendarProvider à ComposioCalendarProvider sans toucher au reste.
 */

export interface CalendarEventInput {
  externalId: string | null;
  title: string;
  startAt: string; // ISO UTC
  durationMinutes: number;
  location: string;
  description: string;
  cancelled?: boolean;
}

export interface ExternalCalendarEvent {
  externalId: string;
  title: string;
  startAt: string;
  endAt: string;
}

export interface CalendarProvider {
  readonly id: string;
  readonly label: string;
  readonly connected: boolean;
  upsertEvent(event: CalendarEventInput): Promise<{ externalId: string | null }>;
  deleteEvent(externalId: string): Promise<void>;
  listEvents(fromIso: string, toIso: string): Promise<ExternalCalendarEvent[]>;
}

export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
}

export interface EmailProvider {
  readonly id: string;
  readonly label: string;
  readonly connected: boolean;
  /** Envoi réel — uniquement après confirmation explicite (action de niveau 3). */
  send(message: EmailMessage): Promise<{ ok: boolean; externalId?: string; simulated: boolean }>;
  createDraft(message: EmailMessage): Promise<{ ok: boolean; externalId?: string; simulated: boolean }>;
}

export interface SmsProvider {
  readonly id: string;
  readonly label: string;
  readonly connected: boolean;
  send(to: string, body: string): Promise<{ ok: boolean; simulated: boolean }>;
}

export interface DriveProvider {
  readonly id: string;
  readonly label: string;
  readonly connected: boolean;
  upload(file: { name: string; mimeType: string; content: string }): Promise<{ ok: boolean; url?: string; simulated: boolean }>;
}

export interface StockLevel {
  label: string;
  quantity: number;
  threshold: number;
}

/** Préparé pour une future gestion de stock (non développée dans le MVP). */
export interface InventoryProvider {
  readonly id: string;
  lowStock(): Promise<StockLevel[]>;
}

export interface IntegrationSet {
  calendar: CalendarProvider;
  email: EmailProvider;
  sms: SmsProvider;
  drive: DriveProvider;
  inventory: InventoryProvider;
}
