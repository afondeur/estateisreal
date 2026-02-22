"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";
import Navbar from "../../components/Navbar";

export default function CuentaPage() {
  const { user, analysisCount, logout } = useAuth();
  const router = useRouter();

  if (!user) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-bold text-slate-800 mb-2">Inicia sesión para ver tu cuenta</h2>
            <Link href="/login" className="text-blue-600 hover:text-blue-500 font-medium">Ir a login</Link>
          </div>
        </div>
      </>
    );
  }

  const isPremium = user.plan === "premium";

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-slate-50 py-8 px-4">
        <div className="max-w-2xl mx-auto space-y-6">
          <h1 className="text-2xl font-bold text-slate-800">Mi Cuenta</h1>

          {/* Info del usuario */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-4">Información Personal</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-500">Nombre</span>
                <span className="font-medium text-slate-800">{user.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Email</span>
                <span className="font-medium text-slate-800">{user.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Miembro desde</span>
                <span className="font-medium text-slate-800">{new Date(user.createdAt).toLocaleDateString("es-DO")}</span>
              </div>
            </div>
          </div>

          {/* Plan actual */}
          <div className={`rounded-2xl shadow-sm border p-6 ${isPremium ? "bg-blue-50 border-blue-200" : "bg-white border-slate-200"}`}>
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-4">Tu Plan</h2>
            <div className="flex items-center justify-between">
              <div>
                <span className={`text-lg font-bold ${isPremium ? "text-blue-700" : "text-slate-800"}`}>
                  {isPremium ? "Premium" : "Gratuito"}
                </span>
                {!isPremium && (
                  <p className="text-sm text-slate-500 mt-1">3 análisis por mes</p>
                )}
                {isPremium && (
                  <p className="text-sm text-blue-600 mt-1">Análisis ilimitados</p>
                )}
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-bold ${isPremium ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-600"}`}>
                {isPremium ? "PREMIUM" : "FREE"}
              </span>
            </div>
          </div>

          {/* Uso del mes */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-4">Uso Este Mes</h2>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${isPremium ? "bg-blue-500" : analysisCount >= 3 ? "bg-red-500" : "bg-emerald-500"}`}
                    style={{ width: isPremium ? "30%" : `${Math.min(100, (analysisCount / 3) * 100)}%` }}
                  />
                </div>
              </div>
              <span className="text-sm font-mono text-slate-600">
                {isPremium ? `${analysisCount} análisis` : `${analysisCount}/3`}
              </span>
            </div>
            {!isPremium && analysisCount >= 3 && (
              <p className="text-sm text-red-600 mt-2 font-medium">Has alcanzado tu límite mensual.</p>
            )}
          </div>

          {/* CTA Upgrade */}
          {!isPremium && (
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 text-white text-center">
              <h3 className="text-lg font-bold mb-2">Desbloquea todo el potencial</h3>
              <p className="text-blue-100 text-sm mb-4">Análisis ilimitados, historial completo y soporte prioritario.</p>
              <Link href="/pricing" className="inline-block bg-white text-blue-700 font-bold px-6 py-3 rounded-xl hover:bg-blue-50 transition">
                Upgrade a Premium — $25/mes
              </Link>
            </div>
          )}

          {/* Cerrar sesión */}
          <button onClick={() => { logout(); router.push("/"); }} className="text-sm text-red-500 hover:text-red-700 transition">
            Cerrar sesión
          </button>
        </div>
      </div>
    </>
  );
}
