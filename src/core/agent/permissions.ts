import type { JarvisPermissions } from "@/lib/domain/types";
import type { AgentTool } from "./types";

export const PERMISSION_LABELS: Record<keyof JarvisPermissions, string> = {
  auto_create_tasks: "créer automatiquement des tâches",
  create_appointments: "créer des rendez-vous après validation",
  modify_appointments: "modifier des rendez-vous",
  prepare_quotes: "préparer des devis",
  save_preferences: "enregistrer de nouvelles préférences",
  draft_messages: "préparer des messages clients",
};

export type PermissionDecision = { allowed: true; needsConfirmation: boolean } | { allowed: false; reason: string };

/**
 * Décide si un outil peut s'exécuter et s'il faut demander confirmation.
 * Le niveau 3 exige TOUJOURS une confirmation explicite, quels que soient les réglages.
 */
export function decide(tool: AgentTool, permissions: JarvisPermissions): PermissionDecision {
  // « Créer automatiquement des tâches » désactivé ⇒ Jarvis peut toujours proposer, avec confirmation.
  const softPermission = tool.permission === "auto_create_tasks";
  if (tool.permission && !permissions[tool.permission] && !softPermission) {
    return {
      allowed: false,
      reason: `Vous n'avez pas autorisé Jarvis à ${PERMISSION_LABELS[tool.permission]}. Vous pouvez l'activer dans Paramètres › Permissions Jarvis.`,
    };
  }
  if (tool.level === 3) return { allowed: true, needsConfirmation: true };
  const policy = tool.confirmation;
  const needsConfirmation = policy === "always" ? true : policy === "never" ? false : policy(permissions);
  return { allowed: true, needsConfirmation };
}
