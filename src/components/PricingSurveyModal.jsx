"use client";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

const RANGOS = [
  { value: "0-10", label: "Hasta US$10/mes" },
  { value: "10-25", label: "US$10–25/mes" },
  { value: "25-50", label: "US$25–50/mes" },
  { value: "50-100", label: "US$50–100/mes" },
  { value: ">100", label: "Más de US$100/mes" },
];

const FRECUENCIAS = [
  { value: "mensual", label: "Suscripción mensual" },
  { value: "anual", label: "Suscripción anual (con descuento)" },
  { value: "por_proyecto", label: "Pago por proyecto" },
];

export default function PricingSurveyModal({ open, onClose, required = false, onCompleted }) {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [rango, setRango] = useState("");
  const [precioLibre, setPrecioLibre] = useState("");
  const [frecuencia, setFrecuencia] = useState("");
  const [valorPrincipal, setValorPrincipal] = useState("");
  const [mejoraria, setMejoraria] = useState("");
  const [comentario, setComentario] = useState("");
  const [nps, setNps] = useState(null);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!supabase) {
      setError("Servicio no disponible");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const { error: insertError } = await supabase.from("pricing_survey").insert({
        user_id: user?.id || null,
        email: user?.email || null,
        precio_rango: rango || null,
        precio_mensual_usd: precioLibre ? Number(precioLibre) : null,
        frecuencia: frecuencia || null,
        valor_principal: valorPrincipal || null,
        mejoraria: mejoraria || null,
        comentario: comentario || null,
        nps: nps,
      });
      if (insertError) throw insertError;

      // Marcar en DB como completada (server-side) — para que no reaparezca el gate
      try {
        await fetch("/api/mark-survey-completed", { method: "POST" });
        onCompleted?.();
      } catch (e) {
        console.log("mark-survey-completed fetch error:", e);
      }

      setSent(true);
      setTimeout(() => {
        onClose?.();
      }, 1800);
    } catch (err) {
      console.error("pricing_survey error:", err);
      setError("No se pudo enviar. Intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackdropClick = () => {
    if (!required) onClose?.();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={handleBackdropClick}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {sent ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">✓</div>
            <p className="text-lg font-bold text-slate-800 mb-1">¡Gracias!</p>
            <p className="text-sm text-slate-600">Tu respuesta nos ayuda a mejorar la herramienta.</p>
          </div>
        ) : (
          <>
            {required && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-xs text-blue-900">
                <strong>Ya has usado la herramienta varias veces.</strong> Como tu acceso Pro es parte de una prueba, agradecemos mucho que respondas esta encuesta corta para saber cuánto valoras la herramienta.
              </div>
            )}
            <div className="mb-4">
              <h2 className="text-lg font-bold text-slate-800">Encuesta rápida de valor</h2>
              <p className="text-sm text-slate-500 mt-1">
                {required
                  ? "2 minutos y listo. No volverá a aparecer una vez completada."
                  : "Ayúdanos a entender cuánto valoras la herramienta. Son 2 minutos."}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  ¿Qué tan probable es que recomiendes ESTATEisREAL a un colega?
                </label>
                <div className="flex flex-wrap gap-1 mb-1">
                  {Array.from({ length: 11 }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setNps(i)}
                      className={`w-9 h-9 rounded-lg text-sm font-semibold border transition ${
                        nps === i
                          ? (i >= 9 ? "bg-emerald-600 text-white border-emerald-600"
                            : i >= 7 ? "bg-amber-500 text-white border-amber-500"
                            : "bg-red-500 text-white border-red-500")
                          : "bg-white text-slate-700 border-slate-300 hover:border-slate-400"
                      }`}
                    >
                      {i}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>0 — Para nada probable</span>
                  <span>10 — Muy probable</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  ¿Cuánto pagarías al mes por acceso Pro?
                </label>
                <div className="space-y-1">
                  {RANGOS.map(r => (
                    <label key={r.value} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 rounded px-2 py-1">
                      <input
                        type="radio"
                        name="rango"
                        value={r.value}
                        checked={rango === r.value}
                        onChange={(e) => setRango(e.target.value)}
                        className="text-blue-600"
                      />
                      <span className="text-sm text-slate-700">{r.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  O indícanos un monto exacto (opcional, US$/mes)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={precioLibre}
                  onChange={(e) => setPrecioLibre(e.target.value)}
                  placeholder="35"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  ¿Qué modalidad de pago preferirías?
                </label>
                <div className="space-y-1">
                  {FRECUENCIAS.map(f => (
                    <label key={f.value} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 rounded px-2 py-1">
                      <input
                        type="radio"
                        name="frecuencia"
                        value={f.value}
                        checked={frecuencia === f.value}
                        onChange={(e) => setFrecuencia(e.target.value)}
                        className="text-blue-600"
                      />
                      <span className="text-sm text-slate-700">{f.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  ¿Qué es lo que MÁS te aporta valor? (una línea)
                </label>
                <input
                  type="text"
                  value={valorPrincipal}
                  onChange={(e) => setValorPrincipal(e.target.value)}
                  placeholder="Ej: el análisis de sensibilidad"
                  maxLength={200}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  ¿Qué mejorarías? (opcional)
                </label>
                <textarea
                  value={mejoraria}
                  onChange={(e) => setMejoraria(e.target.value)}
                  maxLength={500}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Comentario libre (opcional)
                </label>
                <textarea
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  maxLength={500}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none resize-none"
                />
              </div>

              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting || (!rango && !precioLibre && nps === null)}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-400 disabled:cursor-not-allowed rounded-lg text-sm font-medium text-white transition"
                >
                  {submitting ? "Enviando..." : "Enviar respuestas"}
                </button>
                {required ? (
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full mt-2 py-1 text-xs text-slate-400 hover:text-slate-600 transition underline underline-offset-2"
                  >
                    Saltar por ahora
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full mt-2 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm text-slate-600 transition"
                  >
                    Cerrar
                  </button>
                )}
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
