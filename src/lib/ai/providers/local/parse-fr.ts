/**
 * Extraction d'entités en français (dates, heures, durées, montants, noms).
 * Utilisé par le moteur local ; sans dépendance externe.
 */
import { addDays, isoWeekday } from "@/lib/dates";
import { normalize } from "@/lib/format";

const WEEKDAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
const MONTHS = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Texte normalisé : minuscules, sans accents, apostrophes uniformisées. */
export function norm(text: string): string {
  return normalize(text).replace(/[’`]/g, "'");
}

export interface DateRange {
  from: string;
  to: string; // exclu
  label: string;
}

/** Trouve une date dans la phrase. `today` = "YYYY-MM-DD". */
export function parseDate(text: string, today: string): string | null {
  const t = norm(text);
  if (/apres[- ]demain/.test(t)) return addDays(today, 2);
  if (/\bdemain\b/.test(t)) return addDays(today, 1);
  if (/\b(aujourd'hui|aujourdhui|ce matin|cet apres-midi|ce soir|tout a l'heure)\b/.test(t)) return today;
  if (/\bhier\b/.test(t)) return addDays(today, -1);

  // 18/10, 18/10/2026, 18-10
  const slash = t.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (slash) {
    const d = Number(slash[1]);
    const m = Number(slash[2]);
    let y = slash[3] ? Number(slash[3]) : Number(today.slice(0, 4));
    if (y < 100) y += 2000;
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12) {
      const candidate = `${y}-${pad(m)}-${pad(d)}`;
      return !slash[3] && candidate < today ? `${y + 1}-${pad(m)}-${pad(d)}` : candidate;
    }
  }

  // "18 octobre", "le 1er novembre"
  const named = t.match(new RegExp(`\\b(\\d{1,2})(?:er)?\\s+(${MONTHS.join("|")})(?:\\s+(\\d{4}))?`));
  if (named) {
    const d = Number(named[1]);
    const m = MONTHS.indexOf(named[2]!) + 1;
    const y = named[3] ? Number(named[3]) : Number(today.slice(0, 4));
    const candidate = `${y}-${pad(m)}-${pad(d)}`;
    return !named[3] && candidate < today ? `${y + 1}-${pad(m)}-${pad(d)}` : candidate;
  }

  // "vendredi", "lundi prochain", "ce jeudi"
  for (let i = 0; i < WEEKDAYS.length; i++) {
    if (new RegExp(`\\b${WEEKDAYS[i]}\\b`).test(t)) {
      const target = i + 1;
      let delta = (target - isoWeekday(today) + 7) % 7;
      if (delta === 0) delta = 7;
      if (/semaine prochaine/.test(t) && addDays(today, delta) < addDays(today, 8 - isoWeekday(today))) delta += 7;
      return addDays(today, delta);
    }
  }

  // "le 18"
  const dayOnly = t.match(/\ble (\d{1,2})\b(?!\s*(h|:|heures?|min|€|eur))/);
  if (dayOnly) {
    const d = Number(dayOnly[1]);
    if (d >= 1 && d <= 31) {
      const [y, m] = today.split("-").map(Number);
      let candidate = `${y}-${pad(m!)}-${pad(d)}`;
      if (candidate < today) {
        const nm = m! === 12 ? 1 : m! + 1;
        const ny = m! === 12 ? y! + 1 : y!;
        candidate = `${ny}-${pad(nm)}-${pad(d)}`;
      }
      return candidate;
    }
  }
  return null;
}

/** Périodes : "cette semaine", "la semaine prochaine". */
export function parseRange(text: string, today: string): DateRange | null {
  const t = norm(text);
  const monday = addDays(today, 1 - isoWeekday(today));
  if (/semaine prochaine/.test(t)) return { from: addDays(monday, 7), to: addDays(monday, 14), label: "la semaine prochaine" };
  if (/(cette semaine|de la semaine|7 prochains jours|sept prochains jours)/.test(t)) return { from: today, to: addDays(monday, 7), label: "cette semaine" };
  return null;
}

/** Retire les durées ("pendant 2h", "4 heures de main d'oeuvre") pour ne pas les confondre avec une heure. */
function withoutDurations(t: string): string {
  return t
    .replace(/(pendant|duree( de)?|prevoir|compter|environ)\s*\d+\s*(h|heures?)(\s*\d{2})?/g, " ")
    .replace(/\d+([.,]\d+)?\s*(h|heures?)\s*(de )?(main|mo\b|travail)/g, " ")
    .replace(/\d+\s*(min|minutes)/g, " ");
}

/** Heure "HH:mm" : "14h", "14h30", "14:30", "à 9 heures", "midi". */
export function parseTime(text: string): string | null {
  const t = withoutDurations(norm(text));
  if (/\bmidi\b/.test(t)) return "12:00";
  const m = t.match(/\b(?:a|vers|pour|des|de|entre)?\s*(\d{1,2})\s*(?:h|:|heures?)\s*(\d{2})?\b/);
  if (m) {
    const h = Number(m[1]);
    const min = m[2] ? Number(m[2]) : 0;
    if (h >= 0 && h <= 23 && min < 60) return `${pad(h)}:${pad(min)}`;
  }
  if (/\b(en debut de matinee|tot le matin)\b/.test(t)) return "08:00";
  if (/\b(le matin|ce matin|dans la matinee)\b/.test(t)) return "09:00";
  if (/\b(l'apres-midi|cet apres-midi|dans l'apres-midi|apres-midi)\b/.test(t)) return "14:00";
  return null;
}

/** Durée en minutes : "pendant 2h", "durée 1h30", "45 min". */
export function parseDuration(text: string): number | null {
  const t = norm(text);
  const h = t.match(/(?:pendant|duree(?: de)?|prevoir|compter)\s*(\d+)\s*(?:h|heures?)\s*(\d{2})?/);
  if (h) return Number(h[1]) * 60 + (h[2] ? Number(h[2]) : 0);
  const m = t.match(/(?:pendant|duree(?: de)?|prevoir|compter)\s*(\d+)\s*(?:min|minutes)/);
  if (m) return Number(m[1]);
  return null;
}

/** Minutes de retard : "20 minutes de retard", "un quart d'heure". */
export function parseDelayMinutes(text: string): number | null {
  const t = norm(text);
  const m = t.match(/(\d+)\s*(?:min|minutes|mn)/);
  if (m) return Number(m[1]);
  if (/quart d'heure/.test(t)) return 15;
  if (/demi[- ]heure/.test(t)) return 30;
  const h = t.match(/(\d+)\s*(?:h|heures?)\s*de retard/);
  if (h) return Number(h[1]) * 60;
  return null;
}

/** Heures de main-d'œuvre : "4 heures de main-d'oeuvre", "2h de MO". */
export function parseLaborHours(text: string): number | null {
  const t = norm(text);
  const m = t.match(/(\d+(?:[.,]\d+)?)\s*(?:h|heures?)\s*(?:de\s*)?(?:main|mo\b|travail)/);
  return m ? Number(m[1]!.replace(",", ".")) : null;
}

/** Montants : "chauffe-eau 620 €", "raccords : 45 euros". */
export function parsePricedItems(original: string): Array<{ label: string; price: number }> {
  const items: Array<{ label: string; price: number }> = [];
  const re = /([\p{L}0-9][\p{L}0-9 '’\-/]*?)\s*(?::|=|à|a|pour)?\s*(\d+(?:[.,]\d{1,2})?)\s*(?:€|euros?|eur)(?!\p{L})/giu;
  for (const m of original.matchAll(re)) {
    const label = m[1]!
      .replace(/^(et|avec|plus|le|la|les|un|une|du|des|de)\s+/i, "")
      .trim();
    const price = Number(m[2]!.replace(",", "."));
    if (label && price > 0 && !/^(main|déplacement|deplacement)/i.test(label)) {
      items.push({ label: label.charAt(0).toUpperCase() + label.slice(1), price });
    }
  }
  return items;
}

const NOT_NAMES = new Set(
  [
    "ajoute", "ajouter", "prepare", "preparer", "prepare-moi", "rappelle", "rappelle-moi", "note", "retiens", "previens", "prevenir",
    "cree", "creer", "mets", "met", "planifie", "programme", "cale", "deplace", "decale", "reporte", "annule", "envoie", "envoyer",
    "jarvis", "sms", "email", "mail", "devis", "rdv", "rendez-vous", "intervention", "tache", "client", "cliente", "atlantic", "cedeo",
    "bonjour", "salut", "merci", "est-ce", "qu'est-ce", "quel", "quelle", "quels", "quelles", "ou", "qui", "que", "mon", "ma", "mes",
    "le", "la", "les", "un", "une", "je", "j'ai", "il", "elle", "on", "vous", "nous", "dis", "donne", "trouve", "cherche", "montre",
    "remplacement", "fuite", "chauffe-eau", "l", "d", "de", "du", "des", "pour", "avec", "et", "a", "au", "en", "chez",
    ...WEEKDAYS, ...MONTHS,
  ].map((w) => norm(w)),
);

/**
 * Nom de client probable.
 * Priorité : mot après une civilité (Mme, M., Monsieur…) ou « chez », puis mot capitalisé.
 */
export function extractClientName(original: string): string | null {
  const civ = original.match(/\b(?:Mme|Madame|Mlle|Mademoiselle|M\.|Mr|Monsieur|chez|client(?:e)?|famille)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’-]+(?:\s+[A-ZÀ-Ý][A-Za-zÀ-ÿ'’-]+)?)/i);
  if (civ && !NOT_NAMES.has(norm(civ[1]!.split(/\s+/)[0]!))) return civ[1]!.trim();
  const words = original.split(/[\s,;:!?.()]+/).filter(Boolean);
  for (let i = 1; i < words.length; i++) {
    const w = words[i]!;
    if (/^[A-ZÀ-Ý][a-zà-ÿ'’-]{2,}$/.test(w) && !NOT_NAMES.has(norm(w))) return w;
  }
  return null;
}

/** Texte situé après « que » / « : », utile pour les mémoires et les tâches. */
export function afterKeyword(original: string, patterns: RegExp[]): string | null {
  for (const p of patterns) {
    const m = original.match(p);
    if (m && m.index !== undefined) {
      const rest = original.slice(m.index + m[0].length).trim();
      if (rest) return rest.replace(/^[:\-–]\s*/, "").replace(/[.!]+$/, "").trim();
    }
  }
  return null;
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function extractPhone(text: string): string | null {
  const m = text.match(/(?:\+33\s?|0)[1-9](?:[\s.-]?\d{2}){4}/);
  return m ? m[0] : null;
}

export function extractEmail(text: string): string | null {
  const m = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  return m ? m[0] : null;
}
