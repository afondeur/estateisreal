"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";
import Navbar from "../../components/Navbar";
import { supabase } from "../../lib/supabase";

// ═══════════════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════════════
function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString("es-DO", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
function formatDateShort(d) {
  return new Date(d).toLocaleDateString("es-DO", { month: "short", day: "numeric" });
}
function daysFromNow(d) {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

// Categorización heurística de feedback en buckets por pregunta.
// Reduce long tail y da visión rápida de tendencias.
function bucketizeFeedback(text, pregunta) {
  if (!text) return "(vacío)";
  const t = text.toLowerCase().trim();
  if (pregunta === "gusto") {
    if (/muy útil|excelente|muy buena|super|genial|increíble|completo/.test(t)) return "Muy positivo";
    if (/útil|bien|bueno|buena|práctic|me gust/.test(t)) return "Positivo";
    if (/regular|más o menos|así así/.test(t)) return "Neutral";
    if (/no me gust|malo|pésim|no sirve/.test(t)) return "Negativo";
    return "Otro";
  }
  if (pregunta === "mejoraria") {
    if (/escenario/.test(t)) return "Más escenarios";
    if (/comparar|comparación/.test(t)) return "Comparar proyectos";
    if (/gráfic|visual|dashboard/.test(t)) return "Más visualización";
    if (/sensibilidad/.test(t)) return "Más sensibilidad";
    if (/pdf|imprimir|export/.test(t)) return "Mejorar PDF/export";
    if (/móvil|mobile|celular/.test(t)) return "Versión móvil";
    if (/velocidad|lento|rápido/.test(t)) return "Performance";
    if (/nada|todo bien|ninguna/.test(t)) return "Nada / Todo bien";
    return "Otro";
  }
  if (pregunta === "pago") {
    if (/no pag|gratis|no pagaría/.test(t)) return "No pagaría";
    if (/mensual|suscripción/.test(t)) return "Prefiere mensual";
    if (/anual/.test(t)) return "Prefiere anual";
    if (/por análisis|por proyecto|pago único|por uso/.test(t)) return "Pago por uso/proyecto";
    if (/amb/.test(t)) return "Ambas opciones";
    return "Otro";
  }
  return "Otro";
}

// ═══════════════════════════════════════════════
// COMPONENTES DE VISUALIZACIÓN
// ═══════════════════════════════════════════════
function BarChart({ data, label, color = "bg-blue-500" }) {
  const max = Math.max(1, ...data.map(d => d.value));
  return (
    <div className="space-y-2">
      {label && <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</p>}
      {data.length === 0 ? (
        <p className="text-sm text-slate-500 italic">Sin datos aún</p>
      ) : (
        data.map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs text-slate-400 w-32 shrink-0 truncate">{d.label}</span>
            <div className="flex-1 bg-slate-800 rounded h-5 overflow-hidden relative">
              <div className={`${color} h-full transition-all`} style={{ width: `${(d.value / max) * 100}%` }} />
              <span className="absolute left-2 top-0 leading-5 text-xs text-white font-medium">{d.value}</span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function StatCard({ label, value, sublabel, color = "text-slate-100" }) {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sublabel && <p className="text-xs text-slate-500 mt-1">{sublabel}</p>}
    </div>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <section className="bg-slate-700 rounded-2xl border border-slate-600 p-6">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-slate-100">{title}</h2>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

// ═══════════════════════════════════════════════
// PÁGINA ADMIN
// ═══════════════════════════════════════════════
export default function AdminPage() {
  const { user, isAdmin, loading } = useAuth();
  const [dataLoading, setDataLoading] = useState(true);
  const [promoStats, setPromoStats] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [surveys, setSurveys] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [analytics, setAnalytics] = useState([]);
  const [proyectos, setProyectos] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user || !isAdmin) { setDataLoading(false); return; }
    if (!supabase) return;

    async function fetchAll() {
      setDataLoading(true);
      setError("");
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      try {
        const [promoRes, redRes, fbRes, surveyRes, profilesRes, analyticsRes, proyectosRes] = await Promise.all([
          supabase.from("promo_codes").select("*").order("created_at", { ascending: false }),
          supabase.from("promo_redemptions").select("*").order("redeemed_at", { ascending: false }),
          supabase.from("feedback").select("*").order("created_at", { ascending: false }).limit(500),
          supabase.from("pricing_survey").select("*").order("created_at", { ascending: false }).limit(500),
          supabase.from("profiles").select("id, email, tier, is_admin, pro_until, pro_source, created_at"),
          supabase.from("analytics_events").select("event_type, user_id, created_at").gte("created_at", thirtyDaysAgo).limit(5000),
          supabase.from("proyectos").select("id, user_id, created_at"),
        ]);
        if (promoRes.error) throw promoRes.error;
        if (redRes.error) throw redRes.error;
        if (fbRes.error) throw fbRes.error;
        if (surveyRes.error) throw surveyRes.error;
        if (profilesRes.error) throw profilesRes.error;
        if (analyticsRes.error) throw analyticsRes.error;
        if (proyectosRes.error) throw proyectosRes.error;
        setPromoStats(promoRes.data || []);
        setRedemptions(redRes.data || []);
        setFeedback(fbRes.data || []);
        setSurveys(surveyRes.data || []);
        setProfiles(profilesRes.data || []);
        setAnalytics(analyticsRes.data || []);
        setProyectos(proyectosRes.data || []);
      } catch (e) {
        console.error("admin fetch error:", e);
        setError(e.message || "Error cargando datos");
      } finally {
        setDataLoading(false);
      }
    }
    fetchAll();
  }, [user, isAdmin, loading]);

  // ═══════════════════════════════════════════════
  // CÁLCULOS DE MÉTRICAS
  // ═══════════════════════════════════════════════

  // —— Negocio: usuarios ——
  const userStats = useMemo(() => {
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    let total = 0, free = 0, proActivo = 0, proExpirado = 0, nuevosSemana = 0;
    profiles.forEach(p => {
      if (p.is_admin) return; // excluir admins del conteo
      total++;
      const proUntilMs = p.pro_until ? new Date(p.pro_until).getTime() : null;
      const isProActive = p.tier === "pro" && (!proUntilMs || proUntilMs > now);
      const isProExpired = p.tier === "pro" && proUntilMs && proUntilMs <= now;
      if (isProActive) proActivo++;
      else if (isProExpired) proExpirado++;
      else free++;
      if (new Date(p.created_at).getTime() > weekAgo) nuevosSemana++;
    });
    return { total, free, proActivo, proExpirado, nuevosSemana };
  }, [profiles]);

  // —— Activación: % que generó ≥1 análisis ——
  const activationRate = useMemo(() => {
    const usersWithAnalysis = new Set(
      analytics.filter(a => a.event_type === "analisis_generado").map(a => a.user_id).filter(Boolean)
    );
    if (userStats.total === 0) return 0;
    return Math.round((usersWithAnalysis.size / userStats.total) * 100);
  }, [analytics, userStats.total]);

  // —— Análisis por día últimos 30 días ——
  const analysisByDay = useMemo(() => {
    const buckets = new Map();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      buckets.set(d.toISOString().slice(0, 10), { label: formatDateShort(d), value: 0 });
    }
    analytics.filter(a => a.event_type === "analisis_generado").forEach(a => {
      const key = new Date(a.created_at).toISOString().slice(0, 10);
      if (buckets.has(key)) buckets.get(key).value++;
    });
    return Array.from(buckets.values());
  }, [analytics]);

  const totalAnalisis30d = useMemo(() =>
    analytics.filter(a => a.event_type === "analisis_generado").length
  , [analytics]);

  // —— Pro por fuente ——
  const proBySource = useMemo(() => {
    const now = Date.now();
    const active = profiles.filter(p => !p.is_admin && p.tier === "pro" &&
      (!p.pro_until || new Date(p.pro_until).getTime() > now));
    const counts = { stripe: 0, promo: 0, otro: 0 };
    active.forEach(p => {
      if (!p.pro_source) counts.otro++;
      else if (p.pro_source.startsWith("promo:")) counts.promo++;
      else if (p.pro_source === "stripe") counts.stripe++;
      else counts.otro++;
    });
    return counts;
  }, [profiles]);

  // —— Pro expirando en próximos 7/30 días ——
  const expiringSoon = useMemo(() => {
    const now = Date.now();
    const in7 = now + 7 * 24 * 60 * 60 * 1000;
    const in30 = now + 30 * 24 * 60 * 60 * 1000;
    const active = profiles.filter(p => !p.is_admin && p.tier === "pro" && p.pro_until);
    return {
      d7: active.filter(p => new Date(p.pro_until).getTime() <= in7 && new Date(p.pro_until).getTime() > now),
      d30: active.filter(p => new Date(p.pro_until).getTime() <= in30 && new Date(p.pro_until).getTime() > now),
    };
  }, [profiles]);

  // —— Alertas proactivas ——
  const alerts = useMemo(() => {
    const out = [];
    promoStats.forEach(p => {
      if (!p.active) return;
      const pct = p.max_redemptions > 0 ? (p.current_redemptions / p.max_redemptions) * 100 : 0;
      if (pct >= 80) {
        out.push({ level: "warn", message: `Código ${p.code} al ${Math.round(pct)}% de uso (${p.current_redemptions}/${p.max_redemptions})` });
      }
      const diasHastaFin = daysFromNow(p.valid_until);
      if (diasHastaFin !== null && diasHastaFin >= 0 && diasHastaFin <= 3) {
        out.push({ level: "info", message: `Código ${p.code} vence en ${diasHastaFin} día${diasHastaFin === 1 ? "" : "s"}` });
      }
    });
    if (expiringSoon.d7.length > 0) {
      out.push({ level: "warn", message: `${expiringSoon.d7.length} usuario${expiringSoon.d7.length === 1 ? "" : "s"} Pro expiran en los próximos 7 días` });
    }
    return out;
  }, [promoStats, expiringSoon]);

  // —— Canjes por día (últimos 14) ——
  const redemptionsByDay = useMemo(() => {
    const buckets = new Map();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      buckets.set(d.toISOString().slice(0, 10), { label: formatDateShort(d), value: 0 });
    }
    redemptions.forEach(r => {
      const key = new Date(r.redeemed_at).toISOString().slice(0, 10);
      if (buckets.has(key)) buckets.get(key).value++;
    });
    return Array.from(buckets.values());
  }, [redemptions]);

  // —— NPS ——
  const npsData = useMemo(() => {
    const scores = surveys.map(s => s.nps).filter(n => typeof n === "number");
    if (scores.length === 0) return null;
    const promoters = scores.filter(n => n >= 9).length;
    const passives = scores.filter(n => n >= 7 && n <= 8).length;
    const detractors = scores.filter(n => n <= 6).length;
    const total = scores.length;
    const score = Math.round(((promoters - detractors) / total) * 100);
    return { score, promoters, passives, detractors, total };
  }, [surveys]);

  // —— Feedback agrupado en buckets ——
  const feedbackBuckets = useMemo(() => {
    const groups = { gusto: new Map(), mejoraria: new Map(), pago: new Map() };
    feedback.forEach(f => {
      const inc = (map, k) => map.set(k, (map.get(k) || 0) + 1);
      if (f.pregunta_1) inc(groups.gusto, bucketizeFeedback(f.pregunta_1, "gusto"));
      if (f.pregunta_2) inc(groups.mejoraria, bucketizeFeedback(f.pregunta_2, "mejoraria"));
      if (f.pregunta_3) inc(groups.pago, bucketizeFeedback(f.pregunta_3, "pago"));
    });
    const toArr = m => Array.from(m.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
    return { gusto: toArr(groups.gusto), mejoraria: toArr(groups.mejoraria), pago: toArr(groups.pago) };
  }, [feedback]);

  // —— Encuesta precios: distribución ——
  const priceDistribution = useMemo(() => {
    const counts = new Map();
    surveys.forEach(s => {
      const key = s.precio_rango || "(sin respuesta)";
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    const order = ["0-10", "10-25", "25-50", "50-100", ">100", "(sin respuesta)"];
    return order.filter(k => counts.has(k)).map(k => ({ label: k, value: counts.get(k) }));
  }, [surveys]);

  const avgPrecio = useMemo(() => {
    const nums = surveys.map(s => Number(s.precio_mensual_usd)).filter(n => Number.isFinite(n) && n > 0);
    if (nums.length === 0) return null;
    return (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2);
  }, [surveys]);

  // —— Top 5 usuarios activos por cantidad de proyectos ——
  const topUsers = useMemo(() => {
    const counts = new Map();
    proyectos.forEach(p => { counts.set(p.user_id, (counts.get(p.user_id) || 0) + 1); });
    const emailById = new Map(profiles.map(p => [p.id, p.email]));
    return Array.from(counts.entries())
      .map(([uid, count]) => ({ email: emailById.get(uid) || uid, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [proyectos, profiles]);

  // ═══════════════════════════════════════════════
  // GUARDS
  // ═══════════════════════════════════════════════
  if (loading || dataLoading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-slate-800 flex items-center justify-center">
          <div className="animate-spin h-8 w-8 border-2 border-blue-400 border-t-transparent rounded-full" />
        </div>
      </>
    );
  }
  if (!user || !isAdmin) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-slate-800 flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <h1 className="text-xl font-bold text-slate-100 mb-2">Acceso restringido</h1>
            <p className="text-slate-400 mb-4">Esta sección es solo para administradores.</p>
            <Link href="/" className="text-blue-400 hover:text-blue-300">Volver al inicio</Link>
          </div>
        </div>
      </>
    );
  }

  // ═══════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════
  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-slate-800 py-8 px-4">
        <div className="max-w-6xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Panel Admin</h1>
            <p className="text-sm text-slate-400">Resumen del negocio, campaña TUR2026 y feedback.</p>
          </div>

          {error && (
            <div className="bg-red-900/30 border border-red-700 rounded-xl p-4">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          {/* ═══ ALERTAS PROACTIVAS ═══ */}
          {alerts.length > 0 && (
            <div className="space-y-2">
              {alerts.map((a, i) => (
                <div key={i} className={`rounded-xl p-3 border flex items-start gap-2 ${
                  a.level === "warn" ? "bg-amber-900/30 border-amber-700" : "bg-blue-900/30 border-blue-700"
                }`}>
                  <span className={`text-lg leading-none mt-0.5 ${a.level === "warn" ? "text-amber-400" : "text-blue-400"}`}>●</span>
                  <p className={`text-sm ${a.level === "warn" ? "text-amber-200" : "text-blue-200"}`}>{a.message}</p>
                </div>
              ))}
            </div>
          )}

          {/* ═══ SECCIÓN 1: SALUD DEL NEGOCIO ═══ */}
          <Section title="Salud del negocio" subtitle="Vista general de usuarios y uso">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              <StatCard
                label="Usuarios totales"
                value={userStats.total}
                sublabel={`+${userStats.nuevosSemana} esta semana`}
              />
              <StatCard
                label="Pro activos"
                value={userStats.proActivo}
                sublabel={`Stripe: ${proBySource.stripe} · Promo: ${proBySource.promo} · Otro: ${proBySource.otro}`}
                color="text-blue-300"
              />
              <StatCard
                label="Pro expirados"
                value={userStats.proExpirado}
                sublabel="Candidatos a reactivar"
                color="text-slate-400"
              />
              <StatCard
                label="Activación"
                value={`${activationRate}%`}
                sublabel="Con ≥1 análisis (30d)"
                color={activationRate >= 50 ? "text-emerald-300" : activationRate >= 25 ? "text-amber-300" : "text-red-300"}
              />
            </div>

            <div className="mb-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                Análisis generados últimos 30 días <span className="text-slate-500 normal-case">(total: {totalAnalisis30d})</span>
              </p>
              <BarChart data={analysisByDay} color="bg-emerald-500" />
            </div>

            {topUsers.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Top 5 usuarios más activos (por proyectos)</p>
                <BarChart
                  data={topUsers.map(u => ({ label: u.email, value: u.count }))}
                  color="bg-blue-500"
                />
              </div>
            )}
          </Section>

          {/* ═══ SECCIÓN 2: CAMPAÑA TUR2026 ═══ */}
          <Section title="Campaña de códigos promocionales" subtitle="Canjes, actividad y expiraciones próximas">
            <div className="overflow-x-auto mb-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase text-slate-400 border-b border-slate-600">
                    <th className="text-left py-2 pr-3">Código</th>
                    <th className="text-left py-2 pr-3">Descripción</th>
                    <th className="text-left py-2 pr-3">Progreso</th>
                    <th className="text-right py-2 pr-3">Restantes</th>
                    <th className="text-left py-2 pr-3">Ventana</th>
                    <th className="text-right py-2">Duración</th>
                  </tr>
                </thead>
                <tbody className="text-slate-200">
                  {promoStats.length === 0 ? (
                    <tr><td colSpan={6} className="py-4 text-center text-slate-500">Sin códigos creados</td></tr>
                  ) : promoStats.map(p => {
                    const pct = p.max_redemptions > 0 ? (p.current_redemptions / p.max_redemptions) * 100 : 0;
                    return (
                      <tr key={p.code} className="border-b border-slate-700/50">
                        <td className="py-2 pr-3 font-mono font-bold">{p.code}</td>
                        <td className="py-2 pr-3 text-slate-400">{p.description || "—"}</td>
                        <td className="py-2 pr-3 min-w-[150px]">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-slate-800 rounded h-2 overflow-hidden">
                              <div className={`h-full ${pct >= 80 ? "bg-amber-500" : "bg-blue-500"}`} style={{ width: `${Math.min(100, pct)}%` }} />
                            </div>
                            <span className="text-xs text-slate-400">{p.current_redemptions}/{p.max_redemptions}</span>
                          </div>
                        </td>
                        <td className="py-2 pr-3 text-right text-emerald-300">{p.max_redemptions - p.current_redemptions}</td>
                        <td className="py-2 pr-3 text-xs text-slate-400">
                          {formatDateShort(p.valid_from)} → {formatDateShort(p.valid_until)}
                        </td>
                        <td className="py-2 text-right">{p.duration_days} días</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mb-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Canjes últimos 14 días</p>
              <BarChart data={redemptionsByDay} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Expiran en próximos 7 días</p>
                <p className="text-2xl font-bold text-amber-300">{expiringSoon.d7.length}</p>
                {expiringSoon.d7.length > 0 && (
                  <div className="mt-2 max-h-24 overflow-y-auto text-xs text-slate-300 space-y-0.5">
                    {expiringSoon.d7.map(p => (
                      <div key={p.id}>{p.email} <span className="text-slate-500">· {daysFromNow(p.pro_until)}d</span></div>
                    ))}
                  </div>
                )}
              </div>
              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Expiran en próximos 30 días</p>
                <p className="text-2xl font-bold text-blue-300">{expiringSoon.d30.length}</p>
                <p className="text-xs text-slate-500 mt-1">Candidatos para oferta de conversión</p>
              </div>
            </div>

            <details>
              <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-200">
                Ver canjes recientes ({redemptions.length})
              </summary>
              <div className="mt-3 overflow-x-auto max-h-80">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-700">
                    <tr className="text-xs uppercase text-slate-400 border-b border-slate-600">
                      <th className="text-left py-2 pr-3">Fecha</th>
                      <th className="text-left py-2 pr-3">Email</th>
                      <th className="text-left py-2 pr-3">Código</th>
                      <th className="text-left py-2">Pro hasta</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-200">
                    {redemptions.slice(0, 100).map(r => (
                      <tr key={r.id} className="border-b border-slate-700/50">
                        <td className="py-1.5 pr-3 text-xs text-slate-400">{formatDate(r.redeemed_at)}</td>
                        <td className="py-1.5 pr-3">{r.email}</td>
                        <td className="py-1.5 pr-3 font-mono text-xs">{r.code}</td>
                        <td className="py-1.5 text-xs text-slate-400">{formatDateShort(r.pro_until)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </Section>

          {/* ═══ SECCIÓN 3: FEEDBACK + ENCUESTA ═══ */}
          <Section title="Feedback y encuesta de valor" subtitle={`NPS, disposición a pagar y tendencias en feedback (${feedback.length} feedback · ${surveys.length} encuestas)`}>
            {/* NPS */}
            {npsData ? (
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 mb-5">
                <div className="flex items-baseline gap-4 mb-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">NPS Score</p>
                    <p className={`text-3xl font-bold ${
                      npsData.score >= 50 ? "text-emerald-300" :
                      npsData.score >= 0 ? "text-amber-300" :
                      "text-red-300"
                    }`}>{npsData.score > 0 ? `+${npsData.score}` : npsData.score}</p>
                    <p className="text-xs text-slate-500">n = {npsData.total}</p>
                  </div>
                  <div className="flex-1 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-emerald-900/30 border border-emerald-700 rounded-lg p-2">
                      <p className="text-emerald-300 font-bold text-lg">{npsData.promoters}</p>
                      <p className="text-slate-400">Promoters (9-10)</p>
                    </div>
                    <div className="bg-amber-900/30 border border-amber-700 rounded-lg p-2">
                      <p className="text-amber-300 font-bold text-lg">{npsData.passives}</p>
                      <p className="text-slate-400">Passives (7-8)</p>
                    </div>
                    <div className="bg-red-900/30 border border-red-700 rounded-lg p-2">
                      <p className="text-red-300 font-bold text-lg">{npsData.detractors}</p>
                      <p className="text-slate-400">Detractors (0-6)</p>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  NPS = %Promoters − %Detractors. Benchmarks SaaS B2B: {'>30'} bueno, {'>50'} excelente (Bain & Co).
                </p>
              </div>
            ) : (
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 mb-5">
                <p className="text-sm text-slate-400 italic">Sin respuestas NPS todavía</p>
              </div>
            )}

            {/* Feedback agrupado por pregunta */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
              <div>
                <BarChart data={feedbackBuckets.gusto} label="Qué gustó" color="bg-emerald-500" />
              </div>
              <div>
                <BarChart data={feedbackBuckets.mejoraria} label="Qué mejorarían" color="bg-amber-500" />
              </div>
              <div>
                <BarChart data={feedbackBuckets.pago} label="Disposición a pagar" color="bg-blue-500" />
              </div>
            </div>

            {/* Encuesta de precios */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 mb-5">
              <div className="flex items-baseline justify-between mb-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Encuesta de precios</p>
                {avgPrecio && (
                  <div className="text-right">
                    <span className="text-xs text-slate-500">Promedio libre: </span>
                    <span className="text-lg font-bold text-emerald-300">US$ {avgPrecio}/mes</span>
                  </div>
                )}
              </div>
              <BarChart data={priceDistribution} label="Distribución por rango (US$/mes)" />
            </div>

            {/* Detalles expandibles */}
            <details className="mb-3">
              <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-200">
                Ver feedback completo ({feedback.length})
              </summary>
              <div className="mt-3 space-y-2 max-h-96 overflow-y-auto">
                {feedback.map(f => (
                  <div key={f.id} className="bg-slate-800 rounded-lg p-3 text-sm">
                    <div className="flex justify-between text-xs text-slate-500 mb-2">
                      <span>{f.email || "anónimo"} {f.proyecto && `· ${f.proyecto}`}</span>
                      <span>{formatDate(f.created_at)}</span>
                    </div>
                    {f.pregunta_1 && <p className="text-slate-200 mb-1"><strong className="text-slate-400">Gustó:</strong> {f.pregunta_1}</p>}
                    {f.pregunta_2 && <p className="text-slate-200 mb-1"><strong className="text-slate-400">Mejoraría:</strong> {f.pregunta_2}</p>}
                    {f.pregunta_3 && <p className="text-slate-200"><strong className="text-slate-400">Otro:</strong> {f.pregunta_3}</p>}
                  </div>
                ))}
              </div>
            </details>

            <details>
              <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-200">
                Ver respuestas encuesta ({surveys.length})
              </summary>
              <div className="mt-3 space-y-2 max-h-96 overflow-y-auto">
                {surveys.map(s => (
                  <div key={s.id} className="bg-slate-800 rounded-lg p-3 text-xs">
                    <div className="flex justify-between mb-1">
                      <span className="text-slate-300 font-medium">{s.email || "anónimo"}</span>
                      <span className="text-slate-500">{formatDate(s.created_at)}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-slate-300">
                      {typeof s.nps === "number" && (
                        <div><strong>NPS:</strong> <span className={s.nps >= 9 ? "text-emerald-300" : s.nps >= 7 ? "text-amber-300" : "text-red-300"}>{s.nps}</span></div>
                      )}
                      {s.precio_rango && <div><strong>Rango:</strong> {s.precio_rango}</div>}
                      {s.precio_mensual_usd && <div><strong>Precio libre:</strong> US${s.precio_mensual_usd}</div>}
                      {s.frecuencia && <div><strong>Frecuencia:</strong> {s.frecuencia}</div>}
                      {s.valor_principal && <div className="col-span-2"><strong>Valor:</strong> {s.valor_principal}</div>}
                    </div>
                    {s.mejoraria && <p className="mt-2 text-slate-400"><strong>Mejoraría:</strong> {s.mejoraria}</p>}
                    {s.comentario && <p className="mt-1 text-slate-400 italic">{s.comentario}</p>}
                  </div>
                ))}
              </div>
            </details>
          </Section>
        </div>
      </div>
    </>
  );
}
