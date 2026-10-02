"use client";
import Link from "next/link";

export default function UsageLimitModal({ onClose, analysisCount, limit = 5, anonymous = false }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        {anonymous ? (
          <>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Regístrate para ver tus resultados</h2>
            <p className="text-slate-600 mb-2">Es gratis: <strong>{limit} análisis completos al mes</strong>.</p>
            <p className="text-sm text-slate-500 mb-6">Con tu cuenta también puedes guardar tus proyectos y retomarlos después.</p>
            <div className="space-y-3">
              <Link href="/registro" className="block w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-xl transition text-center">
                Registrarme gratis
              </Link>
              <Link href="/login" className="block w-full text-blue-600 hover:text-blue-500 text-sm font-medium py-2 transition">
                Ya tengo cuenta — iniciar sesión
              </Link>
              <button onClick={onClose} className="block w-full text-slate-500 hover:text-slate-700 text-sm py-2 transition">
                Seguir editando
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Llegaste a tu límite mensual</h2>
            <p className="text-slate-600 mb-2">Usaste <strong>{analysisCount} de {limit}</strong> análisis gratuitos este mes.</p>
            <p className="text-sm text-slate-500 mb-6">Con Pro tienes análisis ilimitados con resultados en vivo, sensibilidad, escenarios y PDF sin marca.</p>
            <div className="space-y-3">
              <Link href="/pricing" className="block w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-xl transition text-center">
                Ver planes Pro
              </Link>
              <button onClick={onClose} className="block w-full text-slate-500 hover:text-slate-700 text-sm py-2 transition">
                Seguir con plan gratuito
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-4">Tu límite se renueva el primer día de cada mes.</p>
          </>
        )}
      </div>
    </div>
  );
}
