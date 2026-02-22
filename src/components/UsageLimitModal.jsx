"use client";
import Link from "next/link";

export default function UsageLimitModal({ onClose, analysisCount }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Llegaste a tu límite mensual</h2>
        <p className="text-slate-600 mb-2">Has usado <strong>{analysisCount} de 3</strong> análisis gratuitos este mes.</p>
        <p className="text-sm text-slate-500 mb-6">Actualiza a Premium para análisis ilimitados, historial guardado y acceso a todas las funciones.</p>
        <div className="space-y-3">
          <Link href="/pricing" className="block w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-xl transition text-center">
            Ver Planes — desde $25/mes
          </Link>
          <button onClick={onClose} className="block w-full text-slate-500 hover:text-slate-700 text-sm py-2 transition">
            Seguir con plan gratuito
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-4">Tu límite se renueva el primer día de cada mes.</p>
      </div>
    </div>
  );
}
