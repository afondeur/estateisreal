"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, profile, tier, isAdmin, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close menu on click outside
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  return (
    <nav className="no-print bg-slate-900 text-white px-4 py-3 shadow-lg" ref={menuRef}>
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition">
          <span className="text-lg font-black tracking-widest" style={{ letterSpacing: "0.15em" }}>
            ESTATE<span className="text-blue-400">is</span>REAL
          </span>
        </Link>

        {/* Desktop menu */}
        <div className="hidden md:flex items-center gap-4">
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

        {/* Hamburger button (mobile) */}
        <button
          className="md:hidden p-2 text-slate-300 hover:text-white transition"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Abrir menú"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu panel */}
      {menuOpen && (
        <div className="md:hidden mt-3 pb-3 border-t border-slate-700 pt-3 space-y-3">
          <Link href="/pricing" className="block text-sm text-slate-300 hover:text-white transition" onClick={() => setMenuOpen(false)}>Planes</Link>
          {user ? (
            <>
              <Link href="/cuenta" className="block text-sm text-slate-300 hover:text-white transition" onClick={() => setMenuOpen(false)}>Mi Cuenta</Link>
              <div className="flex items-center gap-2 pt-1">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  isAdmin ? "bg-amber-500 text-slate-900" :
                  tier === "pro" ? "bg-blue-600 text-white" :
                  "bg-slate-600 text-slate-300"
                }`}>
                  {isAdmin ? "ADMIN" : tier === "pro" ? "PRO" : "GRATIS"}
                </span>
                <span className="text-sm text-slate-400">{profile?.nombre || user.email}</span>
              </div>
              <button onClick={() => { logout(); setMenuOpen(false); }} className="text-sm text-slate-500 hover:text-red-400 transition">Salir</button>
            </>
          ) : (
            <>
              <Link href="/login" className="block text-sm text-slate-300 hover:text-white transition" onClick={() => setMenuOpen(false)}>Iniciar Sesión</Link>
              <Link href="/registro" className="block text-center px-4 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition" onClick={() => setMenuOpen(false)}>Registrarse</Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
