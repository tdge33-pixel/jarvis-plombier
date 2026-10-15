import Link from "next/link";
import { dataBackendKind } from "@/lib/data";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/data/demo/constants";
import { SignInForm } from "./sign-in-form";

export const metadata = { title: "Connexion" };

export default function ConnexionPage() {
  const demo = dataBackendKind() === "demo";
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Bonjour 👋</h1>
      <p className="mt-1 text-muted">Connectez-vous pour retrouver Jarvis.</p>
      <SignInForm demo={demo ? { email: DEMO_EMAIL, password: DEMO_PASSWORD } : null} />
      <p className="mt-6 text-center text-sm text-muted">
        Pas encore de compte ?{" "}
        <Link href="/inscription" className="font-medium text-brand-600 hover:underline">
          Créer mon compte
        </Link>
      </p>
    </div>
  );
}
