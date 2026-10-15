/**
 * Client minimal de l'API Composio (https://composio.dev).
 *
 * Composio fournit des « tools » prêts à l'emploi (Google Calendar, Gmail, Outlook,
 * Google Drive…) authentifiés via des comptes connectés (OAuth gérés par Composio).
 *
 * ⚠️ Les slugs d'outils et la forme des arguments sont à vérifier dans la
 * documentation Composio au moment du branchement réel. Ce module isole ce détail :
 * seul ce fichier et les providers voisins devront évoluer.
 */

const BASE_URL = "https://backend.composio.dev/api/v3";

export class ComposioError extends Error {}

export class ComposioClient {
  constructor(
    private readonly apiKey: string,
    /** Identifiant de l'utilisateur côté Composio (on utilise l'id de l'entreprise). */
    private readonly userId: string,
    private readonly connectedAccountId: string | null,
  ) {}

  static fromEnv(userId: string, connectedAccountId: string | null): ComposioClient | null {
    const key = process.env.COMPOSIO_API_KEY;
    return key ? new ComposioClient(key, userId, connectedAccountId) : null;
  }

  async execute<T = unknown>(toolSlug: string, args: Record<string, unknown>): Promise<T> {
    const res = await fetch(`${BASE_URL}/tools/execute/${encodeURIComponent(toolSlug)}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": this.apiKey },
      body: JSON.stringify({
        user_id: this.userId,
        ...(this.connectedAccountId ? { connected_account_id: this.connectedAccountId } : {}),
        arguments: args,
      }),
      cache: "no-store",
    });
    if (!res.ok) throw new ComposioError(`Composio ${toolSlug} : HTTP ${res.status}`);
    const json = (await res.json()) as { data?: T; successful?: boolean; error?: string | null };
    if (json.successful === false) throw new ComposioError(json.error ?? `Composio ${toolSlug} a échoué`);
    return json.data as T;
  }
}
