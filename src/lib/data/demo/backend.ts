import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import type { BusinessSettings, ID, TenantTable, TenantTables } from "@/lib/domain/types";
import { DEFAULT_PERMISSIONS } from "@/lib/domain/types";
import { DEFAULT_TZ } from "@/lib/dates";
import { applyQuery } from "../query";
import type { AccountStore, AuthService, DataBackend, Insert, Patch, Query, TenantStore } from "../types";
import { getDemoDb, persist } from "./db";
import { hashPassword, verifyPassword } from "./password";

const SESSION_COOKIE = "jarvis_session";

function secret(): string {
  return process.env.SESSION_SECRET || "jarvis-demo-secret-a-changer-en-production";
}

function sign(value: string): string {
  return crypto.createHmac("sha256", secret()).update(value).digest("base64url");
}

function now(): string {
  return new Date().toISOString();
}

export function defaultSettings(businessId: ID): BusinessSettings {
  return {
    business_id: businessId,
    hourly_rate: 60,
    travel_fee: 30,
    vat_rate: 10,
    quote_validity_days: 30,
    work_start: "08:00",
    work_end: "18:00",
    working_days: [1, 2, 3, 4, 5],
    emergencies_accepted: false,
    emergency_until: null,
    max_appointments_per_day: 5,
    services: [],
    refused_services: [],
    suppliers: [],
    calendar_tool: null,
    invoicing_tool: null,
    signature: null,
    permissions: { ...DEFAULT_PERMISSIONS },
    updated_at: now(),
  };
}

class DemoAuth implements AuthService {
  async getUser() {
    const store = await cookies();
    const raw = store.get(SESSION_COOKIE)?.value;
    if (!raw) return null;
    const [userId, sig] = raw.split(".");
    if (!userId || !sig || sign(userId) !== sig) return null;
    const user = getDemoDb().users.find((u) => u.id === userId);
    return user ? { id: user.id, email: user.email } : null;
  }

