"use client";
import { useState, useMemo, useCallback, useRef } from "react";

// ═══════════════════════════════════════════════════════════
// HERRAMIENTA DE PREFACTIBILIDAD INMOBILIARIA v1.0
// © Alejandro J. Fondeur M. — Febrero 2026
// Motor de cálculo basado en T_PREFACTIBILIDAD_PRO.xlsx v4.2
// ═══════════════════════════════════════════════════════════

const DEFAULT_MIX = [
  { tipo: "Tipo 1", qty: 0, m2: 0, precioUd: 0 },
  { tipo: "Tipo 2", qty: 0, m2: 0, precioUd: 0 },
  { tipo: "Tipo 3", qty: 0, m2: 0, precioUd: 0 },
  { tipo: "Tipo 4", qty: 0, m2: 0, precioUd: 0 },
  { tipo: "Tipo 5", qty: 0, m2: 0, precioUd: 0 },
  { tipo: "Tipo 6", qty: 0, m2: 0, precioUd: 0 },
];

const DEFAULT_THRESHOLDS = {
  roiMin: 0.18, margenMin: 0.125, moicMin: 1.5, markupMin: 1.25,
  tirMin: 0.25, ltvMax: 0.55, ltcMax: 0.65
};

const DEFAULT_SUPUESTOS = {
  proyecto: "", ubicacion: "", fecha: "",
  areaTerreno: 0, precioTerreno: 0,
  costoM2: 0, softCosts: 0, devFee: 0, comisionVenta: 0, marketing: 0, contingencias: 0,
  pctFinanciamiento: 0, tasaInteres: 0, drawFactor: 0, comisionBanco: 0,
  mesesPredev: 0, mesesConstruccion: 0, mesesPostVenta: 0,
  preventaPct: 0, cobroPct: 0,
  equityCapital: 0,
  parqueosDisenados: 0, ratioResidente: 0, divisorVisita: 0, minUnidadesVisita: 0, pctDiscapacidad: 0,
};

const fmt = (n, dec = 0) => n == null || isNaN(n) ? "—" : n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
const fmtPct = (n, dec = 1) => n == null || isNaN(n) ? "—" : (n * 100).toFixed(dec) + "%";
const fmtUSD = (n) => n == null || isNaN(n) ? "—" : "$" + fmt(n);

function calcAll(sup, mix, thresholds) {
  // ─── INGRESOS ───
  const unidades = mix.reduce((s, u) => s + (u.qty || 0), 0);
  const m2Vendible = mix.reduce((s, u) => s + (u.qty || 0) * (u.m2 || 0), 0);
  const ingresoTotal = mix.reduce((s, u) => s + (u.qty || 0) * (u.precioUd || 0), 0);
  const precioPromM2 = m2Vendible > 0 ? ingresoTotal / m2Vendible : 0;
  const precioPromUd = unidades > 0 ? ingresoTotal / unidades : 0;

  // ─── TERRENO ───
  const precioTerreno = sup.precioTerreno || 0;
  const precioTerrenoM2 = sup.areaTerreno > 0 ? precioTerreno / sup.areaTerreno : 0;

  // ─── COSTOS DUROS ───
  const costoConstruccion = m2Vendible * sup.costoM2;

  // ─── COSTOS BLANDOS ───
  const costoSoft = ingresoTotal * sup.softCosts;
  const costoDevFee = ingresoTotal * sup.devFee;
  const costoComision = ingresoTotal * sup.comisionVenta;
  const costoMarketing = ingresoTotal * sup.marketing;
  const costoContingencias = costoConstruccion * sup.contingencias;

  // ─── COSTO TOTAL ANTES DE FINANCIAMIENTO ───
  const costoPreFinan = precioTerreno + costoConstruccion + costoSoft + costoDevFee + costoComision + costoMarketing + costoContingencias;

  // ─── EQUITY ───
  const equityTerreno = precioTerreno;
  const equityTotal = equityTerreno + sup.equityCapital;

  // ─── PREVENTAS ───
  const preventas = ingresoTotal * sup.preventaPct * sup.cobroPct;

  // ─── PLUG DE FINANCIAMIENTO ───
  const denominator = 1 - sup.tasaInteres * sup.drawFactor * (sup.mesesConstruccion / 12) - sup.comisionBanco;
  const necesidadFinanciamiento = costoPreFinan - equityTotal - preventas;
  const prestamo = denominator !== 0 ? Math.max(0, necesidadFinanciamiento / denominator) : 0;

  // ─── COSTO FINANCIERO ───
  const intereses = prestamo * sup.tasaInteres * sup.drawFactor * (sup.mesesConstruccion / 12);
  const comisionBancaria = prestamo * sup.comisionBanco;
  const costoFinanciero = intereses + comisionBancaria;

  // ─── TOTALES ───
  const costoTotal = costoPreFinan + costoFinanciero;
  const utilidadNeta = ingresoTotal - costoTotal;
  const mesesTotal = sup.mesesPredev + sup.mesesConstruccion + sup.mesesPostVenta;

  // ─── 7 MÉTRICAS ───
  // NOTA: En real estate, ROI/Markup/LTC usan costo del proyecto SIN financiamiento
  // porque el financiamiento depende de la estructura de capital, no del proyecto
  const roi = costoPreFinan > 0 ? utilidadNeta / costoPreFinan : 0;
  const moic = equityTotal > 0 ? (utilidadNeta + equityTotal) / equityTotal : 0;
  const markup = costoPreFinan > 0 ? ingresoTotal / costoPreFinan : 0;
  const margen = ingresoTotal > 0 ? utilidadNeta / ingresoTotal : 0;
  const tir = equityTotal > 0 && mesesTotal > 0 ? Math.pow(1 + utilidadNeta / equityTotal, 12 / mesesTotal) - 1 : 0;
  const ltv = ingresoTotal > 0 ? prestamo / ingresoTotal : 0;
  const ltc = costoPreFinan > 0 ? prestamo / costoPreFinan : 0;

  // ─── MÉTRICAS URBANÍSTICAS ───
  const densidad = sup.areaTerreno > 0 ? unidades / (sup.areaTerreno / 10000) : 0;
  const far = sup.areaTerreno > 0 ? m2Vendible / sup.areaTerreno : 0;
  const costoM2Total = m2Vendible > 0 ? costoTotal / m2Vendible : 0;

  // ─── SEMÁFORO GO/NO-GO ───
  const checks = [
    { nombre: "ROI", valor: roi, umbral: thresholds.roiMin, tipo: "min" },
    { nombre: "Margen", valor: margen, umbral: thresholds.margenMin, tipo: "min" },
    { nombre: "MOIC", valor: moic, umbral: thresholds.moicMin, tipo: "min" },
    { nombre: "Incremento", valor: markup, umbral: thresholds.markupMin, tipo: "min" },
    { nombre: "TIR", valor: tir, umbral: thresholds.tirMin, tipo: "min" },
    { nombre: "LTV", valor: ltv, umbral: thresholds.ltvMax, tipo: "max" },
    { nombre: "LTC", valor: ltc, umbral: thresholds.ltcMax, tipo: "max" },
  ];
  const cumple = checks.filter(c => c.tipo === "max" ? c.valor <= c.umbral : c.valor >= c.umbral).length;
  const noCumple = checks.filter(c => c.tipo === "max" ? c.valor > c.umbral * 1.15 : c.valor < c.umbral * 0.75).length;
  let decision = "PRECAUCIÓN";
  let decisionColor = "#F59E0B";
  if (cumple === 7) { decision = "VIABLE"; decisionColor = "#10B981"; }
  else if (noCumple >= 4) { decision = "NO VIABLE"; decisionColor = "#EF4444"; }

  // ─── PARQUEOS ───
  const pResidente = Math.ceil(unidades * sup.ratioResidente);
  const pVisita = unidades > sup.minUnidadesVisita ? Math.floor(unidades / sup.divisorVisita) : 0;
  const pDiscapacidad = Math.max(1, Math.ceil(pResidente * sup.pctDiscapacidad));
  const pRequeridos = pResidente + pVisita + pDiscapacidad;
  const pCumple = sup.parqueosDisenados >= pRequeridos;

  return {
    unidades, m2Vendible, ingresoTotal, precioPromM2, precioPromUd,
    precioTerreno, precioTerrenoM2, costoConstruccion, costoSoft, costoDevFee, costoComision, costoMarketing, costoContingencias,
    costoPreFinan, equityTerreno, equityTotal, preventas, prestamo, intereses, comisionBancaria, costoFinanciero,
    costoTotal, utilidadNeta, mesesTotal,
    roi, moic, markup, margen, tir, ltv, ltc,
    densidad, far, costoM2Total,
    checks, cumple, decision, decisionColor,
    pResidente, pVisita, pDiscapacidad, pRequeridos, pCumple,
  };
}

