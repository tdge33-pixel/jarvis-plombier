import { NextResponse } from "next/server";
import { requireApiContext, UnauthorizedError } from "@/lib/context";
import type { TenantTable } from "@/lib/domain/types";

const TABLES: TenantTable[] = ["clients", "client_notes", "appointments", "quotes", "quote_items", "tasks", "memories", "conversations", "messages", "agent_actions"];

/** Export RGPD : toutes les données de l'entreprise de l'utilisateur, au format JSON. */
export async function GET() {
  try {
    const ctx = await requireApiContext();
    const data: Record<string, unknown> = {
      exported_at: new Date().toISOString(),
      business: ctx.business,
      settings: ctx.settings,
      profile: ctx.profile,
    };
    for (const table of TABLES) data[table] = await ctx.store.list(table);
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="jarvis-export-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
    throw err;
  }
}
