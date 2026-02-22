"use client";
import { useState } from "react";
import Navbar from "../components/Navbar";
import PrefactibilidadApp from "../components/PrefactibilidadApp";
import UsageLimitModal from "../components/UsageLimitModal";
import { useAuth } from "../context/AuthContext";

export default function Home() {
  const { user, analysisCount, incrementAnalysis, canAnalyze } = useAuth();
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [analysisStarted, setAnalysisStarted] = useState(false);

  const handleStartAnalysis = () => {
    if (!canAnalyze()) {
      setShowLimitModal(true);
      return;
    }
    if (!analysisStarted && user) {
      incrementAnalysis();
    }
    setAnalysisStarted(true);
  };

  return (
    <div className="min-h-screen bg-slate-900">
      <Navbar />

      {/* Usage bar for logged-in free users */}
      {user && user.plan === "free" && (
        <div className="bg-slate-800 border-b border-slate-700 px-4 py-2">
          <div className="max-w-5xl mx-auto flex items-center justify-between text-sm">
            <span className="text-blue-300">
              Análisis usados este mes: <strong>{analysisCount}/3</strong>
            </span>
            {analysisCount >= 3 && (
              <a href="/pricing" className="text-blue-400 font-medium hover:text-blue-300">
                Upgrade a Premium →
              </a>
            )}
          </div>
        </div>
      )}

      {/* Main content */}
      {!analysisStarted ? (
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <h1 className="text-4xl font-black text-white mb-4">
            Evalúa tu proyecto inmobiliario<br />
            <span className="text-blue-400">en minutos, no en días</span>
          </h1>
          <p className="text-lg text-slate-400 mb-8 max-w-2xl mx-auto">
            Ingresa los datos de tu proyecto y obtén un análisis completo de viabilidad financiera
            con 7 métricas profesionales, tablas de sensibilidad y escenarios de mercado.
          </p>

          <button
            onClick={handleStartAnalysis}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg px-8 py-4 rounded-2xl shadow-lg shadow-blue-900/50 transition transform hover:scale-105"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Nuevo Análisis de Prefactibilidad
          </button>

          {!user && (
            <p className="text-sm text-slate-500 mt-4">
              Prueba gratis sin registrarte. Crea una cuenta para guardar tus análisis.
            </p>
          )}

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-6 mt-16 text-left">
            {[
              { icon: "📊", title: "7 Métricas Financieras", desc: "ROI, Margen, MOIC, Markup, TIR, LTV y LTC — todo calculado al instante." },
              { icon: "📈", title: "Tablas de Sensibilidad", desc: "Ve cómo cambian los resultados si varían costos, precios o condiciones del banco." },
              { icon: "🎯", title: "Semáforo GO/NO-GO", desc: "Decisión inmediata: VIABLE, PRECAUCIÓN o NO VIABLE basada en umbrales configurables." },
            ].map((f) => (
              <div key={f.title} className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-bold text-white mb-1">{f.title}</h3>
                <p className="text-sm text-slate-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <PrefactibilidadApp />
      )}

      {/* Limit Modal */}
      {showLimitModal && (
        <UsageLimitModal
          onClose={() => setShowLimitModal(false)}
          analysisCount={analysisCount}
        />
      )}
    </div>
  );
}