function calcSensitivity(sup, mix, thresholds, metricKey, varRow, varCol, baseRow, baseCol, pctVar = 0.05) {
  const steps = [-2, -1, 0, 1, 2];
  const grid = [];
  for (const rStep of steps) {
    const row = [];
    for (const cStep of steps) {
      const newSup = { ...sup };
      const newMix = mix.map(u => ({ ...u }));
      const rMult = 1 + rStep * pctVar;
      const cMult = 1 + cStep * pctVar;
      const applyVar = (varName, mult, s, m) => {
        if (varName === "costoM2") s.costoM2 = sup.costoM2 * mult;
        if (varName === "precioVenta") m.forEach(u => { u.precioUd = u.precioUd * mult; });
        if (varName === "ingresoTotal") m.forEach(u => { u.precioUd = u.precioUd * mult; });
        if (varName === "tasaInteres") s.tasaInteres = sup.tasaInteres * mult;
        if (varName === "pctFinanciamiento") s.pctFinanciamiento = sup.pctFinanciamiento * mult;
        if (varName === "equityCapital") s.equityCapital = sup.equityCapital * mult;
        if (varName === "mesesConstruccion") s.mesesConstruccion = Math.round(sup.mesesConstruccion * mult);
        if (varName === "preventaPct") s.preventaPct = sup.preventaPct * mult;
      };
      applyVar(varRow, rMult, newSup, newMix);
      applyVar(varCol, cMult, newSup, newMix);
      const r = calcAll(newSup, newMix, thresholds);
      row.push(r[metricKey]);
    }
    grid.push(row);
  }
  return { grid, steps, pctVar };
}

// ═══════════════════════════════════════════════
// UI COMPONENTS
// ═══════════════════════════════════════════════

function InputField({ label, value, onChange, type = "number", step, suffix, prefix, min, max, small }) {
  return (
    <div className={`flex flex-col ${small ? "gap-0.5" : "gap-1"}`}>
      <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</label>
      <div className="flex items-center gap-1">
        {prefix && <span className="text-sm text-slate-400">{prefix}</span>}
        <input
          type={type}
          value={value}
          onChange={e => onChange(type === "number" ? parseFloat(e.target.value) || 0 : e.target.value)}
          step={step}
          min={min}
          max={max}
          className="w-full px-2 py-1.5 bg-blue-50 border border-blue-200 rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
        />
        {suffix && <span className="text-sm text-slate-400 whitespace-nowrap">{suffix}</span>}
      </div>
    </div>
  );
}

// Campo para montos grandes: muestra con comas (1,334,541) pero edita como número crudo
function MoneyInput({ label, value, onChange, prefix = "$", step = 100 }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState("");
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</label>
      <div className="flex items-center gap-1">
        {prefix && <span className="text-sm text-slate-400">{prefix}</span>}
        {editing ? (
          <input
            type="number"
            autoFocus
            value={raw}
            onChange={e => { setRaw(e.target.value); onChange(parseFloat(e.target.value) || 0); }}
            onBlur={() => setEditing(false)}
            step={step}
            className="w-full px-2 py-1.5 bg-blue-50 border border-blue-200 rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
          />
        ) : (
          <div
            onClick={() => { setRaw(String(value)); setEditing(true); }}
            className="w-full px-2 py-1.5 bg-blue-50 border border-blue-200 rounded text-sm font-mono cursor-text hover:border-blue-400"
          >
            {fmt(value)}
          </div>
        )}
      </div>
    </div>
  );
}

// Campo inline para tabla: muestra con comas, edita crudo
function InlineMoney({ value, onChange, step = 1000, min = 0 }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState("");
  if (editing) return (
    <input type="number" autoFocus value={raw}
      onChange={e => { setRaw(e.target.value); onChange(parseFloat(e.target.value) || 0); }}
      onBlur={() => setEditing(false)} step={step} min={min}
      className="w-full px-1 py-0.5 text-center text-sm bg-blue-50 border border-blue-200 rounded font-mono focus:outline-none focus:ring-2 focus:ring-blue-400" />
  );
  return (
    <div onClick={() => { setRaw(String(value)); setEditing(true); }}
      className="w-full px-1 py-0.5 text-center text-sm bg-blue-50 border border-blue-200 rounded font-mono cursor-text hover:border-blue-400">
      {fmt(value)}
    </div>
  );
}

// Campo especial para porcentajes: muestra 75 pero guarda 0.75 internamente
function PctField({ label, value, onChange, step = 0.5, min = 0, max = 100 }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</label>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={Math.round(value * 10000) / 100}
          onChange={e => onChange((parseFloat(e.target.value) || 0) / 100)}
          step={step}
          min={min}
          max={max}
          className="w-full px-2 py-1.5 bg-blue-50 border border-blue-200 rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
        />
        <span className="text-sm text-slate-400">%</span>
      </div>
    </div>
  );
}

function MetricCard({ label, value, format, threshold, type, highlight, desc }) {
  let display = value;
  if (format === "pct") display = fmtPct(value);
  else if (format === "x") display = value?.toFixed(2) + "x";
  else if (format === "usd") display = fmtUSD(value);
  else if (format === "num") display = fmt(value, 1);

  let status = null;
  let threshLabel = null;
  if (threshold != null) {
    const pass = type === "max" ? value <= threshold : value >= threshold;
    const marginal = type === "max" ? value <= threshold * 1.15 : value >= threshold * 0.75;
    status = pass ? "CUMPLE" : marginal ? "MARGINAL" : "NO CUMPLE";
    threshLabel = type === "max"
      ? "Máx: " + (format === "pct" || format === "x" ? fmtPct(threshold) : threshold)
      : "Mín: " + (format === "pct" ? fmtPct(threshold) : format === "x" ? threshold + "x" : threshold);
  }

  const statusColors = {
    "CUMPLE": "bg-emerald-100 text-emerald-700 border-emerald-300",
    "MARGINAL": "bg-amber-100 text-amber-700 border-amber-300",
    "NO CUMPLE": "bg-red-100 text-red-700 border-red-300"
  };

  return (
    <div className={`rounded-lg border p-3 ${highlight ? "bg-white shadow-md border-slate-200" : "bg-slate-50 border-slate-100"}`}>
      <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">{label}</div>
      <div className="text-xl font-bold text-slate-800">{display}</div>
      {desc && <div className="text-xs text-slate-400 mt-0.5">{desc}</div>}
      {status && (
        <div className="flex items-center gap-2 mt-1">
          <span className={`inline-block px-2 py-0.5 text-xs font-bold rounded border ${statusColors[status]}`}>
            {status}
          </span>
          {threshLabel && <span className="text-xs text-slate-400">{threshLabel}</span>}
        </div>
      )}
    </div>
  );
}

