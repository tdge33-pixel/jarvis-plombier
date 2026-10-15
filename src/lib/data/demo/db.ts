import "server-only";
import fs from "node:fs";
import path from "node:path";
import type {
  Business,
  BusinessMember,
  BusinessSettings,
  Profile,
  TenantTable,
  TenantTables,
} from "@/lib/domain/types";
import { buildDemoSeed } from "./seed";

export interface DemoUser {
  id: string;
  email: string;
  password_hash: string;
}

export type DemoDb = {
  users: DemoUser[];
  profiles: Profile[];
  businesses: Business[];
  business_members: BusinessMember[];
  business_settings: BusinessSettings[];
} & { [K in TenantTable]: TenantTables[K][] };

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "demo-db.json");

const globalForDb = globalThis as unknown as { __jarvisDemoDb?: DemoDb };

function emptyTables(): Pick<DemoDb, TenantTable> {
  return {
    clients: [],
    client_notes: [],
    appointments: [],
    quotes: [],
    quote_items: [],
    tasks: [],
    memories: [],
    conversations: [],
    messages: [],
    agent_actions: [],
    integrations: [],
  };
}

function load(): DemoDb {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) as Partial<DemoDb>;
      return { ...emptyTables(), users: [], profiles: [], businesses: [], business_members: [], business_settings: [], ...parsed } as DemoDb;
    }
  } catch (err) {
    console.warn("[demo-db] lecture impossible, nouvelle base créée", err);
  }
  const db: DemoDb = {
    users: [],
    profiles: [],
    businesses: [],
    business_members: [],
    business_settings: [],
    ...emptyTables(),
  };
  buildDemoSeed(db);
  persist(db);
  return db;
}

export function getDemoDb(): DemoDb {
  if (!globalForDb.__jarvisDemoDb) globalForDb.__jarvisDemoDb = load();
  return globalForDb.__jarvisDemoDb;
}

/** Sauvegarde sur disque (best effort : en environnement serverless le disque peut être en lecture seule). */
export function persist(db: DemoDb = getDemoDb()): void {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(db));
  } catch {
    // Données conservées en mémoire uniquement.
  }
}

/** Réinitialise la base démo (utilisé par le bouton « Réinitialiser la démo »). */
export function resetDemoDb(): void {
  const db: DemoDb = {
    users: [],
    profiles: [],
    businesses: [],
    business_members: [],
    business_settings: [],
    ...emptyTables(),
  };
  buildDemoSeed(db);
  globalForDb.__jarvisDemoDb = db;
  persist(db);
}
