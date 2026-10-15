import "server-only";
import { z } from "zod";
import type { ToolSpec } from "@/lib/ai/types";
import type { AgentTool } from "../types";
import { createAppointmentTool, getAppointmentsTool, getCalendarAvailabilityTool, updateAppointmentTool } from "./calendar";
import { createClientTool, getClientHistoryTool, searchClientTool } from "./clients";
import { addMemoryTool, searchMemoryTool, suggestPreferenceTool } from "./memory";
import { draftCustomerMessageTool } from "./messages";
import { createQuoteDraftTool, listQuotesTool, sendQuoteTool } from "./quotes";
import { createTaskTool, listTasksTool } from "./tasks";

/** Registre des outils de l'agent. Ajouter un outil = l'ajouter ici. */
export const TOOLS: AgentTool[] = [
  getAppointmentsTool,
  getCalendarAvailabilityTool,
  createAppointmentTool,
  updateAppointmentTool,
  searchClientTool,
  getClientHistoryTool,
  createClientTool,
  createQuoteDraftTool,
  listQuotesTool,
  sendQuoteTool,
  createTaskTool,
  listTasksTool,
  addMemoryTool,
  suggestPreferenceTool,
  searchMemoryTool,
  draftCustomerMessageTool,
] as AgentTool[];

const byName = new Map(TOOLS.map((t) => [t.name, t]));

export function getTool(name: string): AgentTool | undefined {
  return byName.get(name);
}

/** Spécifications envoyées au modèle d'IA (JSON Schema généré depuis zod). */
export function toolSpecs(): ToolSpec[] {
  return TOOLS.map((t) => {
    const { $schema: _ignored, ...parameters } = z.toJSONSchema(t.schema) as Record<string, unknown>;
    return { name: t.name, description: t.description, parameters };
  });
}
