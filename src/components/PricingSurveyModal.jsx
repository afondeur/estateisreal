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

export default function PricingSurveyModal({ open, onClose }) {
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
      });
      if (insertError) throw insertError;
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

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {sent ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">✓</div>
            <p className="text-lg font-bold text-slate-800 mb-1">¡Gracias!</p>
            <p className="text-sm text-slate-600">Tu respuesta nos ayuda a mejorar la herramienta.</p>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <h2 className="text-lg font-bold text-slate-800">Encuesta rápida de precio</h2>
              <p className="text-sm text-slate-500 mt-1">
                Ayúdanos a entender cuánto valoras la herramienta. Son 2 minutos.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
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

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2 bg-slate-200 hover:bg-slate-300 rounded-lg text-sm font-medium text-slate-700 transition"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  disabled={submitting || (!rango && !precioLibre)}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-400 disabled:cursor-not-allowed rounded-lg text-sm font-medium text-white transition"
                >
                  {submitting ? "Enviando..." : "Enviar"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
