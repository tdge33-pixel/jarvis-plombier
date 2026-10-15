import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Business, BusinessSettings, ID, Profile, TenantTable, TenantTables } from "@/lib/domain/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AccountStore, AuthService, DataBackend, Insert, Membership, Patch, Query, TenantStore } from "../types";

function fail(context: string, error: { message: string } | null): never {
  throw new Error(`[supabase] ${context} : ${error?.message ?? "erreur inconnue"}`);
}

class SupabaseAuth implements AuthService {
  constructor(private readonly sb: SupabaseClient) {}

  async getUser() {
    const { data } = await this.sb.auth.getUser();
    return data.user ? { id: data.user.id, email: data.user.email ?? "" } : null;
  }

  async signUp(input: { email: string; password: string; firstName: string; lastName: string }) {
    const { data, error } = await this.sb.auth.signUp({
      email: input.email,
      password: input.password,
      // Lu par le trigger handle_new_user() pour créer le profil.
      options: { data: { first_name: input.firstName, last_name: input.lastName } },
    });
    if (error) return { ok: false as const, error: error.message };
    if (!data.session) {
      return { ok: false as const, error: "Compte créé. Confirmez votre adresse email puis connectez-vous.", needsEmailConfirmation: true };
    }
    return { ok: true as const };
  }

  async signIn(input: { email: string; password: string }) {
    const { error } = await this.sb.auth.signInWithPassword(input);
    return error ? { ok: false as const, error: "Email ou mot de passe incorrect." } : { ok: true as const };
  }

  async signOut() {
    await this.sb.auth.signOut();
  }
}

class SupabaseAccount implements AccountStore {
  constructor(private readonly sb: SupabaseClient) {}

  async getProfile(userId: ID) {
    const { data, error } = await this.sb.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (error) fail("getProfile", error);
    return (data as Profile | null) ?? null;
  }

  async updateProfile(userId: ID, patch: Parameters<AccountStore["updateProfile"]>[1]) {
    const { data, error } = await this.sb.from("profiles").update(patch).eq("id", userId).select("*").single();
    if (error) fail("updateProfile", error);
    return data as Profile;
  }

  async getMembership(userId: ID): Promise<Membership | null> {
    const { data, error } = await this.sb
      .from("business_members")
      .select("role, business:businesses(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) fail("getMembership", error);
    if (!data) return null;
    const row = data as unknown as { role: Membership["role"]; business: Business | null };
    return row.business ? { business: row.business, role: row.role } : null;
  }

  async listMembers(businessId: ID) {
    const { data, error } = await this.sb.from("business_members").select("*").eq("business_id", businessId);
    if (error) fail("listMembers", error);
    return data ?? [];
  }

  async createBusiness(_userId: ID, input: Parameters<AccountStore["createBusiness"]>[1]) {
    // Fonction SECURITY DEFINER : crée l'entreprise, le membre propriétaire et les paramètres
    // de façon atomique pour auth.uid() (voir supabase/migrations/0002_rls.sql).
    const { data, error } = await this.sb.rpc("create_business", {
      p_name: input.name,
      p_vertical: input.vertical,
      p_business: input.business,
      p_settings: input.settings,
    });
    if (error) fail("createBusiness", error);
    return data as Business;
  }

  async updateBusiness(businessId: ID, patch: Parameters<AccountStore["updateBusiness"]>[1]) {
    const { data, error } = await this.sb.from("businesses").update(patch).eq("id", businessId).select("*").single();
    if (error) fail("updateBusiness", error);
    return data as Business;
  }

  async getSettings(businessId: ID) {
    const { data, error } = await this.sb.from("business_settings").select("*").eq("business_id", businessId).single();
    if (error) fail("getSettings", error);
    return data as BusinessSettings;
  }

  async updateSettings(businessId: ID, patch: Parameters<AccountStore["updateSettings"]>[1]) {
    const { data, error } = await this.sb.from("business_settings").update(patch).eq("business_id", businessId).select("*").single();
    if (error) fail("updateSettings", error);
    return data as BusinessSettings;
  }
}

/**
 * Store lié à une entreprise. Double protection :
 *  1. chaque requête est filtrée par business_id ;
 *  2. les RLS policies refusent toute ligne d'une entreprise dont l'utilisateur n'est pas membre.
 */
class SupabaseTenantStore implements TenantStore {
  constructor(
    private readonly sb: SupabaseClient,
    readonly businessId: ID,
  ) {}

  async list<K extends TenantTable>(table: K, query: Query<TenantTables[K]> = {}) {
    let q = this.sb.from(table).select("*").eq("business_id", this.businessId);
    for (const [k, v] of Object.entries(query.eq ?? {})) q = v === null ? q.is(k, null) : q.eq(k, v as string | number | boolean);
    for (const [k, v] of Object.entries(query.in ?? {})) q = q.in(k, v as unknown[]);
    for (const [k, v] of Object.entries(query.gte ?? {})) q = q.gte(k, v as string | number);
    for (const [k, v] of Object.entries(query.lt ?? {})) q = q.lt(k, v as string | number);
    if (query.order) q = q.order(query.order.column, { ascending: query.order.ascending ?? true, nullsFirst: false });
    if (query.limit !== undefined) q = q.limit(query.limit);
    const { data, error } = await q;
    if (error) fail(`list ${table}`, error);
    return (data ?? []) as TenantTables[K][];
  }

  async get<K extends TenantTable>(table: K, id: ID) {
    const { data, error } = await this.sb.from(table).select("*").eq("business_id", this.businessId).eq("id", id).maybeSingle();
    if (error) fail(`get ${table}`, error);
    return (data as TenantTables[K] | null) ?? null;
  }

  async insert<K extends TenantTable>(table: K, row: Insert<TenantTables[K]>) {
    const { data, error } = await this.sb
      .from(table)
      .insert({ ...row, business_id: this.businessId })
      .select("*")
      .single();
    if (error) fail(`insert ${table}`, error);
    return data as TenantTables[K];
  }

  async update<K extends TenantTable>(table: K, id: ID, patch: Patch<TenantTables[K]>) {
    const { data, error } = await this.sb.from(table).update(patch as Record<string, unknown>).eq("business_id", this.businessId).eq("id", id).select("*").single();
    if (error) fail(`update ${table}`, error);
    return data as TenantTables[K];
  }

  async remove<K extends TenantTable>(table: K, id: ID) {
    const { error } = await this.sb.from(table).delete().eq("business_id", this.businessId).eq("id", id);
    if (error) fail(`delete ${table}`, error);
  }
}

export const supabaseBackend: DataBackend = {
  kind: "supabase",
  auth: async () => new SupabaseAuth(await createSupabaseServerClient()),
  account: async () => new SupabaseAccount(await createSupabaseServerClient()),
  tenant: async (businessId: ID) => new SupabaseTenantStore(await createSupabaseServerClient(), businessId),
};
