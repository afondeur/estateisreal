import { createSupabaseServerClient, createSupabaseAdminClient } from "../../../lib/supabase-server";
import { rateLimit } from "../../../lib/rate-limit";

export async function POST(request) {
  try {
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const rl = rateLimit(ip, 10, 60_000);
    if (!rl.allowed) {
      return Response.json({ error: "Demasiados intentos, espera un minuto" }, { status: 429 });
    }

    const { code } = await request.json().catch(() => ({}));
    if (!code || typeof code !== "string") {
      return Response.json({ error: "Código requerido" }, { status: 400 });
    }

    const normalizedCode = code.trim().toUpperCase();
    if (normalizedCode.length > 50 || !/^[A-Z0-9_-]+$/.test(normalizedCode)) {
      return Response.json({ error: "Código con formato inválido" }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json({ error: "Debes iniciar sesión para canjear el código" }, { status: 401 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("redeem-code: SUPABASE_SERVICE_ROLE_KEY no configurada");
      return Response.json({ error: "Servicio no disponible" }, { status: 503 });
    }

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc("redeem_promo_code", {
      p_code: normalizedCode,
      p_user_id: user.id,
      p_email: user.email,
    });

    if (error) {
      console.error("redeem_promo_code RPC error:", error);
      return Response.json({ error: "Error al procesar el código" }, { status: 500 });
    }

    if (!data?.ok) {
      return Response.json({
        error: data?.message || "No se pudo canjear el código",
        code: data?.error,
      }, { status: 400 });
    }

    return Response.json({
      ok: true,
      pro_until: data.pro_until,
      duration_days: data.duration_days,
    });
  } catch (err) {
    console.error("redeem-code error:", err);
    return Response.json({ error: "Error al procesar el código" }, { status: 500 });
  }
}
