// Solo permite rutas internas ("/algo"). Rechaza "//dominio" y "/\dominio",
// que el navegador interpreta como URLs externas (open redirect).
export function safeRedirect(path, fallback = "/") {
  if (typeof path !== "string" || !path.startsWith("/")) return fallback;
  if (path.startsWith("//") || path.startsWith("/\\")) return fallback;
  return path;
}
