import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/connexion", "/inscription"];

/**
 * - Rafraîchit la session Supabase (si configuré).
 * - Redirige vers /connexion lorsqu'aucune session n'est présente.
 * La vérification complète (signature, appartenance à l'entreprise) est faite côté serveur
 * dans loadContext() ; ce middleware n'est qu'un premier filtre.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const useSupabase = process.env.DATA_BACKEND !== "demo" && Boolean(url && key);

  let authenticated: boolean;
  if (useSupabase) {
    const supabase = createServerClient(url!, key!, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        },
      },
    });
    const { data } = await supabase.auth.getUser();
    authenticated = Boolean(data.user);
  } else {
    authenticated = request.cookies.has("jarvis_session");
  }

  if (!authenticated && !isPublic && !pathname.startsWith("/api")) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/connexion";
    redirect.search = "";
    return NextResponse.redirect(redirect);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
