import "server-only";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import type { DataBackend } from "./types";

export type { DataBackend, TenantStore, AccountStore, AuthService } from "./types";

export function dataBackendKind(): "demo" | "supabase" {
  const explicit = process.env.DATA_BACKEND;
  if (explicit === "demo" || explicit === "supabase") return explicit;
  return isSupabaseConfigured() ? "supabase" : "demo";
}

/** Choisit le backend de données selon la configuration (.env). */
export async function getBackend(): Promise<DataBackend> {
  if (dataBackendKind() === "supabase") {
    const { supabaseBackend } = await import("./supabase/backend");
    return supabaseBackend;
  }
  const { demoBackend } = await import("./demo/backend");
  return demoBackend;
}
