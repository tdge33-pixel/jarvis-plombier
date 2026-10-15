"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { signUpAction, type AuthFormState } from "../actions";

export default function InscriptionPage() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signUpAction, {});
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Créer mon compte</h1>
      <p className="mt-1 text-muted">Ensuite, Jarvis vous posera quelques questions sur votre entreprise (5 minutes).</p>
      <form action={action} className="mt-8 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prénom">
            <Input name="firstName" autoComplete="given-name" required />
          </Field>
          <Field label="Nom">
            <Input name="lastName" autoComplete="family-name" required />
          </Field>
        </div>
        <Field label="Email">
          <Input name="email" type="email" autoComplete="email" required placeholder="vous@exemple.fr" />
        </Field>
        <Field label="Mot de passe" hint="8 caractères minimum">
          <Input name="password" type="password" autoComplete="new-password" required minLength={8} />
        </Field>
        {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
        {state.info && <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">{state.info}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Création…" : "Créer mon compte"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Déjà un compte ?{" "}
        <Link href="/connexion" className="font-medium text-brand-600 hover:underline">
          Se connecter
        </Link>
      </p>
    </div>
  );
}
