/**
 * Utilitaires de dates sans dépendance, conscients du fuseau horaire de l'entreprise.
 * Les dates calendaires sont manipulées sous forme "YYYY-MM-DD" ; les instants en ISO UTC.
 */
import type { ISODate, ISODateTime } from "@/lib/domain/types";

export const DEFAULT_TZ = "Europe/Paris";

const WEEKDAYS_FR = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MONTHS_FR = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

function partsInTz(date: Date, tz: string): ZonedParts {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const map: Record<string, number> = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== "literal") map[p.type] = Number(p.value);
  }
  return {
    year: map.year ?? 1970,
    month: map.month ?? 1,
    day: map.day ?? 1,
    hour: map.hour ?? 0,
    minute: map.minute ?? 0,
  };
}

/** Convertit une date + heure locales (fuseau de l'entreprise) en instant ISO UTC. */
export function zonedToUtc(date: ISODate, time: string, tz: string = DEFAULT_TZ): ISODateTime {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0);
  // Décalage du fuseau au moment estimé, puis correction (gère les changements d'heure).
  const p = partsInTz(new Date(guess), tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  const offset = asUtc - guess;
  return new Date(guess - offset).toISOString();
}

/** Date calendaire locale d'un instant. */
export function localDate(iso: ISODateTime, tz: string = DEFAULT_TZ): ISODate {
  const p = partsInTz(new Date(iso), tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Heure locale "HH:mm" d'un instant. */
export function localTime(iso: ISODateTime, tz: string = DEFAULT_TZ): string {
  const p = partsInTz(new Date(iso), tz);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

export function today(tz: string = DEFAULT_TZ): ISODate {
  return localDate(new Date().toISOString(), tz);
}

export function addDays(date: ISODate, days: number): ISODate {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + days));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** Jour de la semaine ISO : 1 = lundi … 7 = dimanche. */
export function isoWeekday(date: ISODate): number {
  const [y, m, d] = date.split("-").map(Number);
  const js = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay();
  return js === 0 ? 7 : js;
}

export function startOfWeek(date: ISODate): ISODate {
  return addDays(date, 1 - isoWeekday(date));
}

export function diffDays(a: ISODate, b: ISODate): number {
  const toMs = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  };
  return Math.round((toMs(a) - toMs(b)) / 86_400_000);
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function minutesToTime(total: number): string {
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

/** "vendredi 17 octobre" */
export function formatDayFr(date: ISODate, opts: { withYear?: boolean } = {}): string {
  const [y, m, d] = date.split("-").map(Number);
  const wd = WEEKDAYS_FR[new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay()];
  const base = `${wd} ${d} ${MONTHS_FR[(m ?? 1) - 1]}`;
  return opts.withYear ? `${base} ${y}` : base;
}

/** "17/10/2026" */
export function formatShortDate(date: ISODate): string {
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

/** "aujourd'hui", "demain", "hier" ou "vendredi 17 octobre". */
export function relativeDayFr(date: ISODate, tz: string = DEFAULT_TZ): string {
  const delta = diffDays(date, today(tz));
  if (delta === 0) return "aujourd'hui";
  if (delta === 1) return "demain";
  if (delta === -1) return "hier";
  if (delta === 2) return "après-demain";
  return formatDayFr(date);
}

export function formatTimeFr(time: string): string {
  return time.replace(":", "h");
}

export function weekdayNameFr(isoDay: number): string {
  return WEEKDAYS_FR[isoDay % 7] ?? "";
}

export function monthNameFr(month: number): string {
  return MONTHS_FR[month - 1] ?? "";
}

export function formatDurationFr(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${pad(m)}`;
}
