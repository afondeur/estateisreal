"use client";
import { useMemo, useState } from "react";

// ═══════════════════════════════════════════════
// Panel de decisión (acta AI Board 2026-10-02): responde cada semana
// "¿vamos hacia 10 pagos al 31-ene-2027?" y "¿a quién contacto?".
// ═══════════════════════════════════════════════

const META_PAGOS = 10;
const FECHA_META = new Date("2027-01-31T23:59:59-04:00");
const INTERNAL_DOMAINS = ["merafondeur.com"]; // cuentas propias: no cuentan como clientes
const DAY = 24 * 3600 * 1000;

const ROL_LABEL = {
  desarrollador: "Desarrollador", inversionista: "Inversionista", constructor: "Constructor",
  corredor: "Corredor", banco_tasador: "Banco / tasador", estudiante: "Estudiante", otro: "Otro",
};
const ORIGEN_LABEL = {
  diplomado: "Diplomado", recomendacion: "Recomendación", redes: "Redes sociales",
  google: "Google", evento: "Evento", otro: "Otro",
};

const isInternal = (p) => p.is_admin || INTERNAL_DOMAINS.some(d => (p.email || "").toLowerCase().endsWith("@" + d));
const monthKey = (d) => d.slice(0, 7);
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
const fmtN = (n) => (n == null ? "—" : Math.round(n).toLocaleString("en-US"));
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const fmtMes = (k) => `${MESES[Number(k.slice(5, 7)) - 1]} ${k.slice(2, 4)}`;
const fmtFecha = (ms) => new Date(ms).toLocaleDateString("es-DO", { day: "numeric", month: "short" });
const haceDias = (ms) => {
  const d = Math.floor((Date.now() - ms) / DAY);
  return d <= 0 ? "hoy" : d === 1 ? "ayer" : `hace ${d} días`;
};

function quantile(sorted, q) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function Card({ title, subtitle, children }) {
  return (
    <section className="bg-slate-700 rounded-2xl border border-slate-600 p-5">
      <h2 className="text-base font-bold text-slate-100">{title}</h2>
      {subtitle && <p className="text-xs text-slate-400 mt-0.5 mb-3">{subtitle}</p>}
      {children}
    </section>
  );
}

function Kpi({ label, value, sub, tone = "neutral", progress }) {
  const tones = {
    accent: "border-blue-500 bg-blue-950/40 text-blue-200",
    warn: "border-amber-500 bg-amber-950/30 text-amber-200",
    neutral: "border-slate-600 bg-slate-800 text-slate-100",
  };
  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <p className="text-xs opacity-80">{label}</p>
      <p className="text-2xl font-bold mt-0.5">{value}</p>
      {progress != null && (
        <div className="h-1.5 bg-slate-900/60 rounded mt-2">
          <div className="h-1.5 bg-blue-400 rounded" style={{ width: `${Math.max(2, Math.min(100, progress))}%` }} />
        </div>
      )}
      {sub && <p className="text-xs opacity-70 mt-1">{sub}</p>}
    </div>
  );
}

