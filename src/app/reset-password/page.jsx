"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";

export default function ResetPasswordPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Si no hay sesión activa (no llegó vía recovery), mandar a login
  // Nota: el callback de Supabase autentica al usuario antes de redirigir aquí,
  // así que si user es null al cargar después de loading=false, el flow falló.
  useEffect(() => {
    if (loading) return;
    if (!user) {
      // Espera 1.5s por si la sesión se está propagando, luego redirige
      const t = setTimeout(() => {
        if (!user) router.push("/login");
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [user, loading, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("La contraseña debe tener al menos 8 caracteres"); return; }
    if (password !== confirm) { setError("Las contraseñas no coinciden"); return; }
    if (!supabase) { setError("Servicio no disponible"); return; }
    setSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message || "No se pudo actualizar la contraseña");
        return;
      }
      setSuccess(true);
      // Redirigir a la app después de 2s
      setTimeout(() => router.push("/cuenta"), 2000);
    } catch (err) {
      console.error("reset-password error:", err);
      setError("Error inesperado. Intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-800 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-blue-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <span className="text-2xl font-black tracking-widest text-white" style={{ letterSpacing: "0.15em" }}>
              ESTATE<span className="text-blue-400">is</span>REAL
            </span>
          </Link>
          <p className="text-sm text-slate-400 mt-2">Restablece tu contraseña</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
          {success ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-3">✓</div>
              <p className="text-lg font-bold text-slate-800 mb-1">¡Contraseña actualizada!</p>
              <p className="text-sm text-slate-500">Redirigiendo a tu cuenta...</p>
            </div>
          ) : !user ? (
            <div className="text-center py-4">
              <p className="text-sm text-slate-600 mb-4">
                El enlace ya expiró o no es válido. Solicita un nuevo enlace de recuperación.
              </p>
              <Link
                href="/login"
                className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium text-white transition"
              >
                Volver a iniciar sesión
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-xs text-slate-500 mb-2">
                Cuenta: <strong className="text-slate-700">{user.email}</strong>
              </p>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2" role="alert">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="new-password" className="block text-sm font-medium text-slate-700 mb-1">
                  Nueva contraseña
                </label>
                <input
                  id="new-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="Mínimo 8 caracteres"
                  autoFocus
                  autoComplete="new-password"
                />
              </div>

              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-700 mb-1">
                  Confirmar contraseña
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="Repite la contraseña"
                  autoComplete="new-password"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-400 text-white font-bold py-3 rounded-xl transition"
              >
                {submitting ? "Actualizando..." : "Actualizar contraseña"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
