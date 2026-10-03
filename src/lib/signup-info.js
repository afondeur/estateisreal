// Datos opcionales del registro: rol, origen y UTM (primer contacto).
// Los valores deben coincidir con la lista permitida en el trigger handle_new_user.

export const ROLES = [
  { value: "desarrollador", label: "Desarrollador / promotor" },
  { value: "inversionista", label: "Inversionista" },
  { value: "constructor", label: "Constructor / ingeniero / arquitecto" },
  { value: "corredor", label: "Corredor inmobiliario" },
  { value: "banco_tasador", label: "Banco / tasador" },
  { value: "estudiante", label: "Estudiante" },
  { value: "otro", label: "Otro" },
];

export const ORIGENES = [
  { value: "diplomado", label: "Diplomado / clase" },
  { value: "recomendacion", label: "Recomendación de alguien" },
  { value: "redes", label: "Redes sociales" },
  { value: "google", label: "Búsqueda en Google" },
  { value: "evento", label: "Evento o charla" },
  { value: "otro", label: "Otro" },
];

const UTM_KEY = "estateisreal_utm";
const PENDING_KEY = "estateisreal_pending_profile";
const UTM_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_content"];

// Guarda el primer UTM con que llegó el visitante (no se sobrescribe)
export function captureUtm() {
  try {
    if (localStorage.getItem(UTM_KEY)) return;
    const params = new URLSearchParams(window.location.search);
    const utm = {};
    for (const k of UTM_PARAMS) {
      const v = params.get(k);
      if (v) utm[k] = v.slice(0, 100);
    }
    if (Object.keys(utm).length) localStorage.setItem(UTM_KEY, JSON.stringify(utm));
  } catch {}
}

export function getUtm() {
  try {
    return JSON.parse(localStorage.getItem(UTM_KEY) || "null");
  } catch {
    return null;
  }
}

// Para el registro con Google: se guarda antes de salir a Google y se aplica al volver
export function savePendingProfile(info) {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify({ ...info, savedAt: Date.now() })); } catch {}
}

export function takePendingProfile() {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    localStorage.removeItem(PENDING_KEY);
    const info = JSON.parse(raw);
    return Date.now() - (info.savedAt || 0) < 3600 * 1000 ? info : null;
  } catch {
    return null;
  }
}
