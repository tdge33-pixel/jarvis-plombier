/**
 * Modèle de domaine partagé par toute l'application.
 * Ces types reflètent 1:1 les tables PostgreSQL (supabase/migrations).
 * Ils sont indépendants du métier : un électricien ou un garage utilisent les mêmes.
 */

export type ID = string;
/** Date ISO 8601 complète (timestamptz). */
export type ISODateTime = string;
/** Date calendaire "YYYY-MM-DD". */
export type ISODate = string;

export type MemberRole = "owner" | "admin" | "member";

export interface Profile {
  id: ID;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  created_at: ISODateTime;
}

export interface Business {
  id: ID;
  name: string;
  vertical: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  siret: string | null;
  works_alone: boolean;
  team_size: number;
  zone_radius_km: number | null;
  timezone: string;
  is_demo: boolean;
  onboarded_at: ISODateTime | null;
  created_at: ISODateTime;
}

export interface BusinessMember {
  id: ID;
  business_id: ID;
  user_id: ID;
  role: MemberRole;
  created_at: ISODateTime;
}

/** Ce que l'utilisateur autorise Jarvis à faire (page Paramètres > Permissions). */
export interface JarvisPermissions {
  auto_create_tasks: boolean;
  create_appointments: boolean;
  modify_appointments: boolean;
  prepare_quotes: boolean;
  save_preferences: boolean;
  draft_messages: boolean;
}

export interface BusinessSettings {
  business_id: ID;
  hourly_rate: number;
  travel_fee: number;
  vat_rate: number;
  quote_validity_days: number;
  work_start: string; // "08:00"
  work_end: string; // "18:00"
  /** Jours travaillés, ISO : 1 = lundi … 7 = dimanche. */
  working_days: number[];
  emergencies_accepted: boolean;
  emergency_until: string | null; // "20:00"
  max_appointments_per_day: number;
  services: string[];
  refused_services: string[];
  suppliers: string[];
  calendar_tool: string | null;
  invoicing_tool: string | null;
  signature: string | null;
  permissions: JarvisPermissions;
  updated_at: ISODateTime;
}

export type Civility = "M." | "Mme" | null;

