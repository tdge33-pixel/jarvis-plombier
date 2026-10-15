import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { Business, BusinessSettings, MemberRole, Profile } from "@/lib/domain/types";
import { getBackend } from "@/lib/data";
import type { AccountStore, AuthUser, TenantStore } from "@/lib/data/types";

/**
 * Contexte d'exécution d'une requête authentifiée :
 * qui est l'utilisateur, à quelle entreprise il appartient, et un store limité à cette entreprise.
 * Tous les services métier et les outils de Jarvis reçoivent ce contexte.
 */
export interface AppContext {
  user: AuthUser;
  profile: Profile;
  business: Business;
  role: MemberRole;
  settings: BusinessSettings;
  store: TenantStore;
  account: AccountStore;
  tz: string;
}

export const getAuthUser = cache(async (): Promise<AuthUser | null> => {
  const backend = await getBackend();
  return (await backend.auth()).getUser();
});

/** Charge le contexte, ou null si l'utilisateur n'est pas connecté / n'a pas d'entreprise. */
export const loadContext = cache(async (): Promise<AppContext | null> => {
  const user = await getAuthUser();
  if (!user) return null;
  const backend = await getBackend();
  const account = await backend.account();
  const [profile, membership] = await Promise.all([account.getProfile(user.id), account.getMembership(user.id)]);
  if (!profile || !membership) return null;
  const [settings, store] = await Promise.all([account.getSettings(membership.business.id), backend.tenant(membership.business.id)]);
  return {
    user,
    profile,
    business: membership.business,
    role: membership.role,
    settings,
    store,
    account,
    tz: membership.business.timezone,
  };
});

/** Pour les pages et actions protégées : redirige vers la connexion ou l'onboarding si besoin. */
export async function requireContext(): Promise<AppContext> {
  const ctx = await loadContext();
  if (ctx) return ctx;
  const user = await getAuthUser();
  redirect(user ? "/onboarding" : "/connexion");
}

/** Pour les routes API : lève une erreur au lieu de rediriger. */
export async function requireApiContext(): Promise<AppContext> {
  const ctx = await loadContext();
  if (!ctx) throw new UnauthorizedError();
  return ctx;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Non authentifié");
  }
}