// Rango P25–P75 con punto en la mediana, eje común (Tufte: mostrar distribución, no promedio)
function RangeChart({ rows, field, unit }) {
  const vals = rows.flatMap(r => [r[field].p25, r[field].p75]);
  if (!vals.length) return null;
  const min = Math.floor(Math.min(...vals) / 100) * 100;
  const max = Math.ceil(Math.max(...vals) / 100) * 100 || min + 100;
  const L = 130, R = 520, W = 600, rowH = 30;
  const x = (v) => L + ((v - min) / (max - min || 1)) * (R - L);
  const H = rows.length * rowH + 26;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Rango de ${unit} por ciudad`}>
      {rows.map((r, i) => {
        const y = 16 + i * rowH;
        const s = r[field];
        return (
          <g key={r.ciudad}>
            <text x="0" y={y + 4} fontSize="12" fill="#cbd5e1">{r.ciudad} <tspan fill="#64748b">({r.n})</tspan></text>
            <line x1={x(s.p25)} y1={y} x2={x(s.p75)} y2={y} stroke="#60a5fa" strokeWidth="5" strokeLinecap="round" />
            <circle cx={x(s.median)} cy={y} r="5.5" fill="#f8fafc" />
            <text x={x(s.p75) + 10} y={y + 4} fontSize="11" fill="#94a3b8">mediana {fmtN(s.median)}</text>
          </g>
        );
      })}
      <line x1={L} y1={H - 18} x2={R} y2={H - 18} stroke="#475569" />
      <text x={L} y={H - 4} fontSize="11" fill="#94a3b8" textAnchor="middle">{fmtN(min)}</text>
      <text x={(L + R) / 2} y={H - 4} fontSize="11" fill="#94a3b8" textAnchor="middle">{fmtN((min + max) / 2)}</text>
      <text x={R} y={H - 4} fontSize="11" fill="#94a3b8" textAnchor="middle">{fmtN(max)}</text>
    </svg>
  );
}

function MiniBars({ items, total }) {
  const max = Math.max(1, ...items.map(i => i.n));
  return (
    <div className="space-y-1.5">
      {items.map(i => (
        <div key={i.label} className="grid grid-cols-[120px_1fr_40px] items-center gap-2 text-xs">
          <span className="text-slate-300 truncate">{i.label}</span>
          <div className="h-2.5 bg-slate-800 rounded"><div className={`h-2.5 rounded ${i.muted ? "bg-slate-500" : "bg-blue-400"}`} style={{ width: `${(i.n / max) * 100}%` }} /></div>
          <span className="text-right text-slate-400">{i.n}</span>
        </div>
      ))}
      {total != null && <p className="text-xs text-slate-500 pt-1">{total}</p>}
    </div>
  );
}

export default function DecisionPanel({ profiles, events, market }) {
  const [copied, setCopied] = useState(null);

  const d = useMemo(() => {
    const now = Date.now();
    const users = profiles.filter(p => !isInternal(p));
    const internalIds = new Set(profiles.filter(isInternal).map(p => p.id));
    const ev = events.filter(e => e.user_id && !internalIds.has(e.user_id));

    // Eventos por usuario
    const byUser = new Map();
    for (const e of ev) {
      const t = new Date(e.created_at).getTime();
      let u = byUser.get(e.user_id);
      if (!u) { u = { analisis: 0, meses: new Set(), last: 0, interes: 0, limite: 0 }; byUser.set(e.user_id, u); }
      u.last = Math.max(u.last, t);
      if (e.event_type === "analisis_generado") { u.analisis++; u.meses.add(monthKey(e.created_at)); }
      if (e.event_type === "interes_pro") u.interes = Math.max(u.interes, t);
      if (e.event_type === "limite_alcanzado") u.limite = Math.max(u.limite, t);
    }

    // KPIs
    const pagos = users.filter(p => p.pro_source === "stripe" || p.stripe_subscription_id).length;
    const diasMeta = Math.max(0, Math.ceil((FECHA_META - now) / DAY));
    const weekAgo = now - 7 * DAY;
    const evSemana = ev.filter(e => new Date(e.created_at).getTime() > weekAgo);
    const activosSemana = new Set(evSemana.map(e => e.user_id)).size;
    const analisisSemana = evSemana.filter(e => e.event_type === "analisis_generado").length;
    const promoActivos = users.filter(p => p.pro_source?.startsWith("promo:") && p.pro_until && new Date(p.pro_until).getTime() > now);
    const proxVence = promoActivos.length ? Math.min(...promoActivos.map(p => new Date(p.pro_until).getTime())) : null;

    // Embudo
    const activados = users.filter(p => (byUser.get(p.id)?.analisis || 0) > 0).length;
    const volvieron = users.filter(p => (byUser.get(p.id)?.meses.size || 0) >= 2).length;
    const interesados = users.filter(p => byUser.get(p.id)?.interes).length;
    const funnel = [
      { label: "Registrados", n: users.length },
      { label: "Primer análisis", n: activados },
      { label: "Volvió otro mes", n: volvieron },
      { label: "Interés en Pro", n: interesados },
      { label: "Pagó", n: pagos },
    ];

    // Cohortes por mes de registro
    const cohortMap = new Map();
    for (const p of users) {
      const k = monthKey(p.created_at);
      let c = cohortMap.get(k);
      if (!c) { c = { k, reg: 0, act: 0, ret: 0, origen: {} }; cohortMap.set(k, c); }
      c.reg++;
      const u = byUser.get(p.id);
      if (u?.analisis) c.act++;
      if (u && u.meses.size >= 2) c.ret++;
      if (p.origen) c.origen[p.origen] = (c.origen[p.origen] || 0) + 1;
    }
    const cohorts = [...cohortMap.values()].sort((a, b) => a.k.localeCompare(b.k)).map(c => {
      const top = Object.entries(c.origen).sort((a, b) => b[1] - a[1])[0];
      return { ...c, topOrigen: top ? ORIGEN_LABEL[top[0]] || top[0] : null };
    });

    // Actividad semanal (12 semanas, lunes a domingo)
    const monday = new Date(); monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const weeks = [];
    for (let i = 11; i >= 0; i--) {
      const start = monday.getTime() - i * 7 * DAY;
      const inWeek = ev.filter(e => { const t = new Date(e.created_at).getTime(); return t >= start && t < start + 7 * DAY; });
      weeks.push({ start, users: new Set(inWeek.map(e => e.user_id)).size, analisis: inWeek.filter(e => e.event_type === "analisis_generado").length });
    }

    // Prospectos: señales ordenadas por fuerza
    const prospects = [];
    for (const p of users) {
      const u = byUser.get(p.id);
      const signals = [];
      if (u?.interes && now - u.interes < 60 * DAY) signals.push({ key: "interes", label: "pidió Pro", tone: "bg-emerald-900/60 text-emerald-200 border-emerald-600" });
      if (u?.limite && now - u.limite < 60 * DAY) signals.push({ key: "limite", label: "agotó 5 de 5", tone: "bg-amber-900/60 text-amber-200 border-amber-600" });
      const venceMs = p.pro_source?.startsWith("promo:") && p.pro_until ? new Date(p.pro_until).getTime() : null;
      if (venceMs && venceMs > now && venceMs - now < 45 * DAY) signals.push({ key: "promo", label: `promo vence ${fmtFecha(venceMs)}`, tone: "bg-blue-900/60 text-blue-200 border-blue-600" });
      if ((u?.analisis || 0) >= 10 && u.last && now - u.last < 30 * DAY) signals.push({ key: "intensivo", label: "usuario intensivo", tone: "bg-slate-800 text-slate-200 border-slate-500" });
      if (!signals.length) continue;
      const score = signals.reduce((s, x) => s + ({ interes: 100, limite: 60, promo: 30, intensivo: 20 }[x.key]), 0);
      prospects.push({ p, u, signals, score });
    }
    prospects.sort((a, b) => b.score - a.score || (b.u?.last || 0) - (a.u?.last || 0));

    // Perfil de usuarios (rol / origen)
    const dist = (field, labels) => {
      const counts = {};
      let sinDato = 0;
      for (const p of users) { if (p[field]) counts[p[field]] = (counts[p[field]] || 0) + 1; else sinDato++; }
      const items = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ label: labels[k] || k, n }));
      return { items, sinDato };
    };

    // Benchmarks en USD, un registro por proyecto, solo ciudades con n ≥ 5
    const latest = new Map();
    let sinTasa = 0;
    for (const m of market) {
      const rate = m.moneda === "DOP" ? Number(m.tasa_usd) : 1;
      if (!(rate > 0)) { sinTasa++; continue; }
      const key = m.proyecto_uid || `${m.ciudad}|${m.area_terreno}|${m.precio_terreno}|${m.unidades_total}`;
      const prev = latest.get(key);
      if (!prev || new Date(m.created_at) > new Date(prev.created_at)) latest.set(key, { ...m, rate });
    }
    const byCity = new Map();
    for (const m of latest.values()) {
      if (!m.ciudad) continue;
      const c = byCity.get(m.ciudad) || { costo: [], venta: [], margen: [] };
      if (m.costo_construccion_m2 > 0) c.costo.push(m.costo_construccion_m2 / m.rate);
      if (m.precio_venta_m2_promedio > 0) c.venta.push(m.precio_venta_m2_promedio / m.rate);
      if (m.margen_pct != null) c.margen.push(Number(m.margen_pct));
      byCity.set(m.ciudad, c);
    }
    const stats = (arr) => { const s = [...arr].sort((a, b) => a - b); return { p25: quantile(s, 0.25), median: quantile(s, 0.5), p75: quantile(s, 0.75) }; };
    const bench = [...byCity.entries()]
      .map(([ciudad, c]) => ({ ciudad, n: c.costo.length, costo: stats(c.costo), venta: stats(c.venta), margen: stats(c.margen).median }))
      .filter(r => r.n >= 5)
      .sort((a, b) => b.n - a.n);
    const conUid = [...latest.values()].filter(m => m.proyecto_uid).length;

    return {
      pagos, diasMeta, activosSemana, analisisSemana, promoActivos: promoActivos.length, proxVence,
      funnel, cohorts, weeks, prospects, bench, sinTasa, conUid,
      totalProyectos: latest.size, rol: dist("rol", ROL_LABEL), origen: dist("origen", ORIGEN_LABEL),
      calientes: prospects.filter(x => x.signals.some(s => s.key === "interes" || s.key === "limite")).length,
    };
  }, [profiles, events, market]);

  const copy = async (email) => {
    try { await navigator.clipboard.writeText(email); setCopied(email); setTimeout(() => setCopied(null), 1500); } catch {}
  };

  const maxWeek = Math.max(1, ...d.weeks.map(w => w.users));
  const regTotal = d.funnel[0].n || 1;
  const fuga = 100 - pct(d.funnel[1].n, d.funnel[0].n);

  return (
    <div className="space-y-5">
      {/* KPIs: la meta primero (Munger: no abrir con métricas de vanidad) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi tone="accent" label="Pagos externos · meta 31 ene 2027" value={`${d.pagos} de ${META_PAGOS}`}
          progress={(d.pagos / META_PAGOS) * 100} sub={`Quedan ${d.diasMeta} días`} />
        <Kpi label="Prospectos calientes" value={d.calientes} sub="Pidieron Pro o agotaron el límite (60 días)" />
        <Kpi label="Activos esta semana" value={d.activosSemana} sub={`${d.analisisSemana} análisis en 7 días`} />
        <Kpi tone="warn" label="Pro promocional activos" value={d.promoActivos}
          sub={d.proxVence ? `Próximo vencimiento: ${fmtFecha(d.proxVence)}` : "Sin vencimientos próximos"} />
      </div>

      {/* Embudo */}
      <Card title={`El ${fuga} % se registra y nunca analiza: la fuga está en el primer paso`}
        subtitle="Embudo acumulado desde el lanzamiento · sin cuentas propias">
        <div className="space-y-2">
          {d.funnel.map((f, i) => (
            <div key={f.label} className="grid grid-cols-[130px_1fr_90px] items-center gap-3 text-sm">
              <span className={i === 1 ? "text-amber-300" : "text-slate-300"}>{f.label}</span>
              <div className="h-4 bg-slate-800 rounded">
                <div className={`h-4 rounded ${f.n ? "bg-blue-400" : "bg-slate-600"}`} style={{ width: `${Math.max(1, (f.n / regTotal) * 100)}%`, opacity: i >= 2 ? 0.75 : 1 }} />
              </div>
              <span className="text-right text-slate-200">{f.n}{i > 0 && <span className="text-slate-500"> · {pct(f.n, regTotal)} %</span>}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Cohortes */}
        <Card title="Activación por mes de registro" subtitle="Barra = % que hizo su primer análisis · Volvió = usó la app en 2 meses o más">
          <table className="w-full text-xs">
            <thead><tr className="text-slate-400"><th className="text-left font-normal pb-1">Cohorte</th><th className="text-right font-normal">Reg.</th><th className="text-left font-normal pl-3">Activación</th><th className="text-right font-normal">Volvió</th><th className="text-left font-normal pl-3">Origen principal</th></tr></thead>
            <tbody>
              {d.cohorts.map(c => {
                const a = pct(c.act, c.reg);
                return (
                  <tr key={c.k} className="border-t border-slate-600/60">
                    <td className="py-1.5 text-slate-200">{fmtMes(c.k)}</td>
                    <td className="text-right text-slate-300">{c.reg}</td>
                    <td className="pl-3"><div className="flex items-center gap-2"><div className="h-2 w-20 bg-slate-800 rounded"><div className="h-2 bg-blue-400 rounded" style={{ width: `${a}%` }} /></div><span className="text-slate-300">{a} %</span></div></td>
                    <td className="text-right text-slate-300">{c.ret}</td>
                    <td className="pl-3 text-slate-400">{c.topOrigen || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        {/* Actividad semanal */}
        <Card title="Usuarios activos por semana" subtitle="Últimas 12 semanas · cualquier actividad en la app">
          <div className="flex items-end gap-1.5 h-32 pt-4">
            {d.weeks.map((w, i) => (
              <div key={w.start} className="flex-1 flex flex-col items-center justify-end h-full" title={`${fmtFecha(w.start)}: ${w.users} usuarios, ${w.analisis} análisis`}>
                <span className="text-[11px] text-slate-400 mb-0.5">{w.users || ""}</span>
                <div className={`w-full rounded-t ${i === d.weeks.length - 1 ? "bg-blue-400" : "bg-slate-500"}`} style={{ height: `${Math.max(2, (w.users / maxWeek) * 100)}%` }} />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[11px] text-slate-500 mt-1">
            <span>{fmtFecha(d.weeks[0].start)}</span><span>semana actual</span>
          </div>
        </Card>
      </div>

      {/* Prospectos */}
      <Card title="Prospectos para contactar esta semana" subtitle={`${d.prospects.length} con señal · ordenados por fuerza de la señal (pidió Pro > agotó límite > promo por vencer > uso intensivo)`}>
        {d.prospects.length === 0 ? (
          <p className="text-sm text-slate-400">Aún no hay señales. Aparecerán cuando alguien pida Pro, agote sus 5 análisis o se acerque el vencimiento de su promoción.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-slate-400"><th className="text-left font-normal pb-1">Usuario</th><th className="text-left font-normal">Rol</th><th className="text-left font-normal">Señal</th><th className="text-right font-normal">Análisis</th><th className="text-right font-normal">Última vez</th><th></th></tr></thead>
              <tbody>
                {d.prospects.slice(0, 30).map(({ p, u, signals }) => (
                  <tr key={p.id} className="border-t border-slate-600/60">
                    <td className="py-1.5 pr-2"><div className="text-slate-200">{p.nombre || "—"}</div><div className="text-slate-400">{p.email}</div></td>
                    <td className="text-slate-300 pr-2">{ROL_LABEL[p.rol] || "—"}</td>
                    <td className="pr-2"><div className="flex flex-wrap gap-1">{signals.map(s => <span key={s.key} className={`px-1.5 py-0.5 rounded border ${s.tone}`}>{s.label}</span>)}</div></td>
                    <td className="text-right text-slate-300">{u?.analisis || 0}</td>
                    <td className="text-right text-slate-400 whitespace-nowrap">{u?.last ? haceDias(u.last) : "—"}</td>
                    <td className="text-right pl-2"><button onClick={() => copy(p.email)} className="px-2 py-0.5 rounded bg-slate-600 hover:bg-slate-500 text-slate-100">{copied === p.email ? "Copiado" : "Copiar correo"}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Perfil */}
      <div className="grid lg:grid-cols-2 gap-5">
        <Card title="¿Quiénes son?" subtitle="Rol declarado al registrarse (opcional, desde oct 2026)">
          <MiniBars items={d.rol.items.length ? d.rol.items : [{ label: "Sin respuestas aún", n: 0, muted: true }]} total={`${d.rol.sinDato} usuarios sin dato (registrados antes o no contestaron)`} />
        </Card>
        <Card title="¿Cómo nos conocieron?" subtitle="Origen declarado al registrarse (opcional, desde oct 2026)">
          <MiniBars items={d.origen.items.length ? d.origen.items : [{ label: "Sin respuestas aún", n: 0, muted: true }]} total={`${d.origen.sinDato} usuarios sin dato`} />
        </Card>
      </div>

      {/* Benchmarks */}
      <Card title="Benchmarks de mercado en US$/m²" subtitle="Línea = rango P25–P75 · punto = mediana · un registro por proyecto · solo ciudades con 5 o más">
        {d.bench.length === 0 ? (
          <p className="text-sm text-slate-400">Aún no hay ciudades con 5 o más proyectos.</p>
        ) : (
          <div className="grid lg:grid-cols-2 gap-6">
            <div><p className="text-xs text-slate-300 mb-1">Costo de construcción</p><RangeChart rows={d.bench} field="costo" unit="costo por m²" /></div>
            <div><p className="text-xs text-slate-300 mb-1">Precio de venta</p><RangeChart rows={d.bench} field="venta" unit="venta por m²" /></div>
          </div>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-slate-400">
          {d.bench.map(r => <span key={r.ciudad}>{r.ciudad}: margen mediano {r.margen != null ? (r.margen * 100).toFixed(1) + " %" : "—"}</span>)}
        </div>
        <p className="text-xs text-amber-300/90 mt-2">
          {d.totalProyectos} proyectos ({d.conUid} con ID de proyecto). Los registros anteriores a oct 2026 no tienen ID: cada ajuste del mismo proyecto puede contar como uno distinto.
          {d.sinTasa > 0 && ` Se excluyen ${d.sinTasa} registros en RD$ sin tasa del día.`}
        </p>
      </Card>
    </div>
  );
}
