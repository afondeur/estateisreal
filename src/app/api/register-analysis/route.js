import { createSupabaseServerClient, createSupabaseAdminClient } from "../../../lib/supabase-server";
import { rateLimit } from "../../../lib/rate-limit";
import { FREE_MONTHLY_LIMIT, firstOfMonthISO, hasUnlimitedAccess } from "../../../lib/usage";

// Verifica el límite y registra el análisis en un solo paso, del lado del servidor.
// El cliente ya no inserta "analisis_generado": si no pasa por aquí, no hay resultados.
export async function POST(request) {
  try {
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const rl = rateLimit(ip, 30, 60_000);
    if (!rl.allowed) {
      return Response.json({ allowed: false, error: "Demasiadas solicitudes, espera un minuto" }, { status: 429 });
    }

    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return Response.json({ allowed: false, reason: "anonymous", limit: FREE_MONTHLY_LIMIT }, { status: 401 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("register-analysis: SUPABASE_SERVICE_ROLE_KEY no configurada");
      return Response.json({ allowed: false, error: "Servicio no disponible" }, { status: 503 });
    }

    const { proyecto } = await request.json().catch(() => ({}));
    const eventData = { proyecto: typeof proyecto === "string" ? proyecto.slice(0, 200) : null };

    const admin = createSupabaseAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("tier, is_admin, pro_until")
      .eq("id", user.id)
      .single();

    const unlimited = hasUnlimitedAccess(profile);
    let count = 0;

    if (!unlimited) {
      const { count: used, error: countError } = await admin
        .from("analytics_events")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("event_type", "analisis_generado")
        .gte("created_at", firstOfMonthISO());

      if (countError) {
        console.error("register-analysis: error contando:", countError);
        // Fail-closed
        return Response.json({ allowed: false, error: "No se pudo verificar tu uso" }, { status: 500 });
      }
      count = used || 0;
      if (count >= FREE_MONTHLY_LIMIT) {
        return Response.json({ allowed: false, reason: "limit", count, limit: FREE_MONTHLY_LIMIT, remaining: 0 });
      }
    }

    const { error: insertError } = await admin.from("analytics_events").insert({
      user_id: user.id,
      event_type: "analisis_generado",
      event_data: eventData,
    });
    if (insertError) {
      console.error("register-analysis: error registrando:", insertError);
      return Response.json({ allowed: false, error: "No se pudo registrar el análisis" }, { status: 500 });
    }

    return Response.json({
      allowed: true,
      unlimited,
      count: unlimited ? null : count + 1,
      limit: FREE_MONTHLY_LIMIT,
      remaining: unlimited ? null : FREE_MONTHLY_LIMIT - (count + 1),
    });
  } catch (err) {
    console.error("register-analysis error:", err);
    return Response.json({ allowed: false, error: "Error al registrar el análisis" }, { status: 500 });
  }
}
