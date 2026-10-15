import { cn } from "@/lib/format";

type Tone = "neutral" | "blue" | "green" | "amber" | "red" | "violet";

const tones: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-700",
  blue: "bg-brand-50 text-brand-700",
  green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-800",
  red: "bg-red-50 text-red-700",
  violet: "bg-violet-50 text-violet-700",
};

export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", tones[tone], className)}>{children}</span>;
}

export const APPOINTMENT_TONES: Record<string, Tone> = {
  to_confirm: "amber",
  confirmed: "blue",
  in_progress: "violet",
  done: "green",
  cancelled: "neutral",
};

export const QUOTE_TONES: Record<string, Tone> = {
  draft: "neutral",
  sent: "blue",
  accepted: "green",
  refused: "red",
  expired: "amber",
};
