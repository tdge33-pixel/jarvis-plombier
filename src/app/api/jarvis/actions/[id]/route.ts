import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveAction } from "@/core/agent/engine";
import { requireApiContext, UnauthorizedError } from "@/lib/context";

const bodySchema = z.object({
  decision: z.enum(["confirm", "cancel"]),
  args: z.record(z.string(), z.unknown()).optional(),
});

/** Confirmer / modifier / annuler une action proposée par Jarvis. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireApiContext();
    const { id } = await params;
    const body = bodySchema.safeParse(await request.json());
    if (!body.success) return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
    const result = await resolveAction(ctx, id, body.data.decision, body.data.args);
    for (const path of ["/", "/planning", "/taches", "/devis", "/clients", "/parametres"]) revalidatePath(path);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
    console.error("[api/jarvis/actions]", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
