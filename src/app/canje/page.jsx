"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";
import Navbar from "../../components/Navbar";

const PENDING_CODE_KEY = "estateisreal_pending_promo_code";

function CanjeContent() {
  const { user, loading, refreshProfile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [code, setCode] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [message, setMessage] = useState("");
  const [proUntil, setProUntil] = useState(null);
  const [durationDays, setDurationDays] = useState(null);

  // Prefill code desde ?code= o desde localStorage (si venía de login forzado)
  useEffect(() => {
    const fromUrl = searchParams.get("code");
    if (fromUrl) {
      setCode(fromUrl.trim().toUpperCase());
      return;
    }
    try {
      const pending = localStorage.getItem(PENDING_CODE_KEY);
      if (pending) setCode(pending);
    } catch {}
  }, [searchParams]);

  const redeem = useCallback(async (codeToRedeem) => {
    if (!codeToRedeem) return;
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/redeem-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: codeToRedeem }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setStatus("error");
        setMessage(data.error || "No se pudo canjear el código");
        return;
      }
      setStatus("success");
      setProUntil(data.pro_until);
      setDurationDays(data.duration_days);
      try { localStorage.removeItem(PENDING_CODE_KEY); } catch {}
      // Refrescar perfil varias veces para que AuthContext vea los cambios
      for (let i = 0; i < 3; i++) {
        await new Promise(r => setTimeout(r, 400));
        await refreshProfile();
      }
    } catch (e) {
      console.error(e);
      setStatus("error");
      setMessage("Error de red. Intenta de nuevo.");
    }
  }, [refreshProfile]);

  // Auto-canje si hay user + code en URL
  useEffect(() => {
    if (loading) return;
    const fromUrl = searchParams.get("code");
    if (user && fromUrl && status === "idle") {
      redeem(fromUrl.trim().toUpperCase());
    }
  }, [user, loading, searchParams, status, redeem]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    if (!user) {
      try { localStorage.setItem(PENDING_CODE_KEY, trimmed); } catch {}
      router.push("/login?redirect=/canje");
      return;
    }
    redeem(trimmed);
  };

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-slate-800 py-8 px-4">
        <div className="max-w-lg mx-auto">
          <div className="bg-slate-700 rounded-2xl shadow-lg border border-slate-600 p-6 sm:p-8">
            <h1 className="text-2xl font-bold text-slate-100 mb-2">Canjear código</h1>
            <p className="text-sm text-slate-400 mb-6">
              Si tienes un código de activación, ingrésalo aquí para obtener acceso Pro temporal.
            </p>

            {!user && !loading && (
              <div className="bg-amber-900/30 border border-amber-700 rounded-xl p-3 mb-5">
                <p className="text-amber-200 text-xs">
                  Ingresa tu código y te pediremos iniciar sesión o registrarte al canjear.
                </p>
              </div>
            )}

            {status === "success" ? (
              <div className="bg-emerald-900/30 border border-emerald-600 rounded-xl p-5 text-center">
                <div className="text-4xl mb-2">✓</div>
                <p className="text-emerald-300 font-bold text-lg mb-2">
                  ¡Código canjeado!
                </p>
                <p className="text-slate-200 text-sm mb-4">
                  Tu cuenta es ahora <strong className="text-blue-300">Pro</strong> por {durationDays} días.
                </p>
                {proUntil && (
                  <p className="text-slate-400 text-xs mb-4">
                    Expira: {new Date(proUntil).toLocaleString("es-DO", {
                      year: "numeric", month: "long", day: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                )}
                <div className="flex gap-2 justify-center">
                  <Link href="/" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium text-white transition">
                    Ir a la herramienta
                  </Link>
                  <Link href="/cuenta" className="px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded-lg text-sm font-medium text-white transition">
                    Ver mi cuenta
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="code" className="block text-sm font-medium text-slate-300 mb-2">
                    Código
                  </label>
                  <input
                    id="code"
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="TUR2026"
                    disabled={status === "loading"}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none disabled:opacity-50 uppercase tracking-wider"
                    maxLength={50}
                    autoComplete="off"
                    autoFocus
                  />
                </div>

                {status === "error" && message && (
                  <div className="bg-red-900/30 border border-red-700 rounded-lg p-3">
                    <p className="text-red-300 text-sm">{message}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={status === "loading" || !code}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg text-white font-medium transition"
                >
                  {status === "loading"
                    ? "Canjeando..."
                    : !user ? "Iniciar sesión y canjear" : "Canjear código"}
                </button>
              </form>
            )}

            <div className="mt-6 pt-5 border-t border-slate-600 space-y-3">
              <p className="text-xs text-slate-500">
                Los códigos promocionales tienen fechas de validez y cupos limitados. Un mismo email solo puede canjear un código una vez.
              </p>
              <p className="text-xs text-slate-500 leading-relaxed">
                <strong className="text-slate-400">Uso de datos agregados:</strong> al generar análisis, los datos del proyecto (ciudad, sistema constructivo, costos, precios, tipo) se guardan de forma <strong>anónima</strong> para producir benchmarks de mercado. <strong>No compartimos</strong> nombre del proyecto, email ni ningún dato identificable. Los datos solo se usan en agregado.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function CanjePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-800" />}>
      <CanjeContent />
    </Suspense>
  );
}
