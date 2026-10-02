import { createSupabaseServerClient } from "../../../lib/supabase-server";
import { NextResponse } from "next/server";
import { safeRedirect } from "../../../lib/safe-redirect";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeRedirect(searchParams.get("next"));

  if (code) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL(next, request.url));
}
