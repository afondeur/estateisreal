import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "../context/AuthContext";

export const metadata: Metadata = {
  title: "ESTATEisREAL — Prefactibilidad Inmobiliaria",
  description: "Analiza la viabilidad financiera de proyectos inmobiliarios en minutos. Herramienta profesional de prefactibilidad para desarrolladores de LATAM.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
