import type { Client } from "@/lib/domain/types";

const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export function formatEuro(amount: number): string {
  return eur.format(amount);
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** "Mme Martin", "M. Jean Dupont" ou le nom de société. */
export function clientDisplayName(client: Pick<Client, "civility" | "first_name" | "last_name" | "company">, opts: { withFirstName?: boolean } = {}): string {
  if (client.company && !client.last_name) return client.company;
  const parts: string[] = [];
  if (client.civility) parts.push(client.civility);
  if (opts.withFirstName && client.first_name) parts.push(client.first_name);
  parts.push(client.last_name);
  return parts.join(" ");
}

export function clientAddressLine(client: Pick<Client, "address" | "postal_code" | "city">): string {
  return [client.address, [client.postal_code, client.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
}

/** Normalise une chaîne pour la recherche : minuscules, sans accents. */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function initials(first: string | null | undefined, last: string | null | undefined): string {
  return `${(first ?? "").charAt(0)}${(last ?? "").charAt(0)}`.toUpperCase() || "?";
}

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
