"use client";
import { useState, useEffect } from "react";
import Script from "next/script";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export default function GoogleAnalytics() {
  const [consent, setConsent] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem("ga-consent");
    setConsent(stored);
  }, []);

  const handleAccept = () => {
    localStorage.setItem("ga-consent", "accepted");
    setConsent("accepted");
  };

  const handleReject = () => {
    localStorage.setItem("ga-consent", "rejected");
    setConsent("rejected");
  };

  if (!GA_ID) return null;

  return (
    <>
      {consent === "accepted" && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            strategy="afterInteractive"
          />
          <Script id="google-analytics" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_ID}');
            `}
          </Script>
        </>
      )}

      {consent === null && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 9999,
            background: "#1e293b",
            borderTop: "1px solid #334155",
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <span style={{ color: "#cbd5e1", fontSize: "13px" }}>
            Usamos cookies de analítica para mejorar tu experiencia.
          </span>
          <button
            onClick={handleAccept}
            style={{
              background: "#3b82f6",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              padding: "6px 16px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Aceptar
          </button>
          <button
            onClick={handleReject}
            style={{
              background: "transparent",
              color: "#94a3b8",
              border: "1px solid #475569",
              borderRadius: "8px",
              padding: "6px 16px",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            Rechazar
          </button>
        </div>
      )}
    </>
  );
}
