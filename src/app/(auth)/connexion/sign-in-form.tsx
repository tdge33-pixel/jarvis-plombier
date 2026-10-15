"use client";

import { useActionState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { signInAction, type AuthFormState } from "../actions";

export function SignInForm({ demo }: { demo: { email: string; password: string } | null }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signInAction, {});
  const email = useRef<HTMLInputElement>(null);
  const password = useRef<HTMLInputElement>(null);

  return (
    <form action={action} className="mt-8 space-y-4">
      <Field label="Email">
        <Input ref={email} name="email" type="email" autoComplete="email" required placeholder="vous@exemple.fr" />
      </Field>
      <Field label="Mot de passe">
        <Input ref={password} name="password" type="password" autoComplete="current-password" required />
      </Field>
      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Connexion…" : "Se connecter"}
      </Button>
      {demo && (
        <div className="rounded-xl border border-brand-100 bg-brand-50 p-4 text-sm">
          <p className="font-medium text-brand-700">Compte de démonstration</p>
          <p className="mt-1 text-muted">
            Martin Plomberie — {demo.email} / {demo.password}
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => {
              if (email.current) email.current.value = demo.email;
              if (password.current) password.current.value = demo.password;
            }}
          >
            Remplir automatiquement
          </Button>
        </div>
      )}
    </form>
  );
}
