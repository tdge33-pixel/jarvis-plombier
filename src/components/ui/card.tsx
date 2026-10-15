import { cn } from "@/lib/format";

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-2xl border border-line bg-white shadow-card", className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ title, icon, action, subtitle }: { title: React.ReactNode; icon?: React.ReactNode; action?: React.ReactNode; subtitle?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
      <div className="flex items-center gap-2.5 min-w-0">
        {icon && <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">{icon}</span>}
        <div className="min-w-0">
          <h2 className="text-[13px] font-semibold uppercase tracking-wider text-muted">{title}</h2>
          {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("px-5 pb-5", className)}>{children}</div>;
}
