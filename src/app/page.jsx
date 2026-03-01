"use client";
import { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import PrefactibilidadApp from "../components/PrefactibilidadApp";
import { useAuth } from "../context/AuthContext";

const EJEMPLO_PAGES = [
  { src: "/ejemplo/metricas.jpg", label: "Métricas y Resultados" },
  { src: "/ejemplo/sensibilidad.jpg", label: "Tablas de Sensibilidad" },
  { src: "/ejemplo/escenarios.jpg", label: "Escenarios de Mercado" },
];

export default function Home() {
  const { user, tier } = useAuth();
  const [analysisStarted, setAnalysisStarted] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewPage, setPreviewPage] = useState(0);

  const [openProjects, setOpenProjects] = useState(false);

  const handleStartAnalysis = () => {
    setOpenProjects(false);
    setAnalysisStarted(true);
  };

  const handleOpenProjects = () => {
    setOpenProjects(true);
    setAnalysisStarted(true);
  };

  // Disable body scroll when modal is open
  useEffect(() => {
    if (showPreview) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [showPreview]);

  return (
    <div className="min-h-screen bg-slate-800">
      <Navbar />

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

          <div className="flex flex-col sm:flex-row items-center gap-4 justify-center">
            <button
              onClick={handleStartAnalysis}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg px-8 py-4 rounded-2xl shadow-lg shadow-blue-900/50 transition transform hover:scale-105"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Nuevo Análisis
            </button>
            {user && (
              <button
                onClick={handleOpenProjects}
                className="inline-flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white font-bold text-lg px-8 py-4 rounded-2xl shadow-lg shadow-slate-900/50 transition transform hover:scale-105 border border-slate-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                Mis Proyectos
              </button>
            )}
          </div>

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
              { icon: "🎯", title: "Semáforo VIABLE · PRECAUCIÓN · NO VIABLE", desc: "Decisión inmediata basada en umbrales configurables de margen, ROI, TIR y MOIC." },
            ].map((f) => (
              <div key={f.title} className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-bold text-white mb-1">{f.title}</h3>
                <p className="text-sm text-slate-400">{f.desc}</p>
              </div>
            ))}
          </div>

          {/* ═══ EJEMPLO DE REPORTE ═══ */}
          <div className="mt-20 mb-8">
            <h2 className="text-2xl font-bold text-white mb-2">Ejemplo de Reporte</h2>
            <p className="text-slate-400 mb-8 max-w-xl mx-auto">
              Así luce un análisis completo generado por ESTATEisREAL. Métricas, tablas de costos, sensibilidad y más — todo en un reporte profesional.
            </p>

            {/* Preview cards - clickable thumbnails */}
            <div className="grid grid-cols-3 gap-5 max-w-3xl mx-auto">
              {EJEMPLO_PAGES.map((page, i) => (
                <button
                  key={i}
                  onClick={() => { setPreviewPage(i); setShowPreview(true); }}
                  className="group relative rounded-xl overflow-hidden border border-slate-600 hover:border-blue-400 transition shadow-lg hover:shadow-blue-900/30 bg-white aspect-[3/4]"
                >
                  <img
                    src={page.src}
                    alt={page.label}
                    className="w-full h-full object-cover object-top"
                    draggable={false}
                    onContextMenu={e => e.preventDefault()}
                  />
                  {/* Gradient overlay on bottom half */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent" />
                  <div className="absolute bottom-2 left-0 right-0 text-center">
                    <span className="text-xs font-semibold text-white/90 bg-slate-900/60 px-2 py-0.5 rounded">
                      {page.label}
                    </span>
                  </div>
                  {/* Hover effect */}
                  <div className="absolute inset-0 bg-blue-500/0 group-hover:bg-blue-500/10 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <span className="bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow">Ver ejemplo</span>
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={() => { setPreviewPage(0); setShowPreview(true); }}
              className="mt-6 inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 font-semibold transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Ver reporte completo de ejemplo
            </button>
          </div>
        </div>
      ) : (
        <PrefactibilidadApp initialShowProjects={openProjects} />
      )}

      {/* ═══ MODAL VISOR DIFUMINADO ═══ */}
      {showPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
          onClick={() => setShowPreview(false)}
        >
          {/* Close button */}
          <button
            onClick={() => setShowPreview(false)}
            className="absolute top-4 right-4 z-50 bg-slate-800/80 hover:bg-slate-700 text-white rounded-full w-10 h-10 flex items-center justify-center transition text-xl font-bold"
          >
            ✕
          </button>

          {/* Page indicator */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-800/80 text-white text-sm font-medium px-4 py-1.5 rounded-full">
            Página {previewPage + 1} de {EJEMPLO_PAGES.length}
          </div>

          {/* Prev arrow */}
          {previewPage > 0 && (
            <button
              onClick={e => { e.stopPropagation(); setPreviewPage(p => p - 1); }}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-50 bg-slate-800/70 hover:bg-slate-700 text-white rounded-full w-10 h-10 flex items-center justify-center transition text-lg"
            >
              ‹
            </button>
          )}

          {/* Next arrow */}
          {previewPage < EJEMPLO_PAGES.length - 1 && (
            <button
              onClick={e => { e.stopPropagation(); setPreviewPage(p => p + 1); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-50 bg-slate-800/70 hover:bg-slate-700 text-white rounded-full w-10 h-10 flex items-center justify-center transition text-lg"
            >
              ›
            </button>
          )}

          {/* Image container - blurred bottom half with CTA */}
          <div
            className="relative max-h-[88vh] max-w-[620px] w-full mx-4 select-none"
            onClick={e => e.stopPropagation()}
            onContextMenu={e => e.preventDefault()}
          >
            <img
              src={EJEMPLO_PAGES[previewPage].src}
              alt={EJEMPLO_PAGES[previewPage].label}
              className="w-full rounded-lg shadow-2xl pointer-events-none"
              draggable={false}
              style={{ userSelect: "none", WebkitUserSelect: "none" }}
            />

            {/* Blur overlay on bottom 40% */}
            <div
              className="absolute bottom-0 left-0 right-0 rounded-b-lg flex flex-col items-center justify-end pb-8"
              style={{
                height: "45%",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
                background: "linear-gradient(to bottom, rgba(15,23,42,0) 0%, rgba(15,23,42,0.6) 40%, rgba(15,23,42,0.9) 100%)",
              }}
            >
              <div className="text-center px-6">
                <p className="text-white font-bold text-lg mb-1">Obtén reportes completos como este</p>
                <p className="text-slate-300 text-sm mb-4">Métricas, sensibilidad, escenarios y más — con el plan Pro</p>
                <a
                  href="/pricing"
                  className="inline-block bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-2.5 rounded-xl transition text-sm shadow-lg"
                >
                  Cambiar a Pro — $25/mes
                </a>
              </div>
            </div>
          </div>

          {/* Page dots */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex gap-2">
            {EJEMPLO_PAGES.map((_, i) => (
              <button
                key={i}
                onClick={e => { e.stopPropagation(); setPreviewPage(i); }}
                className={`w-2.5 h-2.5 rounded-full transition ${i === previewPage ? "bg-blue-400 scale-110" : "bg-slate-500 hover:bg-slate-400"}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