function SensTable({ title, data, rowLabel, colLabel, format, pctVar, metric, threshold, invertColor, baseRowVal, baseColVal, fmtBase }) {
  const steps = data.steps;
  const fmtCell = (v) => format === "pct" ? fmtPct(v) : v?.toFixed(2) + "x";
  const cellColor = (v) => {
    if (invertColor) {
      if (threshold) return v <= threshold ? "bg-emerald-50 text-emerald-700" : v <= threshold * 1.15 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700";
      return v < 0.5 ? "bg-emerald-50 text-emerald-700" : v < 0.65 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700";
    }
    if (threshold) return v >= threshold ? "bg-emerald-50 text-emerald-700" : v >= threshold * 0.75 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700";
    if (format === "pct") return v > 0.15 ? "bg-emerald-50 text-emerald-700" : v > 0.08 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700";
    return v > 1.3 ? "bg-emerald-50 text-emerald-700" : v > 1.1 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700";
  };
  const fmtB = fmtBase || ((v) => "$" + fmt(v));
  const colLbl = (s) => {
    const pctStr = s === 0 ? "" : (s > 0 ? " (+" : " (") + (s * pctVar * 100).toFixed(0) + "%)";
    if (baseColVal != null) {
      const val = baseColVal * (1 + s * pctVar);
      return s === 0 ? fmtB(val) + " (Base)" : fmtB(val) + pctStr;
    }
    return s === 0 ? "Base" : (s > 0 ? "+" : "") + (s * pctVar * 100).toFixed(0) + "%";
  };
  const rowLbl = (s) => {
    const pctStr = s === 0 ? "" : (s > 0 ? " (+" : " (") + (s * pctVar * 100).toFixed(0) + "%)";
    if (baseRowVal != null) {
      const val = baseRowVal * (1 + s * pctVar);
      return s === 0 ? fmtB(val) + " (Base)" : fmtB(val) + pctStr;
    }
    return s === 0 ? "Base" : (s > 0 ? "+" : "") + (s * pctVar * 100).toFixed(0) + "%";
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <h4 className="text-sm font-bold text-slate-700 mb-3">{title}</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="p-1.5 text-left bg-slate-100 rounded-tl text-slate-500">{rowLabel} ↓ \ {colLabel} →</th>
              {steps.map(s => (
                <th key={s} className={`p-1.5 text-center ${s === 0 ? "bg-blue-100 font-bold" : "bg-slate-100"}`}>
                  {colLbl(s)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.grid.map((row, ri) => (
              <tr key={ri}>
                <td className={`p-1.5 font-medium ${ri === 2 ? "bg-blue-100 font-bold" : "bg-slate-50"} text-slate-600`}>
                  {rowLbl(steps[ri])}
                </td>
                {row.map((v, ci) => (
                  <td key={ci} className={`p-1.5 text-center font-mono ${ri === 2 && ci === 2 ? "font-bold ring-2 ring-blue-400 rounded" : ""} ${cellColor(v)}`}>
                    {fmtCell(v)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════

export default function PrefactibilidadApp() {
  const [sup, setSup] = useState(DEFAULT_SUPUESTOS);
  const [mix, setMix] = useState(DEFAULT_MIX);
  const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS);
  const [tab, setTab] = useState("supuestos");
  const [pctVar, setPctVar] = useState(0.05); // Factor de variación para sensibilidad (5%)

  const updateSup = useCallback((key, val) => setSup(prev => ({ ...prev, [key]: val })), []);
  const updateMix = useCallback((idx, key, val) => setMix(prev => prev.map((u, i) => i === idx ? { ...u, [key]: val } : u)), []);
  const updateThresh = useCallback((key, val) => setThresholds(prev => ({ ...prev, [key]: val })), []);

  const r = useMemo(() => calcAll(sup, mix, thresholds), [sup, mix, thresholds]);

  // 7 tablas de sensibilidad como en el Excel
  const sensMargen = useMemo(() => calcSensitivity(sup, mix, thresholds, "margen", "costoM2", "precioVenta", 0, 0, pctVar), [sup, mix, thresholds, pctVar]);
  const sensRoi = useMemo(() => calcSensitivity(sup, mix, thresholds, "roi", "costoM2", "precioVenta", 0, 0, pctVar), [sup, mix, thresholds, pctVar]);
  // ─── TABLAS 3-6: Fórmulas simplificadas del Excel ───
  // El Excel usa fórmulas simplificadas que escalan costos desde el caso base,
  // NO recalcula todo el modelo. Esto replica la lógica exacta del TABLERO.
  const sensTirTasaDuracion = useMemo(() => {
    // Tabla 3: TIR vs Tasa × Duración — Excel: tasa ±2%/±4%, meses × [0.5,0.75,1,1.25,1.5]
    const rates = [
      Math.max(0.05, sup.tasaInteres - 0.04),
      Math.max(0.05, sup.tasaInteres - 0.02),
      sup.tasaInteres,
      Math.min(0.25, sup.tasaInteres + 0.02),
      Math.min(0.25, sup.tasaInteres + 0.04),
    ];
    const durations = [
      Math.max(3, Math.round(sup.mesesConstruccion * 0.5)),
      Math.max(3, Math.round(sup.mesesConstruccion * 0.75)),
      sup.mesesConstruccion,
      Math.round(sup.mesesConstruccion * 1.25),
      Math.round(sup.mesesConstruccion * 1.5),
    ];
    // Excel: TIR = (1 + (utilBruta - prestamo*newTasa*drawFactor*(newMeses/12) - prestamo*comBanco) / equityTotal) ^ (12/(predev+newMeses+postventa)) - 1
    const utilBruta = r.ingresoTotal - r.costoPreFinan;
    const grid = rates.map(rate => durations.map(dur => {
      const interes = r.prestamo * rate * sup.drawFactor * (dur / 12);
      const comBanco = r.prestamo * sup.comisionBanco;
      const utilNeta = utilBruta - interes - comBanco;
      const durTotal = sup.mesesPredev + dur + sup.mesesPostVenta;
      return r.equityTotal > 0 && durTotal > 0
        ? Math.pow(1 + utilNeta / r.equityTotal, 12 / durTotal) - 1 : 0;
    }));
    return {
      grid,
      rowLabels: rates.map((rt, i) => i === 2 ? (rt*100).toFixed(1)+"% (Base)" : (rt*100).toFixed(1)+"%"),
      colLabels: durations.map((d, i) => i === 2 ? d+" (Base)" : d+"m"),
    };
  }, [sup, r]);
  const sensMargenPreventas = useMemo(() => {
    // Tabla 4: Margen vs Costo × Preventas — Excel: costo ±5%/±10%, preventas absolutas
    const costSteps = [-2, -1, 0, 1, 2];
    const preventas = [
      Math.max(0.10, sup.preventaPct - 0.30),
      Math.max(0.15, sup.preventaPct - 0.15),
      sup.preventaPct,
      Math.min(0.95, sup.preventaPct + 0.10),
      Math.min(0.95, sup.preventaPct + 0.20),
    ];
    // Excel: margen = (ingreso - costoPreFinan*(1+costDelta) - costoFinanciero*(1-newPrev)/(1-basePrev)) / ingreso
    const basePrev = sup.preventaPct;
    const grid = costSteps.map(cs => preventas.map(pv => {
      const costDelta = cs * pctVar;
      const newCostoPreFinan = r.costoPreFinan * (1 + costDelta);
      const finScale = (1 - pv) / (1 - basePrev);
      const newFinanciero = r.costoFinanciero * finScale;
      return r.ingresoTotal > 0
        ? (r.ingresoTotal - newCostoPreFinan - newFinanciero) / r.ingresoTotal : 0;
    }));
    return {
      grid,
      rowLabels: costSteps.map(s => s === 0 ? "Base" : (s > 0 ? "+" : "") + (s * pctVar * 100).toFixed(0) + "%"),
      colLabels: preventas.map((p, i) => i === 2 ? Math.round(p*100)+"% (Base)" : Math.round(p*100)+"%"),
    };
  }, [sup, r, pctVar]);
  const sensTirFinanciamiento = useMemo(() => {
    // Tabla 5: TIR vs % Financiamiento × Capital — Excel: escala préstamo proporcionalmente
    const ltcs = [
      Math.max(0.10, sup.pctFinanciamiento - 2 * pctVar * 2),
      Math.max(0.10, sup.pctFinanciamiento - 1 * pctVar * 2),
      sup.pctFinanciamiento,
      Math.min(0.95, sup.pctFinanciamiento + 1 * pctVar * 2),
      Math.min(0.95, sup.pctFinanciamiento + 2 * pctVar * 2),
    ];
    const capitals = [
      sup.equityCapital * (1 - 2 * pctVar * 5),
      sup.equityCapital * (1 - 1 * pctVar * 5),
      sup.equityCapital,
      sup.equityCapital * (1 + 1 * pctVar * 5),
      sup.equityCapital * (1 + 2 * pctVar * 5),
    ];
    const utilBruta = r.ingresoTotal - r.costoPreFinan;
    // Excel: TIR = (1 + (ingreso - costoPreFinan - prestamo*(newLTC/baseLTC)*tasa*draw*(meses/12)) / (terreno + newCapital))^(12/durTotal) - 1
    const grid = ltcs.map(ltc => capitals.map(cap => {
      const loanScale = ltc / sup.pctFinanciamiento;
      const interes = r.prestamo * loanScale * sup.tasaInteres * sup.drawFactor * (sup.mesesConstruccion / 12);
      const utilNeta = utilBruta - interes;
      const eqTotal = r.precioTerreno + cap;
      return eqTotal > 0 && r.mesesTotal > 0
        ? Math.pow(1 + utilNeta / eqTotal, 12 / r.mesesTotal) - 1 : 0;
    }));
    return {
      grid,
      rowLabels: ltcs.map((l, i) => i === 2 ? Math.round(l*100)+"% (Base)" : Math.round(l*100)+"%"),
      colLabels: capitals.map((c, i) => i === 2 ? "$"+fmt(c/1000)+"K" : "$"+fmt(c/1000)+"K"),
    };
  }, [sup, r, pctVar]);
  const sensMoicFinanciamiento = useMemo(() => {
    // Tabla 6: MOIC vs % Financiamiento × Capital — misma estructura que Tabla 5
    const ltcs = [
      Math.max(0.10, sup.pctFinanciamiento - 2 * pctVar * 2),
      Math.max(0.10, sup.pctFinanciamiento - 1 * pctVar * 2),
      sup.pctFinanciamiento,
      Math.min(0.95, sup.pctFinanciamiento + 1 * pctVar * 2),
      Math.min(0.95, sup.pctFinanciamiento + 2 * pctVar * 2),
    ];
    const capitals = [
      sup.equityCapital * (1 - 2 * pctVar * 5),
      sup.equityCapital * (1 - 1 * pctVar * 5),
      sup.equityCapital,
      sup.equityCapital * (1 + 1 * pctVar * 5),
      sup.equityCapital * (1 + 2 * pctVar * 5),
    ];
    const utilBruta = r.ingresoTotal - r.costoPreFinan;
    // Excel: MOIC = (utilNeta + eqTotal) / eqTotal
    const grid = ltcs.map(ltc => capitals.map(cap => {
      const loanScale = ltc / sup.pctFinanciamiento;
      const interes = r.prestamo * loanScale * sup.tasaInteres * sup.drawFactor * (sup.mesesConstruccion / 12);
      const utilNeta = utilBruta - interes;
      const eqTotal = r.precioTerreno + cap;
      return eqTotal > 0 ? (utilNeta + eqTotal) / eqTotal : 0;
    }));
    return {
      grid,
      rowLabels: ltcs.map((l, i) => i === 2 ? Math.round(l*100)+"% (Base)" : Math.round(l*100)+"%"),
      colLabels: capitals.map((c, i) => i === 2 ? "$"+fmt(c/1000)+"K" : "$"+fmt(c/1000)+"K"),
    };
  }, [sup, r, pctVar]);
  const sensEstructura = useMemo(() => {
    // Tabla 7: Estructura Óptima de Capital
    const capitals = [];
    for (let c = sup.equityCapital * 0.7; c <= sup.equityCapital * 1.3; c += 30000) capitals.push(Math.round(c));
    return capitals.map(cap => {
      const s = { ...sup, equityCapital: cap };
      const res = calcAll(s, mix, thresholds);
      return { capital: cap, equityTotal: res.equityTotal, prestamo: res.prestamo, ltv: res.ltv, ltc: res.ltc, cobertura: res.equityTotal > 0 ? res.equityTotal / res.costoPreFinan : 0, tir: res.tir, moic: res.moic };
    });
  }, [sup, mix, thresholds]);
  // 5 escenarios predefinidos
  const escenarios = useMemo(() => {
    const defs = [
      { nombre: "Agresivo", precioDelta: 0.20, costoDelta: -0.10, color: "text-emerald-700", bg: "bg-emerald-50" },
      { nombre: "Optimista", precioDelta: 0.10, costoDelta: -0.05, color: "text-emerald-600", bg: "bg-emerald-50" },
      { nombre: "Base", precioDelta: 0, costoDelta: 0, color: "text-blue-700", bg: "bg-blue-50" },
      { nombre: "Conservador", precioDelta: -0.05, costoDelta: 0.05, color: "text-amber-700", bg: "bg-amber-50" },
      { nombre: "Pesimista", precioDelta: -0.15, costoDelta: 0.10, color: "text-red-700", bg: "bg-red-50" },
    ];
    return defs.map(d => {
      const newMix = mix.map(u => ({ ...u, precioUd: u.precioUd * (1 + d.precioDelta) }));
      const newSup = { ...sup, costoM2: sup.costoM2 * (1 + d.costoDelta) };
      const res = calcAll(newSup, newMix, thresholds);
      return { ...d, ...res };
    });
  }, [sup, mix, thresholds]);
  // Punto de equilibrio — Fórmulas exactas del Excel (TABLERO rows 48-50)
  const breakEven = useMemo(() => {
    // Excel: costosVariables = blandos + devFee + comision + marketing (% del ingreso)
    const costosVar = sup.softCosts + sup.devFee + sup.comisionVenta + sup.marketing;
    // Excel: costosFijos = terreno + construccion + contingencias + financiero
    const costosFijos = r.precioTerreno + r.costoConstruccion + r.costoContingencias + r.costoFinanciero;
    // Excel: precioMin/m2 para 15% margen = costosFijos / ((0.85 - costosVar) × m2Vendible)
    const minPrecioM2_15 = r.m2Vendible > 0 ? costosFijos / ((0.85 - costosVar) * r.m2Vendible) : 0;
    // Excel: uds recuperar capital = CEILING(costosFijos / (precioPromUd × (1 - costosVar)), 1)
    const contribPorUd = r.precioPromUd * (1 - costosVar);
    const unidadesCapital = contribPorUd > 0 ? Math.ceil(costosFijos / contribPorUd) : 0;
    // Excel: uds cubrir financiamiento = CEILING((costosFijos - equityTotal) / (precioPromUd × (1 - costosVar)), 1)
    const unidadesFinanciamiento = contribPorUd > 0 ? Math.ceil((costosFijos - r.equityTotal) / contribPorUd) : 0;
    // Margen de seguridad
    const margenSeguridad = minPrecioM2_15 > 0 ? (r.precioPromM2 - minPrecioM2_15) / minPrecioM2_15 : 0;
    return { minPrecioM2_15, unidadesCapital, unidadesFinanciamiento, margenSeguridad, costosVar };
  }, [r, sup]);

  const tabs = [
    { id: "supuestos", label: "Supuestos" },
    { id: "resultados", label: "Resultados" },
    { id: "sensibilidad", label: "Sensibilidad" },
    { id: "escenarios", label: "Escenarios" },
  ];

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <div className="no-print bg-slate-800 text-white px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-black tracking-widest text-white" style={{letterSpacing:"0.15em"}}>ESTATE<span className="text-blue-400">is</span>REAL</span>
              <span className="text-slate-500">|</span>
              <h1 className="text-lg font-bold tracking-tight">Prefactibilidad Inmobiliaria</h1>
            </div>
            <p className="text-xs text-slate-400">Análisis financiero rápido para proyectos inmobiliarios | v4.2</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.print()}
              className="no-print px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded-lg transition"
              title="Imprimir todas las secciones"
            >
              🖨️ Imprimir
            </button>
            <div className="text-right">
              <div className="text-xs text-slate-400">{sup.proyecto}</div>
              <div className="text-xs text-slate-500">{sup.ubicacion}</div>
            </div>
            <div
              className="px-4 py-2 rounded-lg font-bold text-sm text-white shadow-lg"
              style={{ backgroundColor: r.decisionColor }}
            >
              {r.decision}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Metrics Bar */}
      <div className="no-print bg-slate-800 border-b border-slate-700 px-4 py-2">
        <div className="max-w-5xl mx-auto flex gap-6 text-xs overflow-x-auto">
          {[
            { l: "Ingreso Total", v: fmtUSD(r.ingresoTotal) },
            { l: "Costo Total", v: fmtUSD(r.costoTotal) },
            { l: "Utilidad Neta", v: fmtUSD(r.utilidadNeta) },
            { l: "ROI", v: fmtPct(r.roi) },
            { l: "Margen", v: fmtPct(r.margen) },
            { l: "MOIC", v: r.moic?.toFixed(2) + "x" },
            { l: "TIR anual", v: fmtPct(r.tir) },
          ].map(m => (
            <div key={m.l} className="whitespace-nowrap">
              <span className="text-slate-400">{m.l}: </span>
              <span className="font-bold text-slate-200">{m.v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="max-w-5xl mx-auto px-4 pt-4">
        <div className="no-print flex gap-1 mb-4">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                tab === t.id
                  ? "bg-white text-slate-800 border border-b-0 border-slate-200 shadow-sm"
                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ═══ TAB: SUPUESTOS ═══ */}
        <div className="print-section" style={{ display: tab === "supuestos" ? "block" : "none" }}>
          <div className="print-header-bar" style={{display:"none"}}><div><span className="brand">ESTATE<span className="accent">is</span>REAL</span></div><div style={{fontSize:"9px"}}><strong>{sup.proyecto}</strong> — {sup.ubicacion}</div></div>
          <div className="space-y-4 pb-8">
            {/* Proyecto */}
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">Proyecto</h3>
              <div className="grid grid-cols-3 gap-3">
                <InputField label="Nombre" value={sup.proyecto} onChange={v => updateSup("proyecto", v)} type="text" />
                <InputField label="Ubicación" value={sup.ubicacion} onChange={v => updateSup("ubicacion", v)} type="text" />
                <InputField label="Fecha" value={sup.fecha} onChange={v => updateSup("fecha", v)} type="date" />
              </div>
            </div>

            {/* Terreno */}
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">Terreno</h3>
              <div className="grid grid-cols-3 gap-3">
                <InputField label="Área Terreno" value={sup.areaTerreno} onChange={v => updateSup("areaTerreno", v)} suffix="m²" />
                <MoneyInput label="Precio Total Terreno" value={sup.precioTerreno} onChange={v => updateSup("precioTerreno", v)} />
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Precio / m² terreno</label>
                  <div className="px-2 py-1.5 bg-slate-100 border border-slate-200 rounded text-sm font-mono text-slate-700">
                    ${fmt(r.precioTerrenoM2, 2)}
                  </div>
                </div>
              </div>
            </div>

            {/* Mix de Producto */}
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">Mix de Producto</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-slate-500 uppercase">
                      <th className="text-left p-2">Tipo</th>
                      <th className="text-center p-2 bg-blue-50">Cantidad</th>
                      <th className="text-center p-2 bg-blue-50">m²/Ud</th>
                      <th className="text-center p-2 bg-blue-50">Precio/Ud</th>
                      <th className="text-right p-2">USD/m²</th>
                      <th className="text-right p-2">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mix.map((u, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="p-2">
                          <input className="w-full px-1 py-0.5 text-sm border border-slate-200 rounded" value={u.tipo} onChange={e => updateMix(i, "tipo", e.target.value)} />
                        </td>
                        <td className="p-1"><input type="number" className="w-full px-1 py-0.5 text-center text-sm bg-blue-50 border border-blue-200 rounded font-mono" value={u.qty} onChange={e => updateMix(i, "qty", parseInt(e.target.value) || 0)} min={0} /></td>
                        <td className="p-1"><input type="number" className="w-full px-1 py-0.5 text-center text-sm bg-blue-50 border border-blue-200 rounded font-mono" value={u.m2} onChange={e => updateMix(i, "m2", parseFloat(e.target.value) || 0)} min={0} /></td>
                        <td className="p-1"><InlineMoney value={u.precioUd} onChange={v => updateMix(i, "precioUd", v)} /></td>
                        <td className="p-2 text-right font-mono text-slate-600 text-xs">{u.m2 > 0 ? fmtUSD(u.precioUd / u.m2) : "—"}</td>
                        <td className="p-2 text-right font-mono font-medium text-xs">{fmtUSD(u.qty * u.precioUd)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-slate-300 font-bold text-xs">
                      <td className="p-2">TOTAL</td>
                      <td className="p-2 text-center">{r.unidades}</td>
                      <td className="p-2 text-center">{r.unidades > 0 ? fmt(r.m2Vendible / r.unidades, 1) : "—"}</td>
                      <td className="p-2 text-center">{fmtUSD(r.precioPromUd)}</td>
                      <td className="p-2 text-right">{fmtUSD(r.precioPromM2)}</td>
                      <td className="p-2 text-right text-emerald-700">{fmtUSD(r.ingresoTotal)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Costos */}
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">Costos del Proyecto</h3>
              <div className="grid grid-cols-3 gap-3">
                <MoneyInput label="Costo de construcción por m² vendible" value={sup.costoM2} onChange={v => updateSup("costoM2", v)} step={50} />
                <PctField label="Costos blandos (% del ingreso total)" value={sup.softCosts} onChange={v => updateSup("softCosts", v)} step={0.5} />
                <PctField label="Comisión inmobiliaria (% del ingreso)" value={sup.comisionVenta} onChange={v => updateSup("comisionVenta", v)} step={0.5} />
                <PctField label="Publicidad y mercadeo (% del ingreso)" value={sup.marketing} onChange={v => updateSup("marketing", v)} step={0.1} />
                <PctField label="Contingencias (% del costo de construcción)" value={sup.contingencias} onChange={v => updateSup("contingencias", v)} step={0.5} />
                <PctField label="Fee del desarrollador (% del ingreso)" value={sup.devFee} onChange={v => updateSup("devFee", v)} step={0.5} />
              </div>
            </div>

            {/* Financiamiento */}
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">Financiamiento Bancario</h3>
              <div className="grid grid-cols-4 gap-3">
                <PctField label="% del costo total a financiar (LTC)" value={sup.pctFinanciamiento} onChange={v => updateSup("pctFinanciamiento", v)} step={5} />
                <PctField label="Tasa de interés anual del banco" value={sup.tasaInteres} onChange={v => updateSup("tasaInteres", v)} step={0.5} />
                <div className="flex flex-col gap-1">
                  <PctField label="Uso promedio del préstamo durante obra" value={sup.drawFactor} onChange={v => updateSup("drawFactor", v)} step={5} />
                  <span className="text-xs text-slate-400">El banco no desembolsa todo de una vez. Ej: 60% significa que en promedio solo usas el 60% del préstamo durante la obra. Rango típico: 50%–65%.</span>
                </div>
                <PctField label="Comisión bancaria al cierre del préstamo" value={sup.comisionBanco} onChange={v => updateSup("comisionBanco", v)} step={0.5} />
              </div>
            </div>

            {/* Timeline */}
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">Cronograma y Preventas</h3>
              <div className="grid grid-cols-3 gap-3">
                <InputField label="Meses de pre-desarrollo y permisos" value={sup.mesesPredev} onChange={v => updateSup("mesesPredev", v)} suffix="meses" />
                <InputField label="Meses de construcción" value={sup.mesesConstruccion} onChange={v => updateSup("mesesConstruccion", v)} suffix="meses" />
                <InputField label="Meses de entrega" value={sup.mesesPostVenta} onChange={v => updateSup("mesesPostVenta", v)} suffix="meses" />
                <PctField label="% de unidades vendidas durante construcción" value={sup.preventaPct} onChange={v => updateSup("preventaPct", v)} step={5} />
                <PctField label="% del precio cobrado antes de entrega" value={sup.cobroPct} onChange={v => updateSup("cobroPct", v)} step={5} />
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Duración total estimada</label>
                  <div className="px-2 py-1.5 bg-slate-100 border border-slate-200 rounded text-sm font-mono text-slate-700">
                    {r.mesesTotal} meses
                  </div>
                </div>
              </div>
            </div>

            {/* Equity */}
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">Inversión de los Socios (Equity)</h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Aporte del socio que pone el terreno</label>
                  <div className="px-2 py-1.5 bg-slate-100 border border-slate-200 rounded text-sm font-mono text-slate-700">
                    {fmtUSD(r.precioTerreno)}
                  </div>
                  <span className="text-xs text-slate-400">Equivale al valor del terreno</span>
                </div>
                <MoneyInput label="Aporte en efectivo del socio capitalista" value={sup.equityCapital} onChange={v => updateSup("equityCapital", v)} />
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total inversión de los socios</label>
                  <div className="px-2 py-1.5 bg-slate-100 border border-slate-200 rounded text-sm font-mono font-bold text-slate-700">
                    {fmtUSD(r.equityTotal)}
                  </div>
                  <span className="text-xs text-slate-400">Terreno + capital en efectivo</span>
                </div>
              </div>
            </div>

            {/* Parqueos */}
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">Regulación de Parqueos</h3>
              <div className="grid grid-cols-3 gap-3">
                <InputField label="Parqueos incluidos en el diseño" value={sup.parqueosDisenados} onChange={v => updateSup("parqueosDisenados", v)} suffix="uds" />
                <InputField label="Parqueos por unidad (normativa)" value={sup.ratioResidente} onChange={v => updateSup("ratioResidente", v)} step={0.5} suffix="parq/ud" />
                <InputField label="1 parqueo de visita cada X unidades" value={sup.divisorVisita} onChange={v => updateSup("divisorVisita", v)} suffix="uds" />
                <InputField label="Mín. de unidades para exigir visitas" value={sup.minUnidadesVisita} onChange={v => updateSup("minUnidadesVisita", v)} suffix="uds" />
                <PctField label="% de parqueos para discapacidad" value={sup.pctDiscapacidad} onChange={v => updateSup("pctDiscapacidad", v)} step={0.5} />
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Requeridos / Status</label>
                  <div className={`px-2 py-1.5 rounded text-sm font-bold ${r.pCumple ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                    {r.pRequeridos} requeridos — {r.pCumple ? "CUMPLE" : "DÉFICIT"}
                  </div>
                </div>
              </div>
            </div>

            {/* Umbrales */}
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">Umbrales GO / NO-GO</h3>
              <p className="text-xs text-slate-500 mb-3">Define los mínimos aceptables para cada métrica. Verde = cumple, amarillo = marginal, rojo = no cumple.</p>
              <div className="grid grid-cols-4 gap-3">
                <PctField label="ROI mínimo aceptable" value={thresholds.roiMin} onChange={v => updateThresh("roiMin", v)} step={1} />
                <PctField label="Margen neto mínimo" value={thresholds.margenMin} onChange={v => updateThresh("margenMin", v)} step={0.5} />
                <InputField label="MOIC mínimo (veces)" value={thresholds.moicMin} onChange={v => updateThresh("moicMin", v)} step={0.1} suffix="x" />
                <InputField label="Incremento sobre costo mín. (Markup)" value={thresholds.markupMin} onChange={v => updateThresh("markupMin", v)} step={0.05} suffix="x" />
                <PctField label="TIR mínima anualizada" value={thresholds.tirMin} onChange={v => updateThresh("tirMin", v)} step={1} />
                <PctField label="LTV máximo (préstamo/valor)" value={thresholds.ltvMax} onChange={v => updateThresh("ltvMax", v)} step={1} />
                <PctField label="LTC máximo (préstamo/costo)" value={thresholds.ltcMax} onChange={v => updateThresh("ltcMax", v)} step={1} />
              </div>
            </div>
          </div>
        </div>

        {/* ═══ TAB: RESULTADOS ═══ */}
        <div className="print-section" style={{ display: tab === "resultados" ? "block" : "none" }}>
          <div className="print-header-bar" style={{display:"none"}}><div><span className="brand">ESTATE<span className="accent">is</span>REAL</span></div><div style={{fontSize:"9px"}}><strong>{sup.proyecto}</strong> — {sup.ubicacion}</div></div>
          <div className="space-y-4 pb-8">
            {/* Semáforo Principal */}
            <div className="rounded-xl p-6 text-center text-white shadow-lg" style={{ backgroundColor: r.decisionColor }}>
              <div className="text-4xl font-black mb-1">{r.decision}</div>
              <div className="text-sm opacity-90">{r.cumple}/7 métricas cumplen umbral mínimo</div>
            </div>

            {/* 7 Métricas */}
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">Métricas de Inversión</h3>
              <div className="grid grid-cols-4 gap-3">
                <MetricCard label="ROI — Retorno sobre Inversión" value={r.roi} format="pct" threshold={thresholds.roiMin} highlight desc="Utilidad ÷ Costo total. Ganancia por cada $1 invertido." />
                <MetricCard label="Margen Neto" value={r.margen} format="pct" threshold={thresholds.margenMin} highlight desc="Utilidad ÷ Ingreso. Cuánto queda de cada $1 vendido." />
                <MetricCard label="MOIC — Múltiplo sobre Capital" value={r.moic} format="x" threshold={thresholds.moicMin} highlight desc="Veces que el socio recupera su inversión. >1x = ganancia." />
                <MetricCard label="Incremento sobre Costo (Markup)" value={r.markup} format="x" threshold={thresholds.markupMin} highlight desc="Ingreso ÷ Costo total. Colchón sobre punto de equilibrio." />
                <MetricCard label="TIR — Tasa Interna de Retorno" value={r.tir} format="pct" threshold={thresholds.tirMin} highlight desc="Retorno anualizado sobre equity. Comparable entre proyectos." />
                <MetricCard label="LTV — Préstamo vs Valor del proyecto" value={r.ltv} format="pct" threshold={thresholds.ltvMax} type="max" desc="Préstamo ÷ Ingreso total. Menor = menos riesgo bancario." />
                <MetricCard label="LTC — Préstamo vs Costo total" value={r.ltc} format="pct" threshold={thresholds.ltcMax} type="max" desc="Préstamo ÷ Costo total. Menor = más respaldado por equity." />
                <MetricCard label="Duración total del proyecto" value={r.mesesTotal} format="num" desc="Pre-desarrollo + construcción + post-venta, en meses." />
              </div>
            </div>

            {/* Pro Forma */}
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">Estado de Resultados</h3>
              <div className="space-y-0.5 text-sm font-mono">
                {[
                  { l: "INGRESO BRUTO TOTAL", v: r.ingresoTotal, bold: true, color: "text-emerald-700" },
                  { l: "  (-) Terreno", v: r.precioTerreno },
                  { l: "  (-) Construcción directa", v: r.costoConstruccion },
                  { l: "  (-) Costos blandos", v: r.costoSoft },
                  { l: "  (-) Fee desarrollador", v: r.costoDevFee },
                  { l: "  (-) Comisión inmobiliaria", v: r.costoComision },
                  { l: "  (-) Publicidad y mercadeo", v: r.costoMarketing },
                  { l: "  (-) Contingencias", v: r.costoContingencias },
                  { l: "COSTO TOTAL (antes de financiamiento)", v: r.costoPreFinan, bold: true, color: "text-red-600", line: true },
                  { l: "UTILIDAD BRUTA (antes de intereses)", v: r.ingresoTotal - r.costoPreFinan, bold: true, color: r.ingresoTotal - r.costoPreFinan >= 0 ? "text-emerald-700" : "text-red-600", line: true },
                  { l: "Margen Bruto (%)", v: null, pct: r.ingresoTotal > 0 ? (r.ingresoTotal - r.costoPreFinan) / r.ingresoTotal : 0, color: "text-slate-500" },
                  { l: "", v: null, spacer: true },
                  { l: "COSTOS FINANCIEROS (deuda bancaria)", v: null, bold: true, color: "text-slate-700", header: true },
                  { l: "  Préstamo bancario (referencia)", v: r.prestamo, ref: true },
                  { l: "  (-) Intereses estimados", v: r.intereses },
                  { l: "  (-) Comisión bancaria al cierre", v: r.comisionBancaria },
                  { l: "TOTAL COSTO FINANCIERO", v: r.costoFinanciero, bold: true, color: "text-red-600", line: true },
                  { l: "", v: null, spacer: true },
                  { l: "UTILIDAD NETA (ganancia final del proyecto)", v: r.utilidadNeta, bold: true, color: r.utilidadNeta >= 0 ? "text-emerald-700" : "text-red-600", line: true, big: true },
                  { l: "Margen Neto (utilidad ÷ ingreso)", v: null, pct: r.margen, bold: true, color: r.margen >= 0.125 ? "text-emerald-700" : "text-amber-700" },
                ].map((row, i) => {
                  if (row.spacer) return <div key={i} className="h-2" />;
                  return (
                    <div key={i} className={`flex justify-between px-2 py-1 ${row.line ? "border-t border-slate-300 mt-1 pt-1" : ""} ${row.bold ? "font-bold" : "text-slate-600"} ${row.color || ""} ${row.big ? "text-base" : ""}`}>
                      <span>{row.l}</span>
                      <span>{row.pct != null ? fmtPct(row.pct) : row.v != null ? (row.ref ? fmtUSD(row.v) : fmtUSD(row.v)) : ""}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Usos y Fuentes de Capital */}
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">Usos y Fuentes de Capital</h3>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Usos — ¿En qué se necesita el dinero?</h4>
                  <div className="space-y-1.5 text-sm font-mono">
                    <div className="flex justify-between px-2 py-1 text-slate-600"><span>Terreno</span><span>{fmtUSD(r.precioTerreno)}</span></div>
                    <div className="flex justify-between px-2 py-1 text-slate-600"><span>Construcción directa</span><span>{fmtUSD(r.costoConstruccion)}</span></div>
                    <div className="flex justify-between px-2 py-1 text-slate-600"><span>Costos blandos</span><span>{fmtUSD(r.costoSoft)}</span></div>
                    <div className="flex justify-between px-2 py-1 text-slate-600"><span>Comisión inmobiliaria</span><span>{fmtUSD(r.costoComision)}</span></div>
                    <div className="flex justify-between px-2 py-1 text-slate-600"><span>Publicidad y mercadeo</span><span>{fmtUSD(r.costoMarketing)}</span></div>
                    <div className="flex justify-between px-2 py-1 text-slate-600"><span>Fee desarrollador</span><span>{fmtUSD(r.costoDevFee)}</span></div>
                    <div className="flex justify-between px-2 py-1 text-slate-600"><span>Contingencias</span><span>{fmtUSD(r.costoContingencias)}</span></div>
                    <div className="flex justify-between px-2 py-1 text-slate-600"><span>Intereses bancarios</span><span>{fmtUSD(r.intereses)}</span></div>
                    <div className="flex justify-between px-2 py-1 text-slate-600"><span>Comisión bancaria</span><span>{fmtUSD(r.comisionBancaria)}</span></div>
                    <div className="flex justify-between px-2 py-1.5 border-t border-slate-300 font-bold text-slate-800 mt-1 pt-1"><span>TOTAL USOS</span><span>{fmtUSD(r.costoTotal)}</span></div>
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Fuentes — ¿De dónde sale el dinero?</h4>
                  <div className="space-y-1.5 text-sm font-mono">
                    <div className="flex justify-between px-2 py-1 text-slate-600"><span>Aporte socio terreno</span><span>{fmtUSD(r.precioTerreno)}</span></div>
                    <div className="flex justify-between px-2 py-1 text-slate-600"><span>Aporte socio capital</span><span>{fmtUSD(sup.equityCapital)}</span></div>
                    <div className="flex justify-between px-2 py-1 text-slate-600 border-t border-slate-200 pt-1"><span className="font-semibold">Total equity (socios)</span><span className="font-semibold">{fmtUSD(r.equityTotal)}</span></div>
                    <div className="flex justify-between px-2 py-1 text-slate-600"><span>Préstamo bancario</span><span>{fmtUSD(r.prestamo)}</span></div>
                    <div className="flex justify-between px-2 py-1 text-slate-600"><span>Preventas cobradas en obra</span><span>{fmtUSD(r.preventas)}</span></div>
                    <div className="flex justify-between px-2 py-1.5 border-t border-slate-300 font-bold text-slate-800 mt-1 pt-1"><span>TOTAL FUENTES</span><span>{fmtUSD(r.equityTotal + r.prestamo + r.preventas)}</span></div>
                  </div>
                  <div className="mt-3 text-xs text-slate-500 italic">La utilidad neta ({fmtUSD(r.utilidadNeta)}) es la diferencia entre fuentes y usos.</div>
                </div>
              </div>
            </div>

            {/* Métricas Urbanísticas */}
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">Métricas Urbanísticas</h3>
              <div className="grid grid-cols-4 gap-3">
                <MetricCard label="Unidades" value={r.unidades} format="num" />
                <MetricCard label="m² Vendible" value={r.m2Vendible} format="num" />
                <MetricCard label="Densidad (viv/ha)" value={r.densidad} format="num" />
                <MetricCard label="FAR (m² vendible ÷ m² terreno)" value={r.far} format="num" />
              </div>
            </div>

            {/* Parqueos */}
            <div className={`rounded-lg border p-4 ${r.pCumple ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
              <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">Validación Parqueos</h3>
              <div className="grid grid-cols-5 gap-3 text-sm">
                <div><span className="text-slate-500">Residentes:</span> <strong>{r.pResidente}</strong></div>
                <div><span className="text-slate-500">Visitas:</span> <strong>{r.pVisita}</strong></div>
                <div><span className="text-slate-500">Discapacidad:</span> <strong>{r.pDiscapacidad}</strong></div>
                <div><span className="text-slate-500">Requeridos:</span> <strong>{r.pRequeridos}</strong></div>
                <div><span className="text-slate-500">Diseñados:</span> <strong>{sup.parqueosDisenados}</strong>
                  <span className={`ml-2 font-bold ${r.pCumple ? "text-emerald-600" : "text-red-600"}`}>
                    {r.pCumple ? "CUMPLE" : "DÉFICIT"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ TAB: SENSIBILIDAD ═══ */}
        <div className="print-section" style={{ display: tab === "sensibilidad" ? "block" : "none" }}>
          <div className="print-header-bar" style={{display:"none"}}><div><span className="brand">ESTATE<span className="accent">is</span>REAL</span></div><div style={{fontSize:"9px"}}><strong>{sup.proyecto}</strong> — {sup.ubicacion}</div></div>
          <div className="space-y-4 pb-8">
            <div className="bg-blue-50 rounded-lg border border-blue-200 p-3 text-sm text-blue-700">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <strong>¿Qué pasa si cambian las condiciones?</strong> Estas 7 tablas muestran cómo se afectan los resultados al variar supuestos clave. La celda azul es tu escenario actual. <span className="font-semibold">Verde</span> = cumple umbral, <span className="font-semibold">amarillo</span> = marginal, <span className="font-semibold">rojo</span> = no cumple.
                </div>
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <label className="text-xs font-bold text-blue-800">Factor de variación:</label>
                  <input type="number" value={Math.round(pctVar * 100)} onChange={e => setPctVar(Math.max(1, Math.min(25, parseFloat(e.target.value) || 5)) / 100)} min={1} max={25} step={1}
                    className="w-16 px-2 py-1 text-center text-sm font-mono bg-white border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  <span className="text-xs text-blue-600">%</span>
                </div>
              </div>
            </div>

            {/* Tabla 1: Margen vs Costo × Precio */}
            <SensTable title="1. Margen Neto — ¿Qué pasa si sube el costo de construcción o baja el precio de venta?" data={sensMargen} rowLabel="Costo/m²" colLabel="Precio/m²" format="pct" pctVar={pctVar} threshold={thresholds.margenMin} baseRowVal={sup.costoM2} baseColVal={r.precioPromM2} />

            {/* Tabla 2: ROI vs Costo × Precio */}
            <SensTable title="2. ROI — ¿Cómo cambia la rentabilidad si varía el costo o el precio?" data={sensRoi} rowLabel="Costo/m²" colLabel="Precio/m²" format="pct" pctVar={pctVar} threshold={thresholds.roiMin} baseRowVal={sup.costoM2} baseColVal={r.precioPromM2} />

            {/* Tabla 3: TIR vs Tasa Interés × Duración (custom labels) */}
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <h4 className="text-sm font-bold text-slate-700 mb-3">3. TIR — ¿Cómo afecta la tasa del banco y el plazo de construcción al retorno anualizado?</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      <th className="p-1.5 text-left bg-slate-100 text-slate-500">Tasa anual ↓ \ Meses obra →</th>
                      {sensTirTasaDuracion.colLabels.map((l, i) => (
                        <th key={l} className={`p-1.5 text-center ${i === 2 ? "bg-blue-100 font-bold" : "bg-slate-100"}`}>{l}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sensTirTasaDuracion.grid.map((row, ri) => (
                      <tr key={ri}>
                        <td className={`p-1.5 font-medium ${ri === 2 ? "bg-blue-100 font-bold" : "bg-slate-50"} text-slate-600`}>
                          {sensTirTasaDuracion.rowLabels[ri]}
                        </td>
                        {row.map((v, ci) => (
                          <td key={ci} className={`p-1.5 text-center font-mono ${ri === 2 && ci === 2 ? "font-bold ring-2 ring-blue-400 rounded" : ""} ${v >= thresholds.tirMin ? "bg-emerald-50 text-emerald-700" : v >= thresholds.tirMin * 0.75 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>
                            {fmtPct(v)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tabla 4: Margen vs Costo × Preventas (custom labels) */}
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <h4 className="text-sm font-bold text-slate-700 mb-3">4. Margen Neto — ¿Cómo impacta vender más en preventas o que suba el costo?</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      <th className="p-1.5 text-left bg-slate-100 text-slate-500">Var. costo ↓ \ % Preventas →</th>
                      {sensMargenPreventas.colLabels.map((l, i) => (
                        <th key={l} className={`p-1.5 text-center ${i === 2 ? "bg-blue-100 font-bold" : "bg-slate-100"}`}>{l}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sensMargenPreventas.grid.map((row, ri) => (
                      <tr key={ri}>
                        <td className={`p-1.5 font-medium ${ri === 2 ? "bg-blue-100 font-bold" : "bg-slate-50"} text-slate-600`}>
                          {sensMargenPreventas.rowLabels[ri]}
                        </td>
                        {row.map((v, ci) => (
                          <td key={ci} className={`p-1.5 text-center font-mono ${ri === 2 && ci === 2 ? "font-bold ring-2 ring-blue-400 rounded" : ""} ${v >= thresholds.margenMin ? "bg-emerald-50 text-emerald-700" : v >= thresholds.margenMin * 0.75 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>
                            {fmtPct(v)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tabla 5: TIR vs LTC × Equity (custom labels) */}
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <h4 className="text-sm font-bold text-slate-700 mb-3">5. TIR — ¿Qué pasa si pido más o menos al banco, o si los socios ponen más capital?</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      <th className="p-1.5 text-left bg-slate-100 text-slate-500">% Financ. ↓ \ Capital socios →</th>
                      {sensTirFinanciamiento.colLabels.map((l, i) => (
                        <th key={l} className={`p-1.5 text-center ${i === 2 ? "bg-blue-100 font-bold" : "bg-slate-100"}`}>{l}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sensTirFinanciamiento.grid.map((row, ri) => (
                      <tr key={ri}>
                        <td className={`p-1.5 font-medium ${ri === 2 ? "bg-blue-100 font-bold" : "bg-slate-50"} text-slate-600`}>
                          {sensTirFinanciamiento.rowLabels[ri]}
                        </td>
                        {row.map((v, ci) => (
                          <td key={ci} className={`p-1.5 text-center font-mono ${ri === 2 && ci === 2 ? "font-bold ring-2 ring-blue-400 rounded" : ""} ${v >= thresholds.tirMin ? "bg-emerald-50 text-emerald-700" : v >= thresholds.tirMin * 0.75 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>
                            {fmtPct(v)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tabla 6: MOIC vs LTC × Equity (custom labels) */}
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <h4 className="text-sm font-bold text-slate-700 mb-3">6. MOIC — ¿Cuántas veces recuperan su dinero los socios según nivel de deuda y capital?</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      <th className="p-1.5 text-left bg-slate-100 text-slate-500">% Financ. ↓ \ Capital socios →</th>
                      {sensMoicFinanciamiento.colLabels.map((l, i) => (
                        <th key={l} className={`p-1.5 text-center ${i === 2 ? "bg-blue-100 font-bold" : "bg-slate-100"}`}>{l}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sensMoicFinanciamiento.grid.map((row, ri) => (
                      <tr key={ri}>
                        <td className={`p-1.5 font-medium ${ri === 2 ? "bg-blue-100 font-bold" : "bg-slate-50"} text-slate-600`}>
                          {sensMoicFinanciamiento.rowLabels[ri]}
                        </td>
                        {row.map((v, ci) => (
                          <td key={ci} className={`p-1.5 text-center font-mono ${ri === 2 && ci === 2 ? "font-bold ring-2 ring-blue-400 rounded" : ""} ${v >= thresholds.moicMin ? "bg-emerald-50 text-emerald-700" : v >= thresholds.moicMin * 0.85 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>
                            {v?.toFixed(3)}x
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tabla 7: Estructura Óptima de Capital */}
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <h4 className="text-sm font-bold text-slate-700 mb-3">7. Estructura Óptima — ¿Cuál es el balance ideal entre capital propio y deuda bancaria?</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="p-1.5 text-center text-slate-500">Capital</th>
                      <th className="p-1.5 text-center text-slate-500">Equity Total</th>
                      <th className="p-1.5 text-center text-slate-500">Préstamo</th>
                      <th className="p-1.5 text-center text-slate-500">LTV</th>
                      <th className="p-1.5 text-center text-slate-500">LTC</th>
                      <th className="p-1.5 text-center text-slate-500">Cobertura</th>
                      <th className="p-1.5 text-center text-slate-500">TIR</th>
                      <th className="p-1.5 text-center text-slate-500">MOIC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sensEstructura.map((row, i) => {
                      const isBase = Math.abs(row.capital - sup.equityCapital) < 5000;
                      return (
                        <tr key={i} className={isBase ? "bg-blue-50 font-bold" : ""}>
                          <td className="p-1.5 text-center font-mono">{fmtUSD(row.capital)}</td>
                          <td className="p-1.5 text-center font-mono">{fmtUSD(row.equityTotal)}</td>
                          <td className="p-1.5 text-center font-mono">{fmtUSD(row.prestamo)}</td>
                          <td className={`p-1.5 text-center font-mono ${row.ltv <= thresholds.ltvMax ? "bg-emerald-50 text-emerald-700" : row.ltv <= thresholds.ltvMax * 1.15 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>{fmtPct(row.ltv)}</td>
                          <td className={`p-1.5 text-center font-mono ${row.ltc <= thresholds.ltcMax ? "bg-emerald-50 text-emerald-700" : row.ltc <= thresholds.ltcMax * 1.15 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>{fmtPct(row.ltc)}</td>
                          <td className={`p-1.5 text-center font-mono ${row.cobertura >= 0.25 ? "bg-emerald-50 text-emerald-700" : row.cobertura >= 0.15 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>{fmtPct(row.cobertura)}</td>
                          <td className={`p-1.5 text-center font-mono ${row.tir >= thresholds.tirMin ? "bg-emerald-50 text-emerald-700" : row.tir >= thresholds.tirMin * 0.75 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>{fmtPct(row.tir)}</td>
                          <td className={`p-1.5 text-center font-mono ${row.moic >= thresholds.moicMin ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{row.moic.toFixed(3)}x</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-500 mt-2 italic">A menor capital, mayor TIR (mayor apalancamiento) pero mayor riesgo financiero (LTV/LTC más altos). La fila resaltada en azul es el escenario base actual.</p>
            </div>
          </div>
        </div>

        {/* ═══ TAB: ESCENARIOS ═══ */}
        <div className="print-section" style={{ display: tab === "escenarios" ? "block" : "none" }}>
          <div className="print-header-bar" style={{display:"none"}}><div><span className="brand">ESTATE<span className="accent">is</span>REAL</span></div><div style={{fontSize:"9px"}}><strong>{sup.proyecto}</strong> — {sup.ubicacion}</div></div>
          <div className="space-y-4 pb-8">
            {/* 5 Escenarios */}
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">5 Escenarios de Mercado</h3>
              <p className="text-xs text-slate-500 mb-3">¿Cómo se comporta el proyecto si el mercado mejora o empeora? Cada escenario ajusta precio y costo de construcción.</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="p-2 text-left text-slate-500">Escenario</th>
                      <th className="p-2 text-center text-slate-500">Ingreso</th>
                      <th className="p-2 text-center text-slate-500">Costo</th>
                      <th className="p-2 text-center text-slate-500">Utilidad</th>
                      <th className="p-2 text-center text-slate-500">Margen</th>
                      <th className="p-2 text-center text-slate-500">ROI</th>
                      <th className="p-2 text-center text-slate-500">MOIC</th>
                      <th className="p-2 text-center text-slate-500">TIR</th>
                      <th className="p-2 text-center text-slate-500">Decisión</th>
                    </tr>
                  </thead>
                  <tbody>
                    {escenarios.map((e, i) => {
                      const isBase = e.nombre === "Base";
                      return (
                        <tr key={i} className={`border-t border-slate-100 ${isBase ? "bg-blue-50" : ""}`}>
                          <td className={`p-2 font-bold ${isBase ? "text-blue-700" : "text-slate-700"}`}>
                            {e.nombre}
                            <div className="font-normal text-slate-500 text-xs">
                              Precio {e.precioDelta >= 0 ? "+" : ""}{(e.precioDelta*100).toFixed(0)}%, Costo {e.costoDelta >= 0 ? "+" : ""}{(e.costoDelta*100).toFixed(0)}%
                            </div>
                          </td>
                          <td className="p-2 text-center font-mono">{fmtUSD(e.ingresoTotal)}</td>
                          <td className="p-2 text-center font-mono">{fmtUSD(e.costoPreFinan)}</td>
                          <td className={`p-2 text-center font-mono font-bold ${e.utilidadNeta >= 0 ? "text-emerald-700" : "text-red-700"}`}>{fmtUSD(e.utilidadNeta)}</td>
                          <td className={`p-2 text-center font-mono ${e.margen >= thresholds.margenMin ? "bg-emerald-50 text-emerald-700" : e.margen >= thresholds.margenMin * 0.75 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>{fmtPct(e.margen)}</td>
                          <td className={`p-2 text-center font-mono ${e.roi >= thresholds.roiMin ? "bg-emerald-50 text-emerald-700" : e.roi >= thresholds.roiMin * 0.75 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>{fmtPct(e.roi)}</td>
                          <td className={`p-2 text-center font-mono ${e.moic >= thresholds.moicMin ? "bg-emerald-50 text-emerald-700" : e.moic >= thresholds.moicMin * 0.85 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>{e.moic.toFixed(2)}x</td>
                          <td className={`p-2 text-center font-mono ${e.tir >= thresholds.tirMin ? "bg-emerald-50 text-emerald-700" : e.tir >= thresholds.tirMin * 0.75 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>{fmtPct(e.tir)}</td>
                          <td className="p-2 text-center">
                            <span className="px-2 py-1 rounded text-xs font-bold text-white" style={{ backgroundColor: e.decisionColor }}>
                              {e.decision}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Punto de Equilibrio */}
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">Punto de Equilibrio</h3>
              <p className="text-xs text-slate-500 mb-3">¿Cuánto necesitas vender para no perder dinero? Estos indicadores muestran los mínimos de supervivencia del proyecto.</p>
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg border border-slate-200 p-4 text-center">
                  <div className="text-xs text-slate-500 uppercase mb-1">Precio mínimo de venta por m²</div>
                  <div className="text-xs text-slate-400 mb-1">Para lograr al menos 15% de margen</div>
                  <div className="text-2xl font-bold text-slate-800">{fmtUSD(breakEven.minPrecioM2_15)}/m²</div>
                  <div className={`text-xs mt-1 font-medium ${r.precioPromM2 >= breakEven.minPrecioM2_15 ? "text-emerald-600" : "text-red-600"}`}>
                    Tu precio actual: {fmtUSD(r.precioPromM2)}/m² — {r.precioPromM2 >= breakEven.minPrecioM2_15 ? "SUFICIENTE" : "INSUFICIENTE"}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 p-4 text-center">
                  <div className="text-xs text-slate-500 uppercase mb-1">Unidades para recuperar todo el capital</div>
                  <div className="text-xs text-slate-400 mb-1">Terreno + construcción + financiero</div>
                  <div className="text-2xl font-bold text-slate-800">{breakEven.unidadesCapital} ud</div>
                  <div className="text-xs mt-1 text-slate-500">
                    {r.unidades > 0 ? fmtPct(breakEven.unidadesCapital / r.unidades) : "—"} de las {r.unidades} unidades totales
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 p-4 text-center">
                  <div className="text-xs text-slate-500 uppercase mb-1">Unidades para pagar el banco</div>
                  <div className="text-xs text-slate-400 mb-1">Sin contar el equity de los socios</div>
                  <div className="text-2xl font-bold text-slate-800">{breakEven.unidadesFinanciamiento} ud</div>
                  <div className="text-xs mt-1 text-slate-500">
                    {r.unidades > 0 ? fmtPct(breakEven.unidadesFinanciamiento / r.unidades) : "—"} de las {r.unidades} unidades totales
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="no-print bg-slate-800 text-slate-400 text-xs text-center py-3 mt-8">
        ESTATEisREAL — Prefactibilidad Inmobiliaria v1.0 | Motor de cálculo basado en metodología PE/VC | © Alejandro J. Fondeur M. 2026
      </div>
    </div>
  );
}
