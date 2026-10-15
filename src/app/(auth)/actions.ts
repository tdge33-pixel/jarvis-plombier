"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getBackend } from "@/lib/data";

export interface AuthFormState {
  error?: string;
  info?: string;
}

const signInSchema = z.object({
  email: z.string().trim().email("Adresse email invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

export async function signInAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const auth = await (await getBackend()).auth();
  const res = await auth.signIn(parsed.data);
  if (!res.ok) return { error: res.error };
  redirect("/");
}

const signUpSchema = z.object({
  firstName: z.string().trim().min(1, "Votre prénom est requis"),
  lastName: z.string().trim().min(1, "Votre nom est requis"),
  email: z.string().trim().email("Adresse email invalide"),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
});

export async function signUpAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const auth = await (await getBackend()).auth();
  const res = await auth.signUp(parsed.data);
  if (!res.ok) return res.needsEmailConfirmation ? { info: res.error } : { error: res.error };
  redirect("/onboarding");
}

export async function signOutAction(): Promise<void> {
  const auth = await (await getBackend()).auth();
  await auth.signOut();
  redirect("/connexion");
}
