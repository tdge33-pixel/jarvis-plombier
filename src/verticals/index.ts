import { plombier } from "./plombier";
import type { VerticalConfig } from "./types";

export type { VerticalConfig } from "./types";

/** Registre des métiers disponibles. Ajouter ici « electricien », « coiffeur », etc. */
const VERTICALS: Record<string, VerticalConfig> = {
  plombier,
};

export const DEFAULT_VERTICAL = "plombier";

export function getVertical(id: string | null | undefined): VerticalConfig {
  return VERTICALS[id ?? DEFAULT_VERTICAL] ?? plombier;
}
