import { createSupabaseServerClient, createSupabaseAdminClient } from "../../../lib/supabase-server";
import { rateLimit } from "../../../lib/rate-limit";
import { FREE_MONTHLY_LIMIT, firstOfMonthISO, hasUnlimitedAccess } from "../../../lib/usage";
import { getUsdRate } from "../../../lib/fx";

const MONEDAS = new Set(["USD", "DOP"]);
const NUM_FIELDS = [
  "area_terreno", "precio_terreno", "precio_terreno_m2", "costo_construccion_m2", "area_construida",
  "precio_venta_m2_promedio", "ingresos_totales", "unidades_total", "meses_predev", "meses_construccion",
  "meses_postventa", "tasa_interes", "draw_factor", "preventa_pct", "cobro_pct", "soft_costs_pct",
  "comision_venta_pct", "marketing_pct", "contingencias_pct", "margen_pct", "roi_pct", "tir_pct",
];
const TEXT_FIELDS = ["ciudad", "sector", "sistema_constructivo", "tipo_proyecto"];

// Snapshot anónimo para inteligencia de mercado: se sanea y se le agrega la
// moneda y la tasa del día (dos fuentes). No bloquea ni falla el análisis.
async function insertMarketSnapshot(admin, raw) {
  if (!raw || typeof raw !== "object") return;
  const row = {};
  for (const k of NUM_FIELDS) {
    const v = Number(raw[k]);
    row[k] = Number.isFinite(v) ? v : null;
  }
  for (const k of TEXT_FIELDS) {
    row[k] = typeof raw[k] === "string" && raw[k].trim() ? raw[k].trim().slice(0, 120) : null;
  }
  row.moneda = MONEDAS.has(raw.moneda) ? raw.moneda : "USD";
  row.proyecto_uid = typeof raw.proyecto_uid === "string" ? raw.proyecto_uid.slice(0, 64) : null;
  const fx = await getUsdRate(row.moneda);
  row.tasa_usd = fx?.rate ?? null;
  row.tasa_fuente = fx?.source ?? "sin tasa";
  row.tasa_alterna = fx?.alternateRate ?? null;
  const { error } = await admin.from("market_intelligence").insert(row);
  if (error) console.error("register-analysis: snapshot de mercado no guardado:", error.message);
}

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

    const { proyecto, snapshot } = await request.json().catch(() => ({}));
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
        // Señal de prospecto caliente para el panel de administración
        await admin.from("analytics_events").insert({
          user_id: user.id,
          event_type: "limite_alcanzado",
          event_data: { count, limit: FREE_MONTHLY_LIMIT },
        });
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

    await insertMarketSnapshot(admin, snapshot);

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
