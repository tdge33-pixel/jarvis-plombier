import type { z } from "zod";
import type { AppContext } from "@/lib/context";
import type { JarvisPermissions } from "@/lib/domain/types";
import type { VerticalConfig } from "@/verticals/types";
import type { EditableField, UIBlock } from "./blocks";

/** Intentions reconnues par l'agent (journalisées dans agent_actions.action). */
export type AgentIntent =
  | "CHAT"
  | "READ_CALENDAR"
  | "SEARCH_CLIENT"
  | "CREATE_CLIENT"
  | "CREATE_APPOINTMENT"
  | "UPDATE_APPOINTMENT"
  | "CREATE_QUOTE"
  | "LIST_QUOTES"
  | "SEND_QUOTE"
  | "CREATE_TASK"
  | "LIST_TASKS"
  | "SEARCH_HISTORY"
  | "ADD_MEMORY"
  | "SUGGEST_MEMORY"
  | "SEARCH_MEMORY"
  | "DRAFT_MESSAGE";

/**
 * Niveaux de permission :
 *  1 = lecture / préparation (exécuté directement)
 *  2 = action réversible (confirmation selon les paramètres)
 *  3 = action sensible (confirmation explicite TOUJOURS)
 */
export type PermissionLevel = 1 | 2 | 3;

export interface ToolContext {
  ctx: AppContext;
  vertical: VerticalConfig;
  conversationId: string | null;
}

export interface ToolResult {
  ok: boolean;
  /** Phrase en français pour l'utilisateur, fondée uniquement sur le résultat réel. */
  summary: string;
  /** Version courte du résumé, utilisée quand des cartes affichent déjà le détail. */
  headline?: string;
  /** Données renvoyées au modèle d'IA. */
  data?: unknown;
  blocks?: UIBlock[];
}

export type Preparation<A> =
  | {
      kind: "confirm";
      /** Arguments normalisés (ex : client résolu en identifiant) qui seront exécutés après validation. */
      args: A;
      title: string;
      question: string;
      lines: string[];
      warnings: string[];
      fields: EditableField[];
    }
  /** Impossible de préparer (client introuvable, ambiguïté…) : on renvoie directement un résultat. */
  | { kind: "result"; result: ToolResult };

export type ConfirmationPolicy = "never" | "always" | ((permissions: JarvisPermissions) => boolean);

export interface AgentTool<S extends z.ZodType = z.ZodType> {
  name: string;
  intent: AgentIntent;
  level: PermissionLevel;
  /** Permission à activer dans Paramètres pour que Jarvis puisse utiliser cet outil. */
  permission?: keyof JarvisPermissions;
  confirmation: ConfirmationPolicy;
  /** Journaliser l'exécution dans l'historique des actions. */
  audit: boolean;
  description: string;
  schema: S;
  prepare?: (tc: ToolContext, args: z.infer<S>) => Promise<Preparation<z.infer<S>>>;
  execute: (tc: ToolContext, args: z.infer<S>) => Promise<ToolResult>;
}

/** Aide au typage : infère le type des arguments depuis le schéma zod. */
export function defineTool<S extends z.ZodType>(tool: AgentTool<S>): AgentTool<S> {
  return tool;
}
