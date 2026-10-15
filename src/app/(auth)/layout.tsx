import { CalendarDays, FileText, MessageSquare, Sparkles } from "lucide-react";
import { JarvisOrb } from "@/components/ui/misc";

const POINTS = [
  { icon: CalendarDays, text: "Votre planning, vos clients et vos devis au même endroit." },
  { icon: MessageSquare, text: "Parlez-lui normalement : « Ajoute Mme Martin vendredi à 14h pour une fuite »." },
  { icon: FileText, text: "Il prépare devis et messages. Vous validez, il ne fait rien sans vous." },
  { icon: Sparkles, text: "Plus vous utilisez Jarvis, plus il apprend comment vous travaillez." },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-night p-12 text-white lg:flex lg:flex-col">
        <div className="absolute -top-40 -left-40 size-[520px] rounded-full bg-brand-500/20 blur-3xl" />
        <div className="absolute -right-32 -bottom-32 size-[420px] rounded-full bg-glow/10 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <JarvisOrb size={40} />
          <span className="text-xl font-semibold">Jarvis Plombier</span>
        </div>
        <div className="relative my-auto max-w-md">
          <h1 className="text-4xl leading-tight font-semibold tracking-tight">Jarvis s&apos;occupe de l&apos;administratif pendant que vous vous occupez de vos clients.</h1>
          <ul className="mt-10 space-y-5">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex gap-3 text-slate-300">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/10 text-glow">
                  <Icon className="size-5" />
                </span>
                <span className="pt-1.5">{text}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-slate-500">Vos données restent privées et ne sont jamais partagées avec d&apos;autres entreprises.</p>
      </section>
      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <JarvisOrb size={36} />
            <span className="text-lg font-semibold">Jarvis Plombier</span>
          </div>
          {children}
        </div>
      </section>
    </div>
  );
}
