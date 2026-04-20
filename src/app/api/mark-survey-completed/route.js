import { createSupabaseServerClient, createSupabaseAdminClient } from "../../../lib/supabase-server";
import { rateLimit } from "../../../lib/rate-limit";

export async function POST(request) {
  try {
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const rl = rateLimit(ip, 10, 60_000);
    if (!rl.allowed) {
      return Response.json({ error: "Too many requests" }, { status: 429 });
    }

    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return Response.json({ error: "No autenticado" }, { status: 401 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return Response.json({ error: "Servicio no disponible" }, { status: 503 });
    }

    const admin = createSupabaseAdminClient();
    const { error } = await admin
      .from("profiles")
      .update({ survey_completed_at: new Date().toISOString() })
      .eq("id", user.id);

    if (error) {
      console.error("mark-survey-completed error:", error);
      return Response.json({ error: "Error marcando encuesta" }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error("mark-survey-completed exception:", err);
    return Response.json({ error: "Error marcando encuesta" }, { status: 500 });
  }
}
