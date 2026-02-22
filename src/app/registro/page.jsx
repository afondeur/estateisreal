"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";

export default function RegistroPage() {
  const [name, setName] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signUp, loginWithGoogle } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!name || !email || !password) { setError("Completa todos los campos obligatorios"); return; }
    if (password.length < 6) { setError("La contraseña debe tener al menos 6 caracteres"); return; }
    setLoading(true);
    const { data, error: authError } = await signUp(email, password, name, empresa);
    setLoading(false);
    if (authError) {
      if (authError.message?.includes("already registered")) {
        setError("Este correo ya tiene una cuenta. Intenta iniciar sesión.");
      } else {
        setError(authError.message || "Error al crear la cuenta");
      }
      return;
    }
    // Si el usuario ya tiene sesión activa (email confirm desactivado), ir al home
    if (data?.session) {
      router.push("/");
      return;
    }
    // Si necesita confirmar email, mostrar pantalla de éxito
    setSuccess(true);
  };

  const handleGoogle = async () => {
    const { error: authError } = await loginWithGoogle();
    if (authError) {
      setError("Error al conectar con Google. Intenta de nuevo.");
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-800 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center">
            <div className="text-4xl mb-4">📧</div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Revisa tu correo</h2>
            <p className="text-slate-500 text-sm mb-4">
              Te enviamos un enlace de confirmación a <strong>{email}</strong>.
              Haz clic en el enlace para activar tu cuenta.
            </p>
            <Link href="/login" className="text-blue-600 hover:text-blue-500 font-medium text-sm">
              Ir a Iniciar Sesión
            </Link>
          </div>
        </div>
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
          <p className="text-sm text-slate-400 mt-2">Crea tu cuenta gratuita</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
          <button onClick={handleGoogle} className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-200 hover:border-slate-300 rounded-xl py-3 px-4 text-sm font-medium text-slate-700 transition mb-6">
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Registrarse con Google
          </button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
            <div className="relative flex justify-center text-xs"><span className="bg-white px-4 text-slate-400">o con correo electrónico</span></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">{error}</div>}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre completo *</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" placeholder="Juan Pérez" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Empresa <span className="text-slate-400">(opcional)</span></label>
              <input type="text" value={empresa} onChange={(e) => setEmpresa(e.target.value)} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" placeholder="Mi Empresa S.R.L." />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Correo electrónico *</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" placeholder="tu@correo.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña *</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" placeholder="Mínimo 6 caracteres" />
            </div>
            <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-400 text-white font-bold py-3 rounded-xl transition">
              {loading ? "Creando cuenta..." : "Crear Cuenta Gratuita"}
            </button>
          </form>

          <p className="text-xs text-slate-400 text-center mt-4">Al registrarte aceptas los Términos de Servicio y Política de Privacidad.</p>
          <p className="text-center text-sm text-slate-500 mt-6">
            ¿Ya tienes cuenta? <Link href="/login" className="text-blue-600 hover:text-blue-500 font-medium">Inicia sesión</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
