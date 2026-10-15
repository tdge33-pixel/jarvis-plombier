import crypto from "node:crypto";
import type { CalendarProvider, DriveProvider, EmailProvider, InventoryProvider, SmsProvider, StockLevel } from "../types";

/**
 * Implémentations simulées : aucune donnée ne quitte l'application.
 * Elles journalisent ce qui AURAIT été fait, pour la démo et les tests.
 */

export class MockCalendarProvider implements CalendarProvider {
  readonly id = "mock-calendar";
  readonly label = "Agenda Jarvis (intégré)";
  readonly connected = false;

  async upsertEvent(event: Parameters<CalendarProvider["upsertEvent"]>[0]) {
    // L'agenda interne de Jarvis est la source de vérité : rien à synchroniser.
    return { externalId: event.externalId };
  }
  async deleteEvent() {}
  async listEvents() {
    return [];
  }
}

export class MockEmailProvider implements EmailProvider {
  readonly id = "mock-email";
  readonly label = "Email (simulation)";
  readonly connected = false;

  async send(message: Parameters<EmailProvider["send"]>[0]) {
    console.info(`[mock-email] envoi simulé à ${message.to} : ${message.subject}`);
    return { ok: true, externalId: `mock-${crypto.randomUUID()}`, simulated: true };
  }
  async createDraft(message: Parameters<EmailProvider["createDraft"]>[0]) {
    console.info(`[mock-email] brouillon simulé pour ${message.to}`);
    return { ok: true, externalId: `mock-${crypto.randomUUID()}`, simulated: true };
  }
}

export class MockSmsProvider implements SmsProvider {
  readonly id = "mock-sms";
  readonly label = "SMS (non configuré)";
  readonly connected = false;
  async send(to: string) {
    console.info(`[mock-sms] SMS NON envoyé à ${to} (aucune intégration configurée)`);
    return { ok: false, simulated: true };
  }
}

export class MockDriveProvider implements DriveProvider {
  readonly id = "mock-drive";
  readonly label = "Stockage (simulation)";
  readonly connected = false;
  async upload() {
    return { ok: true, simulated: true };
  }
}

export class MockInventoryProvider implements InventoryProvider {
  readonly id = "mock-inventory";
  constructor(private readonly demo: boolean) {}
  async lowStock(): Promise<StockLevel[]> {
    // Données fictives uniquement pour l'entreprise de démonstration.
    return this.demo ? [{ label: "Raccords laiton 20/27", quantity: 4, threshold: 10 }] : [];
  }
}
