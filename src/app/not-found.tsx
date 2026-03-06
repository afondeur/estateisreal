import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-6">
          <span
            className="text-2xl font-black tracking-widest text-white"
            style={{ letterSpacing: "0.15em" }}
          >
            ESTATE<span className="text-blue-400">is</span>REAL
          </span>
        </div>
        <div className="text-7xl font-black text-slate-600 mb-2">404</div>
        <h1 className="text-xl font-bold text-white mb-2">
          Página no encontrada
        </h1>
        <p className="text-slate-400 text-sm mb-6">
          La página que buscas no existe o fue movida.
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
