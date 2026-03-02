"use client";
import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../../context/AuthContext";

export default function CompartirPage() {
  const { token } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState("loading"); // loading | needLogin | cloning | success | own | error
  const [message, setMessage] = useState("");
  const cloneAttempted = useRef(false);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setStatus("needLogin");
      return;
    }

    if (cloneAttempted.current) return;
    cloneAttempted.current = true;

    setStatus("cloning");
    fetch(`/api/share/${token}`, { method: "POST" })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setStatus("error");
          setMessage(data.error);
        } else if (data.cloned === false) {
          setStatus("own");
          setMessage(data.message);
        } else {
          setStatus("success");
          setMessage(data.message);
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Error de conexión. Intenta de nuevo.");
      });
  }, [authLoading, user, token]);

  return (
    <div className="min-h-screen bg-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <span className="text-2xl font-black tracking-widest text-white" style={{ letterSpacing: "0.15em" }}>
              ESTATE<span className="text-blue-400">is</span>REAL
            </span>
          </Link>
          <p className="text-sm text-slate-400 mt-2">Compartir proyecto</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center">
          {(status === "loading" || status === "cloning") && (
            <>
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-slate-600 text-sm">Procesando...</p>
            </>
          )}

          {status === "needLogin" && (
            <>
              <div className="text-4xl mb-4">🔒</div>
              <h2 className="text-lg font-bold text-slate-800 mb-2">Inicia sesión para continuar</h2>
              <p className="text-sm text-slate-500 mb-6">
                Necesitas una cuenta para recibir una copia de este proyecto.
              </p>
              <Link
                href={`/login?redirect=/compartir/${token}`}
                className="inline-block w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition"
              >
                Iniciar Sesión
              </Link>
              <p className="text-xs text-slate-400 mt-3">
                ¿No tienes cuenta? <Link href={`/registro?redirect=/compartir/${token}`} className="text-blue-600 hover:text-blue-500 font-medium">Regístrate gratis</Link>
              </p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="text-4xl mb-4">✅</div>
              <h2 className="text-lg font-bold text-slate-800 mb-2">Proyecto copiado</h2>
              <p className="text-sm text-slate-500 mb-6">{message}</p>
              <Link
                href="/?proyectos=1"
                className="inline-block w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition"
              >
                Ir a Mis Proyectos
              </Link>
            </>
          )}

          {status === "own" && (
            <>
              <div className="text-4xl mb-4">📋</div>
              <h2 className="text-lg font-bold text-slate-800 mb-2">Es tu proyecto</h2>
              <p className="text-sm text-slate-500 mb-6">{message}</p>
              <Link
                href="/?proyectos=1"
                className="inline-block w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition"
              >
                Ir a Mis Proyectos
              </Link>
            </>
          )}

          {status === "error" && (
            <>
              <div className="text-4xl mb-4">❌</div>
              <h2 className="text-lg font-bold text-slate-800 mb-2">Error</h2>
              <p className="text-sm text-slate-500 mb-6">{message}</p>
              <Link
                href="/"
                className="inline-block w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-xl transition"
              >
                Ir al Inicio
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
