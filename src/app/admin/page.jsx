"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";
import Navbar from "../../components/Navbar";
import { supabase } from "../../lib/supabase";

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

// Gráfico de barras horizontal simple con divs
function BarChart({ data, max, label }) {
  const computedMax = max || Math.max(1, ...data.map(d => d.value));
  return (
    <div className="space-y-2">
      {label && <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</p>}
      {data.length === 0 ? (
        <p className="text-sm text-slate-500 italic">Sin datos aún</p>
      ) : (
        data.map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs text-slate-400 w-24 shrink-0 truncate">{d.label}</span>
            <div className="flex-1 bg-slate-800 rounded h-5 overflow-hidden relative">
              <div
                className="bg-blue-500 h-full transition-all"
                style={{ width: `${(d.value / computedMax) * 100}%` }}
              />
              <span className="absolute left-2 top-0 leading-5 text-xs text-white font-medium">
                {d.value}
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default function AdminPage() {
  const { user, isAdmin, loading } = useAuth();
  const [dataLoading, setDataLoading] = useState(true);
  const [promoStats, setPromoStats] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [surveys, setSurveys] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user || !isAdmin) {
      setDataLoading(false);
      return;
    }
    if (!supabase) return;

    async function fetchAll() {
      setDataLoading(true);
      setError("");
      try {
        const [promoRes, redRes, fbRes, surveyRes] = await Promise.all([
          supabase.from("promo_codes").select("*").order("created_at", { ascending: false }),
          supabase.from("promo_redemptions").select("*").order("redeemed_at", { ascending: false }),
          supabase.from("feedback").select("*").order("created_at", { ascending: false }).limit(200),
          supabase.from("pricing_survey").select("*").order("created_at", { ascending: false }).limit(200),
        ]);
        if (promoRes.error) throw promoRes.error;
        if (redRes.error) throw redRes.error;
        if (fbRes.error) throw fbRes.error;
        if (surveyRes.error) throw surveyRes.error;
        setPromoStats(promoRes.data || []);
        setRedemptions(redRes.data || []);
        setFeedback(fbRes.data || []);
        setSurveys(surveyRes.data || []);
      } catch (e) {
        console.error("admin fetch error:", e);
        setError(e.message || "Error cargando datos");
      } finally {
        setDataLoading(false);
      }
    }
    fetchAll();
  }, [user, isAdmin, loading]);

  // Canjes por día (últimos 14 días) para gráfico
  const redemptionsByDay = useMemo(() => {
    const buckets = new Map();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      buckets.set(key, { label: formatDateShort(d), value: 0 });
    }
    redemptions.forEach(r => {
      const key = new Date(r.redeemed_at).toISOString().slice(0, 10);
      if (buckets.has(key)) buckets.get(key).value++;
    });
    return Array.from(buckets.values());
  }, [redemptions]);

  // Distribución de precio en encuesta
  const priceDistribution = useMemo(() => {
    const counts = new Map();
    surveys.forEach(s => {
      const key = s.precio_rango || "(sin respuesta)";
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    const order = ["0-10", "10-25", "25-50", "50-100", ">100", "(sin respuesta)"];
    return order
      .filter(k => counts.has(k))
      .map(k => ({ label: k, value: counts.get(k) }));
  }, [surveys]);

  const avgPrecio = useMemo(() => {
    const nums = surveys.map(s => Number(s.precio_mensual_usd)).filter(n => Number.isFinite(n) && n > 0);
    if (nums.length === 0) return null;
    return (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2);
  }, [surveys]);

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

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-slate-800 py-8 px-4">
        <div className="max-w-6xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Panel Admin</h1>
            <p className="text-sm text-slate-400">Códigos promocionales, feedback y encuestas.</p>
          </div>

          {error && (
            <div className="bg-red-900/30 border border-red-700 rounded-xl p-4">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          {/* ─── CÓDIGOS PROMOCIONALES ─── */}
          <section className="bg-slate-700 rounded-2xl border border-slate-600 p-6">
            <h2 className="text-lg font-bold text-slate-100 mb-4">Códigos promocionales</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase text-slate-400 border-b border-slate-600">
                    <th className="text-left py-2 pr-3">Código</th>
                    <th className="text-left py-2 pr-3">Descripción</th>
                    <th className="text-right py-2 pr-3">Canjes</th>
                    <th className="text-right py-2 pr-3">Restantes</th>
                    <th className="text-left py-2 pr-3">Ventana</th>
                    <th className="text-right py-2">Duración</th>
                  </tr>
                </thead>
                <tbody className="text-slate-200">
                  {promoStats.length === 0 ? (
                    <tr><td colSpan={6} className="py-4 text-center text-slate-500">Sin códigos creados</td></tr>
                  ) : promoStats.map(p => (
                    <tr key={p.code} className="border-b border-slate-700/50">
                      <td className="py-2 pr-3 font-mono font-bold">{p.code}</td>
                      <td className="py-2 pr-3 text-slate-400">{p.description || "—"}</td>
                      <td className="py-2 pr-3 text-right">{p.current_redemptions} / {p.max_redemptions}</td>
                      <td className="py-2 pr-3 text-right text-emerald-300">{p.max_redemptions - p.current_redemptions}</td>
                      <td className="py-2 pr-3 text-xs text-slate-400">
                        {formatDateShort(p.valid_from)} → {formatDateShort(p.valid_until)}
                      </td>
                      <td className="py-2 text-right">{p.duration_days} días</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ─── GRÁFICO DE CANJES ─── */}
          <section className="bg-slate-700 rounded-2xl border border-slate-600 p-6">
            <h2 className="text-lg font-bold text-slate-100 mb-4">Canjes últimos 14 días</h2>
            <BarChart data={redemptionsByDay} />
          </section>

          {/* ─── CANJES RECIENTES ─── */}
          <section className="bg-slate-700 rounded-2xl border border-slate-600 p-6">
            <h2 className="text-lg font-bold text-slate-100 mb-4">
              Canjes recientes <span className="text-sm font-normal text-slate-400">({redemptions.length})</span>
            </h2>
            <div className="overflow-x-auto max-h-80">
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
                  {redemptions.length === 0 ? (
                    <tr><td colSpan={4} className="py-4 text-center text-slate-500">Sin canjes todavía</td></tr>
                  ) : redemptions.slice(0, 50).map(r => (
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
          </section>

          {/* ─── ENCUESTA DE PRECIOS ─── */}
          <section className="bg-slate-700 rounded-2xl border border-slate-600 p-6">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-100">
                Encuesta de precios <span className="text-sm font-normal text-slate-400">({surveys.length} respuestas)</span>
              </h2>
              {avgPrecio && (
                <div className="text-right">
                  <p className="text-xs text-slate-400 uppercase">Promedio libre</p>
                  <p className="text-lg font-bold text-emerald-300">US$ {avgPrecio}/mes</p>
                </div>
              )}
            </div>
            <BarChart data={priceDistribution} label="Distribución por rango (US$/mes)" />
            {surveys.length > 0 && (
              <details className="mt-4">
                <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-200">
                  Ver respuestas ({surveys.length})
                </summary>
                <div className="mt-3 space-y-2 max-h-96 overflow-y-auto">
                  {surveys.map(s => (
                    <div key={s.id} className="bg-slate-800 rounded-lg p-3 text-xs">
                      <div className="flex justify-between mb-1">
                        <span className="text-slate-300 font-medium">{s.email || "anónimo"}</span>
                        <span className="text-slate-500">{formatDate(s.created_at)}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-slate-300">
                        {s.precio_rango && <div><strong>Rango:</strong> {s.precio_rango}</div>}
                        {s.precio_mensual_usd && <div><strong>Precio libre:</strong> US${s.precio_mensual_usd}</div>}
                        {s.frecuencia && <div><strong>Frecuencia:</strong> {s.frecuencia}</div>}
                        {s.valor_principal && <div><strong>Valor:</strong> {s.valor_principal}</div>}
                      </div>
                      {s.mejoraria && <p className="mt-2 text-slate-400"><strong>Mejoraría:</strong> {s.mejoraria}</p>}
                      {s.comentario && <p className="mt-1 text-slate-400 italic">{s.comentario}</p>}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </section>

          {/* ─── FEEDBACK ─── */}
          <section className="bg-slate-700 rounded-2xl border border-slate-600 p-6">
            <h2 className="text-lg font-bold text-slate-100 mb-4">
              Feedback <span className="text-sm font-normal text-slate-400">({feedback.length} respuestas)</span>
            </h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {feedback.length === 0 ? (
                <p className="text-sm text-slate-500 italic">Sin feedback todavía</p>
              ) : feedback.map(f => (
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
          </section>
        </div>
      </div>
    </>
  );
}
