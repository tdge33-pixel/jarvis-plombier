/**
 * Blocs d'interface affichés dans la conversation.
 * Ils sont produits UNIQUEMENT par les outils à partir de données réelles :
 * l'IA ne peut pas « inventer » une carte de rendez-vous ou de devis.
 * Ce fichier est partagé client/serveur (pas d'import serveur ici).
 */

export interface AppointmentCard {
  id: string;
  date: string;
  time: string;
  end_time: string;
  client_name: string | null;
  client_phone: string | null;
  intervention_type: string;
  city: string | null;
  address: string | null;
  status: string;
}

export interface ClientCard {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string;
  notes: string | null;
  important_info: string | null;
}

export interface EditableField {
  key: string;
  label: string;
  type: "text" | "date" | "time" | "number" | "textarea";
  value: string | number;
}

export type UIBlock =
  | { type: "appointments"; title: string; date?: string; items: AppointmentCard[] }
  | { type: "availability"; date: string; freeSlots: string[]; warnings: string[] }
  | { type: "clients"; items: ClientCard[] }
  | {
      type: "client_history";
      client: ClientCard;
      appointments: Array<{ date: string; intervention_type: string; status: string; notes: string | null }>;
      quotes: Array<{ id: string; number: string; title: string; status: string; total_ttc: number }>;
      notes: Array<{ date: string; content: string }>;
    }
  | {
      type: "confirmation";
      actionId: string;
      title: string;
      lines: string[];
      warnings: string[];
      fields: EditableField[];
      level: 1 | 2 | 3;
      /** Statut courant (mis à jour au chargement de la conversation). */
      status?: "PENDING_CONFIRMATION" | "CONFIRMED" | "EXECUTED" | "FAILED" | "CANCELLED";
    }
  | {
      type: "quote";
      id: string;
      number: string;
      title: string;
      client_name: string | null;
      status: string;
      lines: Array<{ label: string; quantity: number; unit_price: number; kind: string }>;
      total_ht: number;
      total_ttc: number;
      vat_rate: number;
    }
  | { type: "quotes"; items: Array<{ id: string; number: string; title: string; client_name: string | null; status: string; total_ttc: number; days_since_sent: number | null }> }
  | { type: "message_draft"; channel: "sms" | "email"; recipient: string | null; phone: string | null; email: string | null; subject?: string; body: string; canSend: boolean }
  | { type: "task"; id: string; title: string; due_date: string | null; priority: string; client_name: string | null }
  | { type: "tasks"; title: string; items: Array<{ id: string; title: string; due_date: string | null; priority: string; client_name: string | null }> }
  | { type: "memory"; id: string; content: string; category: string; section: string }
  | { type: "memories"; items: Array<{ id: string; content: string; category: string; section: string }> }
  | { type: "memory_suggestion"; memoryId: string; content: string; evidence: string | null };

/** Message tel qu'affiché dans l'interface de conversation. */
export interface ChatUIMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  blocks: UIBlock[];
  created_at: string;
}
