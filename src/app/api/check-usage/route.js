import { createSupabaseServerClient } from "../../../lib/supabase-server";
import { rateLimit } from "../../../lib/rate-limit";

const MONTHLY_LIMIT = 3;

export async function GET(request) {
  try {
    // H3: Rate limit — 20 req/min
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const rl = rateLimit(ip, 20, 60_000);
    if (!rl.allowed) {
      return Response.json({ error: "Too many requests" }, { status: 429 });
    }

    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json({ error: "No autenticado" }, { status: 401 });
    }

    // Fetch profile to check tier/admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("tier, is_admin")
      .eq("id", user.id)
      .single();

    // Pro and admin users always allowed
    if (profile?.is_admin || profile?.tier === "pro") {
      return Response.json({ count: 0, limit: MONTHLY_LIMIT, allowed: true });
    }

    // Count analyses this month for free users
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { count, error: countError } = await supabase
      .from("analytics_events")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("event_type", "analisis_generado")
      .gte("created_at", firstOfMonth);

    if (countError) {
      console.error("check-usage: Error counting events:", countError);
      // H1: Fail-closed — deny on error
      return Response.json({ count: 0, limit: MONTHLY_LIMIT, allowed: false });
    }

    const usageCount = count || 0;

    return Response.json({
      count: usageCount,
      limit: MONTHLY_LIMIT,
      allowed: usageCount < MONTHLY_LIMIT,
    });
  } catch (err) {
    console.error("check-usage error:", err);
    // H1: Fail-closed — deny on error
    return Response.json({ count: 0, limit: MONTHLY_LIMIT, allowed: false });
  }
}
