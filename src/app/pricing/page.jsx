"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "../../components/Navbar";
import { useAuth } from "../../context/AuthContext";

export default function PricingPage() {
  const { user, tier } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const isFree = !user || tier === "free";
  const isPro = tier === "pro";

  const handleCheckout = async () => {
    if (!user) {
      router.push("/registro");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, userId: user.id }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Error al iniciar el pago. Intenta de nuevo.");
        setLoading(false);
      }
    } catch (err) {
      alert("Error de conexión. Intenta de nuevo.");
      setLoading(false);
    }
  };

  const plans = [
    {
      name: "Gratuito",
      price: "$0",
      period: "para siempre",
      desc: "Ideal para evaluar la herramienta",
      features: [
        "Métricas financieras completas",
        "Semáforo VIABLE / NO VIABLE",
        "Estructura de capital",
        "Exportar a PDF (con marca)",
      ],
      cta: user ? (isFree ? "Tu plan actual" : "Plan Gratuito") : "Empezar Gratis",
      ctaLink: user ? null : "/registro",
      highlighted: false,
      current: user && isFree,
    },
    {
      name: "Pro",
      price: "$25",
      period: "/mes",
      yearlyPrice: "$300/año (ahorra $48)",
      desc: "Para desarrolladores profesionales",
      features: [
        "Todo lo del plan Gratuito",
        "Tablas de sensibilidad (7 variables)",
        "5 escenarios de mercado",
        "Punto de equilibrio detallado",
        "Análisis ilimitados",
        "PDF profesional sin marca",
        "Soporte prioritario",
      ],
      cta: isPro ? "Tu plan actual" : loading ? "Procesando..." : "Empezar Pro",
      ctaAction: handleCheckout,
      highlighted: true,
      current: isPro,
    },
  ];

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-slate-800 py-16 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-3xl font-bold text-white mb-3">
              El plan perfecto para tu negocio
            </h1>
            <p className="text-slate-400 max-w-xl mx-auto">
              Evalúa proyectos inmobiliarios con precisión profesional. Comienza gratis y actualiza cuando lo necesites.
            </p>
          </div>

          {/* Mensaje de éxito después de pago */}
          {typeof window !== "undefined" && new URLSearchParams(window.location.search).get("success") && (
            <div className="mb-8 bg-emerald-900/30 border border-emerald-600 rounded-xl p-4 text-center">
              <p className="text-emerald-300 font-bold">¡Bienvenido al plan Pro! Tu cuenta ya está activada.</p>
            </div>
          )}

          {/* Cards */}
          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-8 ${
                  plan.highlighted
                    ? "bg-white border-2 border-blue-500 shadow-xl shadow-blue-500/20 relative"
                    : "bg-slate-700 border border-slate-600 shadow-sm"
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-4 py-1 rounded-full">
                    MÁS POPULAR
                  </div>
                )}

                <div className="mb-6">
                  <h3 className={`text-lg font-bold ${plan.highlighted ? "text-slate-800" : "text-white"}`}>{plan.name}</h3>
                  <p className={`text-sm ${plan.highlighted ? "text-slate-500" : "text-slate-400"}`}>{plan.desc}</p>
                </div>

                <div className="mb-6">
                  <span className={`text-4xl font-black ${plan.highlighted ? "text-slate-800" : "text-white"}`}>{plan.price}</span>
                  <span className={`text-sm ml-1 ${plan.highlighted ? "text-slate-500" : "text-slate-400"}`}>{plan.period}</span>
                  {plan.yearlyPrice && (
                    <p className="text-xs text-blue-400 mt-1 font-medium">{plan.yearlyPrice}</p>
                  )}
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className={`flex items-start gap-2 text-sm ${plan.highlighted ? "text-slate-600" : "text-slate-300"}`}>
                      <svg className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>

                {plan.current ? (
                  <div className={`w-full text-center py-3 font-medium rounded-xl text-sm ${plan.highlighted ? "bg-blue-50 text-blue-600" : "bg-slate-600 text-slate-300"}`}>
                    Tu plan actual
                  </div>
                ) : plan.ctaLink ? (
                  <Link
                    href={plan.ctaLink}
                    className={`block w-full text-center py-3 rounded-xl font-bold transition text-sm ${
                      plan.highlighted
                        ? "bg-blue-600 hover:bg-blue-500 text-white"
                        : "bg-slate-600 hover:bg-slate-500 text-white"
                    }`}
                  >
                    {plan.cta}
                  </Link>
                ) : (
                  <button
                    disabled={loading && plan.highlighted}
                    className={`w-full py-3 rounded-xl font-bold transition text-sm ${
                      plan.highlighted
                        ? "bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 disabled:cursor-wait"
                        : "bg-slate-600 hover:bg-slate-500 text-white"
                    }`}
                    onClick={plan.ctaAction || null}
                  >
                    {plan.cta}
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* FAQ */}
          <div className="mt-16 max-w-2xl mx-auto">
            <h2 className="text-xl font-bold text-white text-center mb-8">Preguntas Frecuentes</h2>
            <div className="space-y-4">
              {[
                { q: "¿Puedo cancelar en cualquier momento?", a: "Sí. Sin contratos ni compromisos. Cancela cuando quieras y tu cuenta vuelve al plan gratuito." },
                { q: "¿Qué pasa con mis datos si cancelo?", a: "Tus análisis guardados permanecen accesibles por 90 días después de cancelar." },
                { q: "¿Aceptan tarjetas de República Dominicana?", a: "Sí. Aceptamos Visa, Mastercard y American Express de cualquier banco dominicano o internacional." },
                { q: "¿Ofrecen descuento para equipos?", a: "Contáctanos para planes empresariales con descuentos por volumen." },
              ].map((faq) => (
                <div key={faq.q} className="bg-slate-700 rounded-xl border border-slate-600 p-4">
                  <h4 className="font-medium text-slate-100 text-sm">{faq.q}</h4>
                  <p className="text-sm text-slate-400 mt-1">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
