import { NextResponse } from "next/server";
import { z } from "zod";
import { runAgentTurn } from "@/core/agent/engine";
import { requireApiContext, UnauthorizedError } from "@/lib/context";

const bodySchema = z.object({
  conversationId: z.string().nullish(),
  text: z.string().trim().min(1).max(2000),
});

/** Envoie un message à Jarvis. Les clés d'IA restent côté serveur. */
export async function POST(request: Request) {
  try {
    const ctx = await requireApiContext();
    const body = bodySchema.safeParse(await request.json());
    if (!body.success) return NextResponse.json({ error: "Message invalide" }, { status: 400 });
    const result = await runAgentTurn(ctx, body.data);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
    console.error("[api/jarvis]", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
