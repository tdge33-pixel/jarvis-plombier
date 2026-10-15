import { redirect } from "next/navigation";
import { OnboardingChat } from "@/components/onboarding/onboarding-chat";
import { getAuthUser, loadContext } from "@/lib/context";
import { getBackend } from "@/lib/data";

export const metadata = { title: "Bienvenue" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await getAuthUser();
  if (!user) redirect("/connexion");
  if (await loadContext()) redirect("/");
  const profile = await (await (await getBackend()).account()).getProfile(user.id);
  return <OnboardingChat firstName={profile?.first_name ?? ""} />;
}
