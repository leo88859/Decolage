import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
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
  try {
    const supabase = await createClient();
    if (code) ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
    else if (tokenHash && type) ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  } catch {
    ok = false;
  }
  return NextResponse.redirect(new URL(ok ? next : "/connexion?erreur=lien", origin));
}
