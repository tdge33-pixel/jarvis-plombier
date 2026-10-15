import type { Query } from "./types";

/** Applique une Query sur un tableau en mémoire (utilisé par le backend démo). */
export function applyQuery<T extends object>(rows: T[], query: Query<T> = {}): T[] {
  const get = (row: T, key: string): unknown => (row as Record<string, unknown>)[key];
  let out = rows.filter((row) => {
    for (const [k, v] of Object.entries(query.eq ?? {})) {
      if (get(row, k) !== v) return false;
    }
    for (const [k, values] of Object.entries(query.in ?? {})) {
      if (!(values as unknown[]).includes(get(row, k))) return false;
    }
    for (const [k, v] of Object.entries(query.gte ?? {})) {
      const val = get(row, k);
      if (val === null || val === undefined || (val as string | number) < (v as string | number)) return false;
    }
    for (const [k, v] of Object.entries(query.lt ?? {})) {
      const val = get(row, k);
      if (val === null || val === undefined || (val as string | number) >= (v as string | number)) return false;
    }
    return true;
  });
  if (query.order) {
    const { column, ascending = true } = query.order;
    out = [...out].sort((a, b) => {
      const va = get(a, column) as string | number | null;
      const vb = get(b, column) as string | number | null;
      if (va === vb) return 0;
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      return (va < vb ? -1 : 1) * (ascending ? 1 : -1);
    });
  }
  if (query.limit !== undefined) out = out.slice(0, query.limit);
  return out;
}
