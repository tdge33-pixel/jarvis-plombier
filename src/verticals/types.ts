/**
 * Configuration d'un métier (« vertical »).
 *
 * Le moteur de Jarvis (src/core) est générique. Tout ce qui est propre à un métier
 * — vocabulaire, types d'interventions, questions d'onboarding, gabarits de devis,
 * règles proactives spécifiques — vit dans src/verticals/<metier>.
 * Pour créer « Jarvis Électricien », on ajoute src/verticals/electricien sans toucher au moteur.
 */

export interface InterventionType {
  key: string;
  label: string;
  defaultDurationMinutes: number;
  /** Mots-clés (normalisés, sans accents) permettant de reconnaître ce type dans une phrase. */
  keywords: string[];
}

export interface QuoteTemplate {
  key: string;
  label: string;
  keywords: string[];
  laborHours: number;
  materials: Array<{ label: string; unitPrice: number }>;
}

export type OnboardingAnswerType = "text" | "yesno" | "number" | "choices" | "hours";

export interface OnboardingQuestion {
  key: string;
  question: string;
  help?: string;
  type: OnboardingAnswerType;
  placeholder?: string;
  choices?: string[];
  multiple?: boolean;
  optional?: boolean;
  /** Question posée seulement si la condition est vraie. */
  when?: (answers: Record<string, unknown>) => boolean;
}

export interface VerticalConfig {
  id: string;
  /** Nom du métier, au singulier : « plombier ». */
  trade: string;
  productName: string;
  tagline: string;
  /** Description du métier injectée dans le prompt système de l'IA. */
  promptExpertise: string;
  interventionTypes: InterventionType[];
  quoteTemplates: QuoteTemplate[];
  onboarding: OnboardingQuestion[];
  /** Exemples de demandes affichés à l'utilisateur. */
  examplePrompts: string[];
  defaultServices: string[];
}
