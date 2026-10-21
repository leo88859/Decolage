import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Rafraîchit la session Supabase à chaque navigation (sans effet si Supabase n'est pas configuré). */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  // Pas sur les fichiers statiques, les sites publiés ni les webhooks.
  matcher: ["/((?!_next/static|_next/image|icon.svg|favicon.ico|s/|api/stripe/webhook|api/waitlist).*)"],
};
