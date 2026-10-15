"use client";

import { Brain, CalendarDays, FileText, House, LogOut, Menu, Settings, SquareCheck, Users, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { JarvisOrb } from "@/components/ui/misc";
import { cn, initials } from "@/lib/format";
import { signOutAction } from "@/app/(auth)/actions";

const NAV = [
  { href: "/", label: "Accueil", icon: House },
  { href: "/jarvis", label: "Jarvis", icon: null },
  { href: "/planning", label: "Planning", icon: CalendarDays },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/devis", label: "Devis", icon: FileText },
  { href: "/taches", label: "Tâches", icon: SquareCheck },
  { href: "/memoire", label: "Mémoire", icon: Brain },
  { href: "/parametres", label: "Paramètres", icon: Settings },
] as const;

interface ShellProps {
  firstName: string;
  lastName: string;
  businessName: string;
  demo: boolean;
  aiLabel: string;
  children: React.ReactNode;
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-1">
      {NAV.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors",
              active ? "bg-white/10 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]" : "text-slate-300 hover:bg-white/5 hover:text-white",
            )}
          >
            {Icon ? <Icon className="size-5" /> : <JarvisOrb size={20} />}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarContent({ firstName, lastName, businessName, demo, aiLabel, onNavigate }: Omit<ShellProps, "children"> & { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-[radial-gradient(120%_60%_at_0%_0%,#1a2d5a_0%,#0b1630_55%)] px-4 py-5 text-white">
      <Link href="/" onClick={onNavigate} className="mb-8 flex items-center gap-3 px-2">
        <JarvisOrb size={34} />
        <span>
          <span className="block text-lg font-semibold leading-tight tracking-tight">Jarvis</span>
          <span className="block text-xs text-slate-400">Plombier</span>
        </span>
      </Link>
      <NavLinks onNavigate={onNavigate} />
      <div className="mt-auto space-y-3">
        {demo && (
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs text-slate-300">
            <span className="font-semibold text-glow">Mode démo</span> — données locales.
            <br />
            Assistant : {aiLabel}
          </div>
        )}
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <span className="grid size-9 place-items-center rounded-full bg-white/10 text-sm font-semibold">{initials(firstName, lastName)}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">
              {firstName} {lastName}
            </span>
            <span className="block truncate text-xs text-slate-400">{businessName}</span>
          </span>
          <form action={signOutAction}>
            <button className="grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Se déconnecter" title="Se déconnecter">
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export function AppShell(props: ShellProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="min-h-dvh lg:pl-64 print:pl-0">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block print:hidden">
        <SidebarContent {...props} />
      </aside>

      {/* Mobile : barre supérieure + menu */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/10 bg-night px-4 text-white lg:hidden print:hidden">
        <Link href="/" className="flex items-center gap-2.5">
          <JarvisOrb size={26} />
          <span className="font-semibold">Jarvis</span>
        </Link>
        <button onClick={() => setOpen(true)} className="grid size-10 place-items-center rounded-lg hover:bg-white/10" aria-label="Ouvrir le menu">
          <Menu className="size-6" />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85%] animate-fade-up">
            <SidebarContent {...props} onNavigate={() => setOpen(false)} />
            <button onClick={() => setOpen(false)} className="absolute top-4 right-3 grid size-9 place-items-center rounded-lg text-slate-300 hover:bg-white/10" aria-label="Fermer le menu">
              <X className="size-5" />
            </button>
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-6xl min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{props.children}</main>

      {/* Accès rapide à Jarvis sur mobile */}
      {!pathname.startsWith("/jarvis") && (
        <Link
          href="/jarvis"
          className="fixed right-4 bottom-5 z-20 flex h-14 items-center gap-2 rounded-full bg-night pr-5 pl-2 text-white shadow-glow lg:hidden print:hidden"
          aria-label="Parler à Jarvis"
        >
          <JarvisOrb size={40} />
          <span className="font-medium">Jarvis</span>
        </Link>
      )}
    </div>
  );
}