export interface Client {
  id: ID;
  business_id: ID;
  civility: Civility;
  first_name: string | null;
  last_name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  notes: string | null;
  important_info: string | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface ClientNote {
  id: ID;
  business_id: ID;
  client_id: ID;
  content: string;
  created_by: ID | null;
  created_at: ISODateTime;
}

export type AppointmentStatus = "to_confirm" | "confirmed" | "in_progress" | "done" | "cancelled";

export interface Appointment {
  id: ID;
  business_id: ID;
  client_id: ID | null;
  title: string;
  intervention_type: string;
  start_at: ISODateTime;
  duration_minutes: number;
  address: string | null;
  city: string | null;
  status: AppointmentStatus;
  notes: string | null;
  external_event_id: string | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export type QuoteStatus = "draft" | "sent" | "accepted" | "refused" | "expired";

export interface Quote {
  id: ID;
  business_id: ID;
  client_id: ID | null;
  number: string;
  title: string;
  description: string | null;
  status: QuoteStatus;
  vat_rate: number;
  total_ht: number;
  total_vat: number;
  total_ttc: number;
  notes: string | null;
  valid_until: ISODate | null;
  sent_at: ISODateTime | null;
  created_by: "user" | "ai";
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export type QuoteItemKind = "labor" | "material" | "travel" | "other";

export interface QuoteItem {
  id: ID;
  business_id: ID;
  quote_id: ID;
  kind: QuoteItemKind;
  label: string;
  quantity: number;
  unit_price: number;
  position: number;
  created_at: ISODateTime;
}

export type TaskStatus = "todo" | "done";
export type TaskPriority = "normal" | "high";

export interface Task {
  id: ID;
  business_id: ID;
  title: string;
  description: string | null;
  due_date: ISODate | null;
  priority: TaskPriority;
  status: TaskStatus;
  client_id: ID | null;
  quote_id: ID | null;
  created_by: "user" | "ai";
  completed_at: ISODateTime | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

/**
 * Catégories de mémoire.
 * INFERRED = déduit par Jarvis. Ne devient JAMAIS une RULE automatiquement :
 * après validation explicite de l'utilisateur il devient une PREFERENCE.
 */
export const MEMORY_CATEGORIES = [
  "FACT",
  "PREFERENCE",
  "RULE",
  "BUSINESS_INFO",
  "CLIENT_INFO",
  "TEMPORARY",
  "INFERRED",
] as const;
export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

export const MEMORY_SECTIONS = ["business", "preferences", "rules", "suppliers", "pricing", "habits"] as const;
export type MemorySection = (typeof MEMORY_SECTIONS)[number];

/** active = utilisée par Jarvis ; disabled = conservée mais ignorée ; pending = suggestion à valider ; rejected = refusée. */
export type MemoryStatus = "active" | "disabled" | "pending" | "rejected";
export type MemorySource = "user" | "onboarding" | "jarvis";

export interface Memory {
  id: ID;
  business_id: ID;
  /** null = mémoire de l'entreprise ; sinon préférence personnelle d'un utilisateur. */
  user_id: ID | null;
  category: MemoryCategory;
  section: MemorySection;
  content: string;
  /** Clé technique facultative (ex : "inferred:avoid_after_18h") pour éviter les doublons. */
  key: string | null;
  status: MemoryStatus;
  source: MemorySource;
  confidence: number | null;
  evidence: string | null;
  snoozed_until: ISODateTime | null;
  expires_at: ISODateTime | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface Conversation {
  id: ID;
  business_id: ID;
  user_id: ID;
  title: string;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export type MessageRole = "user" | "assistant";

export interface Message {
  id: ID;
  business_id: ID;
  conversation_id: ID;
  role: MessageRole;
  content: string;
  /** Blocs d'interface (cartes) produits par les outils — jamais inventés par l'IA. */
  blocks: unknown[];
  created_at: ISODateTime;
}

export type AgentActionStatus = "PENDING_CONFIRMATION" | "CONFIRMED" | "EXECUTED" | "FAILED" | "CANCELLED";

export interface AgentAction {
  id: ID;
  business_id: ID;
  conversation_id: ID | null;
  user_id: ID | null;
  action: string; // ex : CREATE_APPOINTMENT
  tool_name: string;
  level: 1 | 2 | 3;
  status: AgentActionStatus;
  initiated_by: "AI" | "USER";
  summary: string;
  args: Record<string, unknown>;
  result: unknown;
  error: string | null;
  /** Date de validation explicite par l'utilisateur (null si exécutée sans confirmation). */
  confirmed_at: ISODateTime | null;
  executed_at: ISODateTime | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export type IntegrationKind = "calendar" | "email" | "sms" | "drive";

export interface Integration {
  id: ID;
  business_id: ID;
  kind: IntegrationKind;
  provider: "mock" | "composio";
  /** ex : "googlecalendar", "gmail", "outlook" */
  app: string | null;
  status: "connected" | "disconnected";
  external_account_id: string | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

/** Tables isolées par entreprise (toutes portent business_id). */
export interface TenantTables {
  clients: Client;
  client_notes: ClientNote;
  appointments: Appointment;
  quotes: Quote;
  quote_items: QuoteItem;
  tasks: Task;
  memories: Memory;
  conversations: Conversation;
  messages: Message;
  agent_actions: AgentAction;
  integrations: Integration;
}
export type TenantTable = keyof TenantTables;

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  to_confirm: "À confirmer",
  confirmed: "Confirmé",
  in_progress: "En cours",
  done: "Terminé",
  cancelled: "Annulé",
};

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: "Brouillon",
  sent: "Envoyé",
  accepted: "Accepté",
  refused: "Refusé",
  expired: "Expiré",
};

export const MEMORY_SECTION_LABELS: Record<MemorySection, string> = {
  business: "Mon entreprise",
  preferences: "Mes préférences",
  rules: "Mes règles",
  suppliers: "Fournisseurs",
  pricing: "Tarifs",
  habits: "Habitudes",
};

export const MEMORY_CATEGORY_LABELS: Record<MemoryCategory, string> = {
  FACT: "Information",
  PREFERENCE: "Préférence",
  RULE: "Règle",
  BUSINESS_INFO: "Entreprise",
  CLIENT_INFO: "Client",
  TEMPORARY: "Temporaire",
  INFERRED: "Suggestion de Jarvis",
};

export const DEFAULT_PERMISSIONS: JarvisPermissions = {
  auto_create_tasks: true,
  create_appointments: true,
  modify_appointments: true,
  prepare_quotes: true,
  save_preferences: true,
  draft_messages: true,
};
