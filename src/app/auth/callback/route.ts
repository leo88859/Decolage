import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { hasAcceptedSignupDocs, type LegalReader } from "@/lib/legal-acceptance";
import { safeNext } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/server";

/** Retour du lien magique envoyé par email (formats `?code=` et `?token_hash=&type=`). */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNext(searchParams.get("next"));
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  let ok = false;
  let mustAccept = false;
  try {
    const supabase = await createClient();
    if (code) ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
    else if (tokenHash && type) ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
    // Première connexion (ou nouvelle version des conditions) : on passe par l'écran d'acceptation.
    if (ok) {
      const { data } = await supabase.auth.getUser();
      if (data.user && (await hasAcceptedSignupDocs(supabase as unknown as LegalReader, data.user.id)) === false) mustAccept = true;
    }
  } catch {
    ok = false;
  }
  if (ok && mustAccept) return NextResponse.redirect(new URL(`/connexion?accepter=1&next=${encodeURIComponent(next)}`, origin));
  return NextResponse.redirect(new URL(ok ? next : "/connexion?erreur=lien", origin));
}
