/**
 * Données de démonstration : « Martin Plomberie » (Thomas Martin, Bordeaux).
 * Les dates sont calculées par rapport à aujourd'hui pour que la démo soit toujours vivante.
 * Équivalent SQL : supabase/seed.sql (fonction seed_demo_business).
 */
import crypto from "node:crypto";
import type {
  Appointment,
  AppointmentStatus,
  Client,
  Memory,
  MemoryCategory,
  MemorySection,
  Quote,
  QuoteItem,
  QuoteStatus,
  Task,
} from "@/lib/domain/types";
import { DEFAULT_PERMISSIONS } from "@/lib/domain/types";
import { addDays, DEFAULT_TZ, isoWeekday, today, zonedToUtc } from "@/lib/dates";
import { round2 } from "@/lib/format";
import type { DemoDb } from "./db";
import { hashPassword } from "./password";

import { DEMO_EMAIL, DEMO_PASSWORD } from "./constants";

const uid = () => crypto.randomUUID();

/** Décale au jour ouvré suivant si la date tombe un dimanche. */
function workday(date: string): string {
  return isoWeekday(date) === 7 ? addDays(date, 1) : date;
}

export function buildDemoSeed(db: DemoDb): void {
  const tz = DEFAULT_TZ;
  const T = today(tz);
  const nowIso = new Date().toISOString();
  const daysAgoIso = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

  const userId = uid();
  const businessId = uid();

  db.users.push({ id: userId, email: DEMO_EMAIL, password_hash: hashPassword(DEMO_PASSWORD) });
  db.profiles.push({ id: userId, email: DEMO_EMAIL, first_name: "Thomas", last_name: "Martin", phone: "06 12 34 56 78", created_at: daysAgoIso(120) });
  db.businesses.push({
    id: businessId,
    name: "Martin Plomberie",
    vertical: "plombier",
    phone: "06 12 34 56 78",
    email: DEMO_EMAIL,
    address: "8 rue des Artisans",
    postal_code: "33000",
    city: "Bordeaux",
    siret: "123 456 789 00012",
    works_alone: true,
    team_size: 1,
    zone_radius_km: 30,
    timezone: tz,
    is_demo: true,
    onboarded_at: daysAgoIso(120),
    created_at: daysAgoIso(120),
  });
  db.business_members.push({ id: uid(), business_id: businessId, user_id: userId, role: "owner", created_at: daysAgoIso(120) });
  db.business_settings.push({
    business_id: businessId,
    hourly_rate: 65,
    travel_fee: 35,
    vat_rate: 10,
    quote_validity_days: 30,
    work_start: "08:00",
    work_end: "18:00",
    working_days: [1, 2, 3, 4, 5, 6],
    emergencies_accepted: true,
    emergency_until: "20:00",
    max_appointments_per_day: 5,
    services: ["Recherche de fuite", "Débouchage", "Chauffe-eau", "Robinetterie", "Salle de bain", "WC"],
    refused_services: ["Chauffage au fioul", "Climatisation"],
    suppliers: ["Cedeo Bordeaux Lac", "Point P Mérignac"],
    calendar_tool: "Google Agenda",
    invoicing_tool: "Excel",
    signature: "Thomas",
    permissions: { ...DEFAULT_PERMISSIONS },
    updated_at: nowIso,
  });

  // ---------------------------------------------------------------- Clients
  const base = { business_id: businessId, company: null, created_at: daysAgoIso(90), updated_at: daysAgoIso(10) };
  const mkClient = (c: Omit<Client, keyof typeof base | "id">): Client => ({ ...base, id: uid(), ...c });
  const dupont = mkClient({ civility: "Mme", first_name: "Sylvie", last_name: "Dupont", phone: "06 21 43 65 87", email: "sylvie.dupont@email.fr", address: "14 avenue Jean Jaurès", postal_code: "33150", city: "Cenon", lat: 44.8578, lng: -0.5317, notes: "Maison avec sous-sol. Chauffe-eau 200 L de 2009.", important_info: "Code portail : 1234B" });
  const martin = mkClient({ civility: "Mme", first_name: "Claire", last_name: "Martin", phone: "06 98 76 54 32", email: "claire.martin@email.fr", address: "12 rue Sainte-Catherine", postal_code: "33000", city: "Bordeaux", lat: 44.8378, lng: -0.5736, notes: "Appartement 3e étage sans ascenseur.", important_info: "Cliente disponible de préférence le matin." });
  const bernard = mkClient({ civility: "M.", first_name: "Paul", last_name: "Bernard", phone: "07 11 22 33 44", email: "paul.bernard@email.fr", address: "5 rue du Port", postal_code: "33310", city: "Lormont", lat: 44.8792, lng: -0.5217, notes: "Problème de pression récurrent.", important_info: null });
  const lefevre = mkClient({ civility: "M.", first_name: "Julien", last_name: "Lefèvre", phone: "06 55 44 33 22", email: null, address: "27 cours de la Libération", postal_code: "33400", city: "Talence", lat: 44.8025, lng: -0.5886, notes: null, important_info: null });
  const garcia = mkClient({ civility: "Mme", first_name: "Ana", last_name: "Garcia", phone: "06 77 88 99 00", email: "ana.garcia@email.fr", address: "3 allée des Pins", postal_code: "33700", city: "Mérignac", lat: 44.8386, lng: -0.6436, notes: "Projet de rénovation salle de bain.", important_info: "Préfère être contactée par SMS." });
  const moreau = mkClient({ civility: "M.", first_name: "Henri", last_name: "Moreau", phone: "05 56 12 34 56", email: null, address: "40 rue Carnot", postal_code: "33130", city: "Bègles", lat: 44.8086, lng: -0.5478, notes: "Client fidèle depuis 2019.", important_info: null });
  db.clients.push(dupont, martin, bernard, lefevre, garcia, moreau);

  db.client_notes.push(
    { id: uid(), business_id: businessId, client_id: martin.id, content: "Robinet cuisine Grohe remplacé, ancien joint très entartré.", created_by: userId, created_at: daysAgoIso(30) },
    { id: uid(), business_id: businessId, client_id: dupont.id, content: "Chauffe-eau en fin de vie, devis de remplacement à proposer.", created_by: userId, created_at: daysAgoIso(60) },
  );

  // ---------------------------------------------------------- Rendez-vous
  const appt = (client: Client, date: string, time: string, duration: number, type: string, status: AppointmentStatus, notes: string | null = null): Appointment => ({
    id: uid(),
    business_id: businessId,
    client_id: client.id,
    title: type,
    intervention_type: type,
    start_at: zonedToUtc(date, time, tz),
    duration_minutes: duration,
    address: client.address,
    city: client.city,
    status,
    notes,
    external_event_id: null,
    created_at: daysAgoIso(14),
    updated_at: daysAgoIso(2),
  });
  const tomorrow = workday(addDays(T, 1));
  const appointments: Appointment[] = [
    appt(dupont, addDays(T, -60), "09:00", 120, "Détartrage chauffe-eau", "done", "Chauffe-eau vieillissant, prévoir remplacement."),
    appt(martin, addDays(T, -30), "10:00", 90, "Remplacement robinet cuisine", "done", "Robinet Grohe posé. Cliente satisfaite."),
    appt(bernard, addDays(T, -12), "14:00", 60, "Recherche de fuite", "done", "Fuite sur raccord sous l'évier, réparée."),
    appt(lefevre, addDays(T, -20), "18:30", 60, "Débouchage", "cancelled", "Annulé : créneau trop tardif."),
    appt(garcia, addDays(T, -15), "19:00", 60, "Visite technique", "cancelled", "Annulé : reporté au matin."),
    appt(moreau, addDays(T, -8), "18:30", 45, "Fuite chasse d'eau", "cancelled", "Annulé : trop tard dans la journée."),
    appt(martin, tomorrow, "08:30", 60, "Fuite sous évier", "confirmed"),
    appt(dupont, tomorrow, "11:00", 180, "Remplacement chauffe-eau", "confirmed", "Chauffe-eau Atlantic 200 L à récupérer chez Cedeo."),
    appt(bernard, tomorrow, "15:30", 60, "Diagnostic pression", "to_confirm"),
    appt(moreau, workday(addDays(T, 3)), "10:00", 120, "Remplacement WC", "confirmed"),
    appt(garcia, workday(addDays(T, 6)), "09:00", 240, "Salle de bain : pose receveur de douche", "to_confirm"),
  ];
  if (isoWeekday(T) !== 7) {
    appointments.push(
      appt(lefevre, T, "09:00", 90, "Débouchage canalisation", "done", "Canalisation cuisine débouchée."),
      appt(garcia, T, "14:00", 90, "Installation mitigeur thermostatique", "confirmed"),
    );
  }
  db.appointments.push(...appointments);

  // ------------------------------------------------------------------ Devis
  const mkQuote = (client: Client, number: string, title: string, status: QuoteStatus, createdDaysAgo: number, sentDaysAgo: number | null, items: Array<Pick<QuoteItem, "kind" | "label" | "quantity" | "unit_price">>, description: string | null = null) => {
    const id = uid();
    const ht = round2(items.reduce((s, i) => s + i.quantity * i.unit_price, 0));
    const vat = round2(ht * 0.1);
    const quote: Quote = {
      id,
      business_id: businessId,
      client_id: client.id,
      number,
      title,
      description,
      status,
      vat_rate: 10,
      total_ht: ht,
      total_vat: vat,
      total_ttc: round2(ht + vat),
      notes: null,
      valid_until: addDays(T, 30 - createdDaysAgo),
      sent_at: sentDaysAgo === null ? null : daysAgoIso(sentDaysAgo),
      created_by: "user",
      created_at: daysAgoIso(createdDaysAgo),
      updated_at: daysAgoIso(sentDaysAgo ?? createdDaysAgo),
    };
    db.quotes.push(quote);
    items.forEach((it, position) => db.quote_items.push({ id: uid(), business_id: businessId, quote_id: id, position, created_at: quote.created_at, ...it }));
    return quote;
  };
  mkQuote(martin, "D-2026-012", "Remplacement robinet cuisine", "accepted", 35, 34, [
    { kind: "material", label: "Mitigeur évier Grohe", quantity: 1, unit_price: 145 },
    { kind: "labor", label: "Main-d'œuvre", quantity: 1.5, unit_price: 65 },
    { kind: "travel", label: "Déplacement", quantity: 1, unit_price: 35 },
  ]);
  const quoteDupont = mkQuote(dupont, "D-2026-014", "Remplacement chauffe-eau 200 L", "sent", 12, 11, [
    { kind: "material", label: "Chauffe-eau Atlantic 200 L", quantity: 1, unit_price: 620 },
    { kind: "material", label: "Groupe de sécurité + raccords", quantity: 1, unit_price: 48 },
    { kind: "labor", label: "Main-d'œuvre", quantity: 4, unit_price: 65 },
    { kind: "travel", label: "Déplacement", quantity: 1, unit_price: 35 },
  ], "Dépose de l'ancien chauffe-eau, fourniture et pose d'un chauffe-eau électrique Atlantic 200 L, mise en service.");
  mkQuote(garcia, "D-2026-015", "Remplacement baignoire par douche", "sent", 5, 4, [
    { kind: "material", label: "Receveur extra-plat 120×90", quantity: 1, unit_price: 320 },
    { kind: "material", label: "Colonne de douche thermostatique", quantity: 1, unit_price: 260 },
    { kind: "labor", label: "Main-d'œuvre", quantity: 14, unit_price: 65 },
    { kind: "travel", label: "Déplacement", quantity: 2, unit_price: 35 },
  ]);
  const quoteBernard = mkQuote(bernard, "D-2026-016", "Remplacement réducteur de pression", "draft", 2, null, [
    { kind: "material", label: "Réducteur de pression 20/27", quantity: 1, unit_price: 85 },
    { kind: "labor", label: "Main-d'œuvre", quantity: 1.5, unit_price: 65 },
    { kind: "travel", label: "Déplacement", quantity: 1, unit_price: 35 },
  ]);

  // ---------------------------------------------------------------- Tâches
  const task = (title: string, due: string | null, priority: Task["priority"], client: Client | null, extra: Partial<Task> = {}): Task => ({
    id: uid(),
    business_id: businessId,
    title,
    description: null,
    due_date: due,
    priority,
    status: "todo",
    client_id: client?.id ?? null,
    quote_id: null,
    created_by: "user",
    completed_at: null,
    created_at: daysAgoIso(3),
    updated_at: daysAgoIso(3),
    ...extra,
  });
  db.tasks.push(
    task("Rappeler Mme Dupont pour le devis chauffe-eau", T, "high", dupont, { quote_id: quoteDupont.id }),
    task("Commander le chauffe-eau de Mme Dupont chez Cedeo", T, "high", dupont),
    task("Relancer le devis de M. Bernard", addDays(T, -2), "normal", bernard, { quote_id: quoteBernard.id }),
    task("Vérifier la facture fournisseur Point P", addDays(T, 3), "normal", null),
    task("Rappeler M. Moreau pour confirmer l'heure", addDays(T, 1), "normal", moreau, { created_by: "ai" }),
    task("Envoyer les photos de la fuite à l'assurance de Mme Martin", addDays(T, -5), "normal", martin, { status: "done", completed_at: daysAgoIso(4) }),
  );

  // --------------------------------------------------------------- Mémoire
  const mem = (content: string, category: MemoryCategory, section: MemorySection, source: Memory["source"] = "onboarding"): Memory => ({
    id: uid(),
    business_id: businessId,
    user_id: null,
    category,
    section,
    content,
    key: null,
    status: "active",
    source,
    confidence: null,
    evidence: null,
    snoozed_until: null,
    expires_at: null,
    created_at: daysAgoIso(100),
    updated_at: daysAgoIso(100),
  });
  db.memories.push(
    mem("Zone d'intervention : 30 km autour de Bordeaux.", "BUSINESS_INFO", "business"),
    mem("Horaires : 08h00 - 18h00, du lundi au samedi.", "BUSINESS_INFO", "business"),
    mem("Urgences acceptées jusqu'à 20h.", "BUSINESS_INFO", "business"),
    mem("Je travaille seul, sans salarié.", "FACT", "business"),
    mem("Je facture 65 € HT / heure.", "BUSINESS_INFO", "pricing"),
    mem("Déplacement : 35 €.", "BUSINESS_INFO", "pricing"),
    mem("Je ne travaille pas le dimanche.", "RULE", "rules"),
    mem("Je ne prends pas d'intervention à plus de 30 km après 17h.", "RULE", "rules", "user"),
    mem("Ne jamais planifier plus de 5 interventions dans la même journée.", "RULE", "rules", "user"),
    mem("Je préfère Atlantic pour les chauffe-eaux.", "PREFERENCE", "suppliers", "user"),
    mem("Fournisseur principal : Cedeo Bordeaux Lac. Secondaire : Point P Mérignac.", "FACT", "suppliers"),
    mem("Je préfère regrouper les interventions par zone géographique.", "PREFERENCE", "preferences", "user"),
    mem("Je préfère conserver 30 minutes entre deux grosses interventions.", "PREFERENCE", "habits", "user"),
    mem("Je signe mes messages « Thomas ».", "PREFERENCE", "habits"),
  );

  // --------------------------------------------------- Historique d'actions
  db.agent_actions.push({
    id: uid(),
    business_id: businessId,
    conversation_id: null,
    user_id: userId,
    action: "CREATE_TASK",
    tool_name: "createTask",
    level: 2,
    status: "EXECUTED",
    initiated_by: "AI",
    summary: "Tâche créée : Rappeler M. Moreau pour confirmer l'heure",
    args: { title: "Rappeler M. Moreau pour confirmer l'heure" },
    result: null,
    error: null,
    confirmed_at: null,
    executed_at: daysAgoIso(3),
    created_at: daysAgoIso(3),
    updated_at: daysAgoIso(3),
  });

  db.integrations.push(
    { id: uid(), business_id: businessId, kind: "calendar", provider: "mock", app: "googlecalendar", status: "disconnected", external_account_id: null, created_at: nowIso, updated_at: nowIso },
  );
}
