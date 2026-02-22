"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";
import Navbar from "../../components/Navbar";

export default function CuentaPage() {
  const { user, profile, tier, isAdmin, logout } = useAuth();
  const router = useRouter();

  if (!user) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-slate-800 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-bold text-slate-200 mb-2">Inicia sesión para ver tu cuenta</h2>
            <Link href="/login" className="text-blue-400 hover:text-blue-300 font-medium">Ir a login</Link>
          </div>
        </div>
      </>
    );
  }

  const isPremium = tier === "pro" || tier === "enterprise";

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-slate-800 py-8 px-4">
        <div className="max-w-2xl mx-auto space-y-6">
          <h1 className="text-2xl font-bold text-slate-100">Mi Cuenta</h1>

          {/* Info del usuario */}
          <div className="bg-slate-700 rounded-2xl shadow-sm border border-slate-600 p-6">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wide mb-4">Información Personal</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-400">Nombre</span>
                <span className="font-medium text-slate-100">{profile?.nombre || user.email?.split("@")[0] || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Email</span>
                <span className="font-medium text-slate-100">{user.email}</span>
              </div>
              {profile?.empresa && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Empresa</span>
                  <span className="font-medium text-slate-100">{profile.empresa}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-400">Miembro desde</span>
                <span className="font-medium text-slate-100">
                  {profile?.created_at ? new Date(profile.created_at).toLocaleDateString("es-DO") : "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Plan actual */}
          <div className={`rounded-2xl shadow-sm border p-6 ${isPremium ? "bg-blue-900/30 border-blue-700" : "bg-slate-700 border-slate-600"}`}>
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wide mb-4">Tu Plan</h2>
            <div className="flex items-center justify-between">
              <div>
                <span className={`text-lg font-bold ${isPremium ? "text-blue-300" : "text-slate-100"}`}>
                  {isAdmin ? "Administrador" : isPremium ? "Pro" : "Gratuito"}
                </span>
                {!isPremium && (
                  <p className="text-sm text-slate-400 mt-1">Acceso básico a resultados</p>
                )}
                {isPremium && (
                  <p className="text-sm text-blue-400 mt-1">Acceso completo: Sensibilidad, Escenarios, PDF limpio</p>
                )}
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-bold ${isPremium ? "bg-blue-600 text-white" : "bg-slate-600 text-slate-300"}`}>
                {isAdmin ? "ADMIN" : isPremium ? "PRO" : "GRATIS"}
              </span>
            </div>
          </div>

          {/* CTA Cambiar a Premium */}
          {!isPremium && (
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 text-white text-center">
              <h3 className="text-lg font-bold mb-2">Desbloquea todo el potencial</h3>
              <p className="text-blue-100 text-sm mb-4">Tablas de sensibilidad, análisis de escenarios y PDF profesional sin marca.</p>
              <Link href="/pricing" className="inline-block bg-white text-blue-700 font-bold px-6 py-3 rounded-xl hover:bg-blue-50 transition">
                Cambiar a Pro — $25/mes
              </Link>
            </div>
          )}

          {/* Cerrar sesión */}
          <button onClick={() => { logout(); router.push("/"); }} className="text-sm text-red-400 hover:text-red-300 transition">
            Cerrar sesión
          </button>
        </div>
      </div>
    </>
  );
}
