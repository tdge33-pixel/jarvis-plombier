import { Building2, Clock, Euro, History, Plug, Shield, ShieldCheck, User } from "lucide-react";
import Link from "next/link";
import { ActionHistory, BusinessForm, HoursForm, IntegrationsPanel, PermissionsForm, PrivacyPanel, ProfileForm, RatesForm } from "@/components/settings/settings-forms";
import { requireContext } from "@/lib/context";
import { dataBackendKind } from "@/lib/data";
import { formatShortDate, localDate, localTime } from "@/lib/dates";
import { cn } from "@/lib/format";
import { INTEGRATION_CATALOG, isComposioConfigured } from "@/lib/integrations";
import { listActions } from "@/lib/services/agent-actions";

export const metadata = { title: "Paramètres" };

const TABS = [
  { key: "profil", label: "Profil", icon: User },
  { key: "entreprise", label: "Entreprise", icon: Building2 },
  { key: "tarifs", label: "Tarifs", icon: Euro },
  { key: "horaires", label: "Horaires", icon: Clock },
  { key: "permissions", label: "Permissions Jarvis", icon: ShieldCheck },
  { key: "integrations", label: "Intégrations", icon: Plug },
  { key: "confidentialite", label: "Confidentialité", icon: Shield },
  { key: "historique", label: "Historique des actions", icon: History },
] as const;

export default async function ParametresPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const ctx = await requireContext();
  const { tab: rawTab } = await searchParams;
  const tab = TABS.find((t) => t.key === rawTab)?.key ?? "profil";
  const s = ctx.settings;
  const b = ctx.business;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight sm:text-3xl">Paramètres</h1>
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav className="-mx-1 flex gap-1 overflow-x-auto pb-1 lg:mx-0 lg:flex-col lg:overflow-visible">
          {TABS.map(({ key, label, icon: Icon }) => (
            <Link
              key={key}
              href={`/parametres?tab=${key}`}
              className={cn("flex h-10 shrink-0 items-center gap-2.5 rounded-xl px-3 text-sm font-medium", tab === key ? "bg-white text-ink shadow-card" : "text-muted hover:bg-white/60 hover:text-ink")}
            >
              <Icon className="size-4" /> {label}
            </Link>
          ))}
        </nav>
        <div className="min-w-0">
          {tab === "profil" && <ProfileForm initial={{ first_name: ctx.profile.first_name, last_name: ctx.profile.last_name, phone: ctx.profile.phone ?? "", email: ctx.profile.email, signature: s.signature ?? "" }} />}
          {tab === "entreprise" && (
            <BusinessForm
              initial={{
                name: b.name,
                phone: b.phone ?? "",
                email: b.email ?? "",
                address: b.address ?? "",
                postal_code: b.postal_code ?? "",
                city: b.city ?? "",
                siret: b.siret ?? "",
                zone_radius_km: b.zone_radius_km ?? "",
                works_alone: b.works_alone,
                team_size: b.team_size,
              }}
            />
          )}
          {tab === "tarifs" && <RatesForm initial={{ hourly_rate: s.hourly_rate, travel_fee: s.travel_fee, vat_rate: s.vat_rate, quote_validity_days: s.quote_validity_days }} />}
          {tab === "horaires" && (
            <HoursForm
              initial={{ work_start: s.work_start, work_end: s.work_end, working_days: s.working_days, emergencies_accepted: s.emergencies_accepted, emergency_until: s.emergency_until, max_appointments_per_day: s.max_appointments_per_day }}
            />
          )}
          {tab === "permissions" && <PermissionsForm initial={s.permissions} />}
          {tab === "integrations" && (
            <IntegrationsPanel
              composio={isComposioConfigured()}
              catalog={INTEGRATION_CATALOG.map((i) => ({ ...i }))}
              current={{ calendar: s.calendar_tool, invoicing: s.invoicing_tool }}
            />
          )}
          {tab === "confidentialite" && <PrivacyPanel demo={dataBackendKind() === "demo"} />}
          {tab === "historique" && (
            <ActionHistory
              actions={(await listActions(ctx, 100)).map((a) => ({
                id: a.id,
                action: a.action,
                summary: a.summary,
                status: a.status,
                initiated_by: a.initiated_by,
                confirmed: a.confirmed_at !== null,
                level: a.level,
                when: `${formatShortDate(localDate(a.created_at, ctx.tz))} ${localTime(a.created_at, ctx.tz)}`,
              }))}
            />
          )}
        </div>
      </div>
    </div>
  );
}
