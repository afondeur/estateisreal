"use client";
import Link from "next/link";
import Navbar from "../../components/Navbar";
import { useAuth } from "../../context/AuthContext";

export default function PricingPage() {
  const { user } = useAuth();

  const plans = [
    {
      name: "Gratuito",
      price: "$0",
      period: "para siempre",
      desc: "Ideal para evaluar la herramienta",
      features: [
        "3 análisis por mes",
        "Todas las métricas financieras",
        "Tablas de sensibilidad",
        "Escenarios de mercado",
        "Exportar a PDF (print)",
      ],
      cta: user ? "Tu plan actual" : "Empezar Gratis",
      ctaLink: user ? null : "/registro",
      highlighted: false,
      current: user?.plan === "free",
    },
    {
      name: "Premium",
      price: "$25",
      period: "/mes",
      yearlyPrice: "$300/año (ahorra $48)",
      desc: "Para desarrolladores profesionales",
      features: [
        "Análisis ilimitados",
        "Historial de proyectos guardado",
        "Comparador de proyectos",
        "Exportar a Excel",
        "Soporte prioritario",
        "Nuevas funciones primero",
      ],
      cta: user?.plan === "premium" ? "Tu plan actual" : "Empezar Premium",
      ctaLink: null, // Conectará a Stripe
      highlighted: true,
      current: user?.plan === "premium",
    },
  ];

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-slate-50 py-16 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-3xl font-bold text-slate-800 mb-3">
              El plan perfecto para tu negocio
            </h1>
            <p className="text-slate-500 max-w-xl mx-auto">
              Evalúa proyectos inmobiliarios con precisión profesional. Comienza gratis y actualiza cuando lo necesites.
            </p>
          </div>

          {/* Cards */}
          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-8 ${
                  plan.highlighted
                    ? "bg-white border-2 border-blue-500 shadow-xl shadow-blue-100 relative"
                    : "bg-white border border-slate-200 shadow-sm"
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-4 py-1 rounded-full">
                    MÁS POPULAR
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-lg font-bold text-slate-800">{plan.name}</h3>
                  <p className="text-sm text-slate-500">{plan.desc}</p>
                </div>

                <div className="mb-6">
                  <span className="text-4xl font-black text-slate-800">{plan.price}</span>
                  <span className="text-slate-500 text-sm ml-1">{plan.period}</span>
                  {plan.yearlyPrice && (
                    <p className="text-xs text-blue-600 mt-1 font-medium">{plan.yearlyPrice}</p>
                  )}
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                      <svg className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>

                {plan.current ? (
                  <div className="w-full text-center py-3 bg-slate-100 text-slate-500 font-medium rounded-xl text-sm">
                    Tu plan actual
                  </div>
                ) : plan.ctaLink ? (
                  <Link
                    href={plan.ctaLink}
                    className={`block w-full text-center py-3 rounded-xl font-bold transition text-sm ${
                      plan.highlighted
                        ? "bg-blue-600 hover:bg-blue-500 text-white"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                    }`}
                  >
                    {plan.cta}
                  </Link>
                ) : (
                  <button
                    className={`w-full py-3 rounded-xl font-bold transition text-sm ${
                      plan.highlighted
                        ? "bg-blue-600 hover:bg-blue-500 text-white"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                    }`}
                    onClick={() => alert("Próximamente: pago con Stripe. Estamos en proceso de configurar los pagos.")}
                  >
                    {plan.cta}
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* FAQ */}
          <div className="mt-16 max-w-2xl mx-auto">
            <h2 className="text-xl font-bold text-slate-800 text-center mb-8">Preguntas Frecuentes</h2>
            <div className="space-y-4">
              {[
                { q: "¿Puedo cancelar en cualquier momento?", a: "Sí. Sin contratos ni compromisos. Cancela cuando quieras y tu cuenta vuelve al plan gratuito." },
                { q: "¿Qué pasa con mis datos si cancelo?", a: "Tus análisis guardados permanecen accesibles por 90 días después de cancelar." },
                { q: "¿Aceptan tarjetas de República Dominicana?", a: "Sí. Aceptamos Visa, Mastercard y American Express de cualquier banco dominicano o internacional." },
                { q: "¿Ofrecen descuento para equipos?", a: "Contáctanos para planes empresariales con descuentos por volumen." },
              ].map((faq) => (
                <div key={faq.q} className="bg-white rounded-xl border border-slate-200 p-4">
                  <h4 className="font-medium text-slate-800 text-sm">{faq.q}</h4>
                  <p className="text-sm text-slate-500 mt-1">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
