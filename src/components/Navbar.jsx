"use client";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, profile, tier, isAdmin, logout } = useAuth();

  return (
    <nav className="no-print bg-slate-900 text-white px-4 py-3 shadow-lg">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition">
          <span className="text-lg font-black tracking-widest" style={{ letterSpacing: "0.15em" }}>
            ESTATE<span className="text-blue-400">is</span>REAL
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/pricing" className="text-sm text-slate-300 hover:text-white transition">Planes</Link>
          {user ? (
            <>
              <Link href="/cuenta" className="text-sm text-slate-300 hover:text-white transition">Mi Cuenta</Link>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  isAdmin ? "bg-amber-500 text-slate-900" :
                  tier === "pro" ? "bg-blue-600 text-white" :
                  "bg-slate-600 text-slate-300"
                }`}>
                  {isAdmin ? "ADMIN" : tier === "pro" ? "PRO" : "GRATIS"}
                </span>
                <span className="text-sm text-slate-400">{profile?.nombre || user.email}</span>
                <button onClick={logout} className="text-xs text-slate-500 hover:text-red-400 transition ml-2">Salir</button>
              </div>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm text-slate-300 hover:text-white transition">Iniciar Sesión</Link>
              <Link href="/registro" className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition">Registrarse</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