  private async setSession(userId: string) {
    const store = await cookies();
    store.set(SESSION_COOKIE, `${userId}.${sign(userId)}`, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  async signUp(input: { email: string; password: string; firstName: string; lastName: string }) {
    const db = getDemoDb();
    const email = input.email.trim().toLowerCase();
    if (db.users.some((u) => u.email === email)) return { ok: false as const, error: "Un compte existe déjà avec cet email." };
    const id = crypto.randomUUID();
    db.users.push({ id, email, password_hash: hashPassword(input.password) });
    db.profiles.push({ id, email, first_name: input.firstName, last_name: input.lastName, phone: null, created_at: now() });
    persist(db);
    await this.setSession(id);
    return { ok: true as const };
  }

  async signIn(input: { email: string; password: string }) {
    const db = getDemoDb();
    const user = db.users.find((u) => u.email === input.email.trim().toLowerCase());
    if (!user || !verifyPassword(input.password, user.password_hash)) {
      return { ok: false as const, error: "Email ou mot de passe incorrect." };
    }
    await this.setSession(user.id);
    return { ok: true as const };
  }

  async signOut() {
    const store = await cookies();
    store.delete(SESSION_COOKIE);
  }
}

class DemoAccount implements AccountStore {
  async getProfile(userId: ID) {
    return getDemoDb().profiles.find((p) => p.id === userId) ?? null;
  }

  async updateProfile(userId: ID, patch: Parameters<AccountStore["updateProfile"]>[1]) {
    const db = getDemoDb();
    const profile = db.profiles.find((p) => p.id === userId);
    if (!profile) throw new Error("Profil introuvable");
    Object.assign(profile, patch);
    persist(db);
    return profile;
  }

  async getMembership(userId: ID) {
    const db = getDemoDb();
    const member = db.business_members.find((m) => m.user_id === userId);
    if (!member) return null;
    const business = db.businesses.find((b) => b.id === member.business_id);
    return business ? { business, role: member.role } : null;
  }

  async listMembers(businessId: ID) {
    return getDemoDb().business_members.filter((m) => m.business_id === businessId);
  }

  async createBusiness(userId: ID, input: Parameters<AccountStore["createBusiness"]>[1]) {
    const db = getDemoDb();
    const id = crypto.randomUUID();
    const business = {
      phone: null,
      email: null,
      address: null,
      postal_code: null,
      city: null,
      siret: null,
      works_alone: true,
      team_size: 1,
      zone_radius_km: null,
      timezone: DEFAULT_TZ,
      is_demo: false,
      onboarded_at: null,
      ...input.business,
      id,
      name: input.name,
      vertical: input.vertical,
      created_at: now(),
    };
    db.businesses.push(business);
    db.business_members.push({ id: crypto.randomUUID(), business_id: id, user_id: userId, role: "owner", created_at: now() });
    db.business_settings.push({ ...defaultSettings(id), ...input.settings, business_id: id });
    persist(db);
    return business;
  }

  async updateBusiness(businessId: ID, patch: Parameters<AccountStore["updateBusiness"]>[1]) {
    const db = getDemoDb();
    const business = db.businesses.find((b) => b.id === businessId);
    if (!business) throw new Error("Entreprise introuvable");
    Object.assign(business, patch);
    persist(db);
    return business;
  }

  async getSettings(businessId: ID) {
    const db = getDemoDb();
    let settings = db.business_settings.find((s) => s.business_id === businessId);
    if (!settings) {
      settings = defaultSettings(businessId);
      db.business_settings.push(settings);
      persist(db);
    }
    return settings;
  }

  async updateSettings(businessId: ID, patch: Parameters<AccountStore["updateSettings"]>[1]) {
    const db = getDemoDb();
    const settings = await this.getSettings(businessId);
    Object.assign(settings, patch, { updated_at: now() });
    persist(db);
    return settings;
  }
}

/** Store lié à une entreprise : chaque opération est filtrée par business_id. */
class DemoTenantStore implements TenantStore {
  constructor(readonly businessId: ID) {}

  private rows<K extends TenantTable>(table: K): TenantTables[K][] {
    return getDemoDb()[table] as TenantTables[K][];
  }

  async list<K extends TenantTable>(table: K, query: Query<TenantTables[K]> = {}) {
    const own = this.rows(table).filter((r) => r.business_id === this.businessId);
    return applyQuery(own, query).map((r) => structuredClone(r));
  }

  async get<K extends TenantTable>(table: K, id: ID) {
    const row = this.rows(table).find((r) => r.id === id && r.business_id === this.businessId);
    return row ? structuredClone(row) : null;
  }

  async insert<K extends TenantTable>(table: K, row: Insert<TenantTables[K]>) {
    const ts = now();
    const full = {
      ...row,
      id: row.id ?? crypto.randomUUID(),
      business_id: this.businessId,
      created_at: row.created_at ?? ts,
      updated_at: ts,
    } as unknown as TenantTables[K];
    this.rows(table).push(full);
    persist();
    return structuredClone(full);
  }

  async update<K extends TenantTable>(table: K, id: ID, patch: Patch<TenantTables[K]>) {
    const row = this.rows(table).find((r) => r.id === id && r.business_id === this.businessId);
    if (!row) throw new Error("Élément introuvable");
    Object.assign(row, patch, { updated_at: now() });
    persist();
    return structuredClone(row);
  }

  async remove<K extends TenantTable>(table: K, id: ID) {
    const rows = this.rows(table);
    const idx = rows.findIndex((r) => r.id === id && r.business_id === this.businessId);
    if (idx >= 0) rows.splice(idx, 1);
    persist();
  }
}

export const demoBackend: DataBackend = {
  kind: "demo",
  auth: async () => new DemoAuth(),
  account: async () => new DemoAccount(),
  tenant: async (businessId: ID) => new DemoTenantStore(businessId),
};
