/**
 * Couche d'accès aux données — interfaces.
 *
 * Deux implémentations :
 *  - SupabaseBackend : PostgreSQL + RLS (production)
 *  - DemoBackend     : base en mémoire persistée dans .data/ (démo sans configuration)
 *
 * La logique métier (src/lib/services) ne dépend que de ces interfaces.
 * Toute lecture/écriture d'une table métier passe par un TenantStore, qui est
 * TOUJOURS lié à une seule entreprise (business_id) : l'isolation multi-tenant
 * est donc garantie à deux niveaux (code + RLS côté Supabase).
 */
import type {
  Business,
  BusinessMember,
  BusinessSettings,
  ID,
  MemberRole,
  Profile,
  TenantTable,
  TenantTables,
} from "@/lib/domain/types";

type Scalar = string | number | boolean | null;

export interface Query<T> {
  eq?: Partial<Record<keyof T & string, Scalar>>;
  in?: Partial<Record<keyof T & string, Scalar[]>>;
  gte?: Partial<Record<keyof T & string, string | number>>;
  lt?: Partial<Record<keyof T & string, string | number>>;
  order?: { column: keyof T & string; ascending?: boolean };
  limit?: number;
}

/** Champs gérés automatiquement par le store. */
type AutoFields = "id" | "business_id" | "created_at" | "updated_at";
export type Insert<T> = Omit<T, AutoFields> & { id?: ID; created_at?: string };
export type Patch<T> = Partial<Omit<T, "id" | "business_id" | "created_at">>;

export interface TenantStore {
  readonly businessId: ID;
  list<K extends TenantTable>(table: K, query?: Query<TenantTables[K]>): Promise<TenantTables[K][]>;
  get<K extends TenantTable>(table: K, id: ID): Promise<TenantTables[K] | null>;
  insert<K extends TenantTable>(table: K, row: Insert<TenantTables[K]>): Promise<TenantTables[K]>;
  update<K extends TenantTable>(table: K, id: ID, patch: Patch<TenantTables[K]>): Promise<TenantTables[K]>;
  remove<K extends TenantTable>(table: K, id: ID): Promise<void>;
}

export interface Membership {
  business: Business;
  role: MemberRole;
}

export interface NewBusinessInput {
  name: string;
  vertical: string;
  business: Partial<Omit<Business, "id" | "name" | "vertical" | "created_at">>;
  settings: Partial<Omit<BusinessSettings, "business_id" | "updated_at">>;
}

/** Opérations transverses (compte, entreprise, membres, paramètres). */
export interface AccountStore {
  getProfile(userId: ID): Promise<Profile | null>;
  updateProfile(userId: ID, patch: Partial<Omit<Profile, "id" | "email" | "created_at">>): Promise<Profile>;
  getMembership(userId: ID): Promise<Membership | null>;
  listMembers(businessId: ID): Promise<BusinessMember[]>;
  /** Crée l'entreprise, ses paramètres par défaut et rattache l'utilisateur comme propriétaire. */
  createBusiness(userId: ID, input: NewBusinessInput): Promise<Business>;
  updateBusiness(businessId: ID, patch: Partial<Omit<Business, "id" | "created_at">>): Promise<Business>;
  getSettings(businessId: ID): Promise<BusinessSettings>;
  updateSettings(businessId: ID, patch: Partial<Omit<BusinessSettings, "business_id">>): Promise<BusinessSettings>;
}

export interface AuthUser {
  id: ID;
  email: string;
}

export interface AuthService {
  getUser(): Promise<AuthUser | null>;
  signUp(input: { email: string; password: string; firstName: string; lastName: string }): Promise<{ ok: true } | { ok: false; error: string; needsEmailConfirmation?: boolean }>;
  signIn(input: { email: string; password: string }): Promise<{ ok: true } | { ok: false; error: string }>;
  signOut(): Promise<void>;
}

export interface DataBackend {
  readonly kind: "demo" | "supabase";
  auth(): Promise<AuthService>;
  account(): Promise<AccountStore>;
  tenant(businessId: ID): Promise<TenantStore>;
}
