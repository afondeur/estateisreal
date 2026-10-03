// Tasa del dólar (unidades de moneda local por 1 USD) con dos fuentes:
// la principal se usa y la alterna la verifica o la sustituye si la principal falla.
// Se informa siempre qué fuente se usó; si ambas fallan, no se inventa un valor.

const SOURCES = [
  {
    name: "open.er-api.com",
    url: "https://open.er-api.com/v6/latest/USD",
    read: (d, code) => (d?.result === "success" ? d.rates?.[code] : null),
  },
  {
    name: "fawazahmed0/currency-api",
    url: "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json",
    read: (d, code) => d?.usd?.[code.toLowerCase()],
  },
];

const CACHE_MS = 6 * 3600 * 1000;
const cache = new Map(); // code -> { at, value }

async function fetchRate(source, code) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(source.url, { signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) return null;
    const rate = Number(source.read(await res.json(), code));
    return Number.isFinite(rate) && rate > 0 ? rate : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Devuelve { rate, source, alternateRate, discrepancyPct } o null si ninguna fuente responde.
export async function getUsdRate(code) {
  if (!code || code === "USD") return { rate: 1, source: "fija", alternateRate: null, discrepancyPct: null };

  const hit = cache.get(code);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

  const [primary, alternate] = await Promise.all(SOURCES.map(s => fetchRate(s, code)));
  let value = null;
  if (primary != null) {
    value = {
      rate: primary,
      source: SOURCES[0].name,
      alternateRate: alternate,
      discrepancyPct: alternate != null ? Math.abs(primary - alternate) / alternate * 100 : null,
    };
  } else if (alternate != null) {
    value = { rate: alternate, source: SOURCES[1].name, alternateRate: null, discrepancyPct: null };
  }

  if (value) cache.set(code, { at: Date.now(), value });
  return value;
}
