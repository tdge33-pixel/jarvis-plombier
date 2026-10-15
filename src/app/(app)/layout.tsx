import { AppShell } from "@/components/layout/app-shell";
import { requireContext } from "@/lib/context";
import { dataBackendKind } from "@/lib/data";
import { getAIProvider } from "@/lib/ai/provider";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireContext();
  const provider = await getAIProvider();
  return (
    <AppShell
      firstName={ctx.profile.first_name}
      lastName={ctx.profile.last_name}
      businessName={ctx.business.name}
      demo={dataBackendKind() === "demo"}
      aiLabel={provider.label}
    >
      {children}
    </AppShell>
  );
}
