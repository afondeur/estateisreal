"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import UsageLimitModal from "./UsageLimitModal";

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
  tirMin: 0.25, ltvMax: 0.45, ltcMax: 0.55
};

const DEFAULT_SUPUESTOS = {
  proyecto: "", ubicacion: "", fecha: "",
  areaTerreno: 0, precioTerreno: 0,
  costoM2: 0, softCosts: 0, comisionVenta: 0, marketing: 0, contingencias: 0,
  tasaInteres: 0, drawFactor: 0, comisionBanco: 0,
  mesesPredev: 0, mesesConstruccion: 0, mesesPostVenta: 0,
  preventaPct: 0, cobroPct: 0,
  equityCapital: 0,
  parqueosDisenados: 0, ratioResidente: 1, divisorVisita: 10, pctDiscapacidad: 0.04,
};

const fmt = (n, dec = 0) => n == null || isNaN(n) ? "—" : n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
const fmtPct = (n, dec = 1) => n == null || isNaN(n) ? "—" : (n * 100).toFixed(dec) + "%";
const fmtMoney = (n) => n == null || isNaN(n) ? "—" : fmt(n);
const fmtUSD = fmtMoney; // alias para compatibilidad

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
  const costoComision = ingresoTotal * sup.comisionVenta;
  const costoMarketing = ingresoTotal * sup.marketing;
  const costoContingencias = costoConstruccion * sup.contingencias;

  // ─── COSTO TOTAL ANTES DE FINANCIAMIENTO ───
  const costoPreFinan = precioTerreno + costoConstruccion + costoSoft + costoComision + costoMarketing + costoContingencias;

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
  const tirBase = equityTotal > 0 ? 1 + utilidadNeta / equityTotal : 0;
  const tir = equityTotal > 0 && mesesTotal > 0
    ? (tirBase > 0 ? Math.pow(tirBase, 12 / mesesTotal) - 1 : -1)
    : 0;
  const ltv = ingresoTotal > 0 ? prestamo / ingresoTotal : 0;
  const ltc = costoPreFinan > 0 ? prestamo / costoPreFinan : 0;

  // ─── MÉTRICAS URBANÍSTICAS ───
  const densidad = sup.areaTerreno > 0 ? unidades / (sup.areaTerreno / 10000) : 0;
  const m2PorUnidad = unidades > 0 ? m2Vendible / unidades : 0;
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
  const pVisita = sup.divisorVisita > 0 ? Math.floor(unidades / sup.divisorVisita) : 0;
  const pDiscapacidad = Math.max(1, Math.ceil(pResidente * sup.pctDiscapacidad));
  const pRequeridos = pResidente + pVisita + pDiscapacidad;
  const pCumple = sup.parqueosDisenados >= pRequeridos;

  return {
    unidades, m2Vendible, ingresoTotal, precioPromM2, precioPromUd,
    precioTerreno, precioTerrenoM2, costoConstruccion, costoSoft, costoComision, costoMarketing, costoContingencias,
    costoPreFinan, equityTerreno, equityTotal, preventas, prestamo, intereses, comisionBancaria, costoFinanciero,
    costoTotal, utilidadNeta, mesesTotal,
    roi, moic, markup, margen, tir, ltv, ltc,
    densidad, m2PorUnidad, costoM2Total,
    checks, cumple, decision, decisionColor,
    pResidente, pVisita, pDiscapacidad, pRequeridos, pCumple,
  };
}

function calcSensitivity(sup, mix, thresholds, metricKey, varRow, varCol, baseRow, baseCol, pctVar = 0.05) {
  const steps = [-3, -2, -1, 0, 1, 2, 3];
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
// FORMULA EVALUATOR — soporta =100+50, =1000*3, =500/2, =1000-200
// También expresiones complejas: =(100+50)*3, =1000/4+250
// ═══════════════════════════════════════════════
function evalFormula(input) {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  // Debe empezar con "=" para ser fórmula
  if (!trimmed.startsWith("=")) return null;
  const expr = trimmed.slice(1).trim();
  if (!expr) return null;
  // Solo permitir números, operadores matemáticos, paréntesis, puntos y espacios (seguridad)
  if (!/^[\d+\-*/().%\s]+$/.test(expr)) return null;
  try {
    // Evaluar de forma segura con Function (sin acceso a scope)
    const result = new Function(`"use strict"; return (${expr});`)();
    if (typeof result === "number" && isFinite(result)) return result;
    return null;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════
// UI COMPONENTS
// ═══════════════════════════════════════════════

function InputField({ label, value, onChange, type = "number", step, suffix, prefix, min, max, small, required }) {
  const isNum = type === "number";
  const [editing, setEditing] = useState(false);
  const [rawText, setRawText] = useState("");
  const displayVal = isNum && (value === 0 || value === "0") ? "" : value;
  const isEmpty = required && (value === 0 || value === "" || value == null);
  const isFormula = rawText.startsWith("=");

  const handleFocus = (e) => {
    if (isNum) {
      setEditing(true);
      setRawText(value === 0 ? "" : String(value));
    }
    setTimeout(() => e.target.select(), 0);
  };

  const handleChange = (e) => {
    const v = e.target.value;
    if (isNum) {
      setRawText(v);
      if (!v.startsWith("=")) {
        onChange(parseFloat(v) || 0);
      }
    } else {
      onChange(v);
    }
  };

  const handleBlur = () => {
    if (isNum) {
      if (isFormula) {
        const result = evalFormula(rawText);
        if (result !== null) onChange(result);
      }
      setEditing(false);
      setRawText("");
    }
  };

  return (
    <div className={`flex flex-col ${small ? "gap-0.5" : "gap-1"}`}>
      <label className={`text-xs font-medium uppercase tracking-wide ${isEmpty ? "text-red-500" : "text-slate-500"}`}>{label}{required ? " *" : ""}</label>
      <div className="flex items-center gap-1">
        {prefix && <span className="text-sm text-slate-400">{prefix}</span>}
        <input
          type={isNum ? "text" : type}
          inputMode={isNum && !isFormula ? "decimal" : undefined}
          value={isNum && editing ? rawText : displayVal}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={e => { if (e.key === "Enter") e.target.blur(); }}
          placeholder={isNum ? "0 ó =fórmula" : "0"}
          className={`w-full px-2 py-1.5 rounded text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 ${isFormula ? "bg-green-50 border-2 border-green-400" : isEmpty ? "bg-red-50 border-2 border-red-400" : "bg-blue-50 border border-blue-200"}`}
        />
        {suffix && <span className="text-sm text-slate-400 whitespace-nowrap">{suffix}</span>}
      </div>
    </div>
  );
}

// Campo para montos grandes: muestra con comas (1,334,541) pero edita como número crudo
// Soporta fórmulas: =1000*50, =500+300, etc.
function MoneyInput({ label, value, onChange, prefix, step = 100, required }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState("");
  const isEmpty = required && value === 0;
  const isFormula = raw.startsWith("=");

  const handleChange = (e) => {
    const v = e.target.value;
    setRaw(v);
    if (!v.startsWith("=")) {
      onChange(parseFloat(v) || 0);
    }
  };

  const handleBlur = () => {
    if (isFormula) {
      const result = evalFormula(raw);
      if (result !== null) onChange(result);
    }
    setEditing(false);
  };

  return (
    <div className="flex flex-col gap-1">
      <label className={`text-xs font-medium uppercase tracking-wide ${isEmpty ? "text-red-500" : "text-slate-500"}`}>{label}{required ? " *" : ""}</label>
      <div className="flex items-center gap-1">
        {prefix && <span className="text-sm text-slate-400">{prefix}</span>}
        {editing ? (
          <input
            type="text"
            inputMode={isFormula ? "text" : "decimal"}
            autoFocus
            value={raw}
            onChange={handleChange}
            onFocus={e => setTimeout(() => e.target.select(), 0)}
            onBlur={handleBlur}
            onKeyDown={e => { if (e.key === "Enter") e.target.blur(); }}
            placeholder="0 ó =fórmula"
            className={`w-full px-2 py-1.5 rounded text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 ${isFormula ? "bg-green-50 border-2 border-green-400" : isEmpty ? "bg-red-50 border-2 border-red-400" : "bg-blue-50 border border-blue-200"}`}
          />
        ) : (
          <div
            tabIndex={0}
            onClick={() => { setRaw(value === 0 ? "" : String(value)); setEditing(true); }}
            onFocus={() => { setRaw(value === 0 ? "" : String(value)); setEditing(true); }}
            className={`w-full px-2 py-1.5 rounded text-sm font-mono text-slate-800 cursor-text hover:border-blue-400 ${isEmpty ? "bg-red-50 border-2 border-red-400" : "bg-blue-50 border border-blue-200"}`}
          >
            {value === 0 ? <span className={isEmpty ? "text-red-400" : "text-slate-400"}>0</span> : fmt(value)}
          </div>
        )}
      </div>
    </div>
  );
}

// Campo inline para tabla: muestra con comas, edita crudo
// Soporta fórmulas: =100*50, =500+300, etc.
function InlineMoney({ value, onChange, step = 1000, min = 0 }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState("");
  const isFormula = raw.startsWith("=");

  const handleChange = (e) => {
    const v = e.target.value;
    setRaw(v);
    if (!v.startsWith("=")) {
      onChange(parseFloat(v) || 0);
    }
  };

  const handleBlur = () => {
    if (isFormula) {
      const result = evalFormula(raw);
      if (result !== null) onChange(result);
    }
    setEditing(false);
  };

  if (editing) return (
    <input type="text" inputMode={isFormula ? "text" : "decimal"} autoFocus value={raw}
      onChange={handleChange}
      onFocus={e => setTimeout(() => e.target.select(), 0)}
      onBlur={handleBlur}
      onKeyDown={e => { if (e.key === "Enter") e.target.blur(); }}
      className={`w-full px-1 py-0.5 text-center text-sm rounded font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 ${isFormula ? "bg-green-50 border-2 border-green-400" : "bg-blue-50 border border-blue-200"}`} />
  );
  return (
    <div tabIndex={0}
      onClick={() => { setRaw(value === 0 ? "" : String(value)); setEditing(true); }}
      onFocus={() => { setRaw(value === 0 ? "" : String(value)); setEditing(true); }}
      className="w-full px-1 py-0.5 text-center text-sm bg-blue-50 border border-blue-200 rounded font-mono text-slate-800 cursor-text hover:border-blue-400">
      {value === 0 ? <span className="text-slate-400">0</span> : fmt(value)}
    </div>
  );
}

// Campo especial para porcentajes: muestra 75 pero guarda 0.75 internamente
// Soporta fórmulas: =5+3 → 8% (guarda 0.08)
function PctField({ label, value, onChange, step = 0.5, min = 0, max = 100, required }) {
  const isEmpty = required && value === 0;
  const [editing, setEditing] = useState(false);
  const [rawText, setRawText] = useState("");
  const isFormula = rawText.startsWith("=");
  const displayVal = value === 0 ? "" : Math.round(value * 10000) / 100;

  const handleFocus = (e) => {
    setEditing(true);
    setRawText(value === 0 ? "" : String(Math.round(value * 10000) / 100));
    setTimeout(() => e.target.select(), 0);
  };

  const handleChange = (e) => {
    const v = e.target.value;
    setRawText(v);
    if (!v.startsWith("=")) {
      onChange((parseFloat(v) || 0) / 100);
    }
  };

  const handleBlur = () => {
    if (isFormula) {
      const result = evalFormula(rawText);
      if (result !== null) onChange(result / 100);
    }
    setEditing(false);
    setRawText("");
  };

  return (
    <div className="flex flex-col gap-1">
      <label className={`text-xs font-medium uppercase tracking-wide ${isEmpty ? "text-red-500" : "text-slate-500"}`}>{label}{required ? " *" : ""}</label>
      <div className="flex items-center gap-1">
        <input
          type="text"
          inputMode={isFormula ? "text" : "decimal"}
          value={editing ? rawText : (displayVal === "" ? "" : displayVal)}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={e => { if (e.key === "Enter") e.target.blur(); }}
          placeholder="0 ó =fórmula"
          className={`w-full px-2 py-1.5 rounded text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 ${isFormula ? "bg-green-50 border-2 border-green-400" : isEmpty ? "bg-red-50 border-2 border-red-400" : "bg-blue-50 border border-blue-200"}`}
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
      if (threshold) return v <= threshold ? "bg-emerald-200 text-emerald-800" : v <= threshold * 1.15 ? "bg-amber-200 text-amber-800" : "bg-red-200 text-red-800";
      return v < 0.5 ? "bg-emerald-200 text-emerald-800" : v < 0.65 ? "bg-amber-200 text-amber-800" : "bg-red-200 text-red-800";
    }
    if (threshold) return v >= threshold ? "bg-emerald-200 text-emerald-800" : v >= threshold * 0.75 ? "bg-amber-200 text-amber-800" : "bg-red-200 text-red-800";
    if (format === "pct") return v > 0.15 ? "bg-emerald-200 text-emerald-800" : v > 0.08 ? "bg-amber-200 text-amber-800" : "bg-red-200 text-red-800";
    return v > 1.3 ? "bg-emerald-200 text-emerald-800" : v > 1.1 ? "bg-amber-200 text-amber-800" : "bg-red-200 text-red-800";
  };
  const fmtB = fmtBase || ((v) => fmt(v));
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
        <table className="w-full text-xs" style={{ tableLayout: "fixed" }}>
          <thead>
            <tr>
              <th className="p-1.5 text-left bg-slate-100 rounded-tl text-slate-500" style={{ width: "13%" }}>{rowLabel} ↓ \ {colLabel} →</th>
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
                <td className={`p-1.5 font-medium ${steps[ri] === 0 ? "bg-blue-100 font-bold" : "bg-slate-50"} text-slate-600`}>
                  {rowLbl(steps[ri])}
                </td>
                {row.map((v, ci) => (
                  <td key={ci} className={`p-1.5 text-center font-mono ${steps[ri] === 0 && steps[ci] === 0 ? "font-bold ring-2 ring-blue-400 rounded" : ""} ${cellColor(v)}`}>
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
// PRINT DISCLAIMER
// ═══════════════════════════════════════════════
function PrintDisclaimer() {
  return (
    <div className="print-disclaimer" style={{display:"none"}}>
      <div style={{marginTop:"16px",borderTop:"1px solid #cbd5e1",paddingTop:"8px",fontSize:"7.5px",color:"#64748b",lineHeight:"1.4"}}>
        <p style={{margin:"0 0 3px 0"}}><strong>AVISO LEGAL:</strong> Este documento es una proyección financiera preliminar generada con fines informativos y de análisis interno. <strong>No constituye un estudio de factibilidad formal, ni una recomendación de inversión.</strong> Los resultados están basados exclusivamente en los supuestos ingresados por el usuario y pueden variar significativamente respecto a los resultados reales del proyecto.</p>
        <p style={{margin:"0 0 3px 0"}}>Se recomienda complementar este análisis con estudios de mercado, avalúos formales, revisión legal y asesoría financiera profesional antes de tomar decisiones de inversión.</p>
        <p style={{margin:0}}><strong>© {new Date().getFullYear()} ESTATEisREAL — Todos los derechos reservados.</strong> Queda prohibida la reproducción total o parcial de este documento sin autorización expresa.</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════

export default function PrefactibilidadApp() {
  const { trackEvent, saveFeedback: saveFeedbackToDb, tier, isAdmin, user, saveProject, listProjects, loadProject, deleteProject } = useAuth();
  const [sup, setSup] = useState(DEFAULT_SUPUESTOS);
  const [mix, setMix] = useState(DEFAULT_MIX);
  const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS);
  const [tab, setTab] = useState("supuestos");
  const [pctVar, setPctVar] = useState(0.05);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedback1, setFeedback1] = useState("");
  const [feedback2, setFeedback2] = useState("");
  const [feedback3, setFeedback3] = useState("");
  const [feedbackOtro, setFeedbackOtro] = useState("");
  const [validationErrors, setValidationErrors] = useState([]);

  // ─── Estado de proyectos guardados ───
  const [currentProjectId, setCurrentProjectId] = useState(null);
  const [projects, setProjects] = useState([]);
  const [showProjectsPanel, setShowProjectsPanel] = useState(false);
  const [savingProject, setSavingProject] = useState(false);
  const [projectMsg, setProjectMsg] = useState("");
  const [showUsageLimit, setShowUsageLimit] = useState(false);
  const [usageCount, setUsageCount] = useState(0);

  const updateSup = useCallback((key, val) => setSup(prev => ({ ...prev, [key]: val })), []);
  const updateMix = useCallback((idx, key, val) => setMix(prev => prev.map((u, i) => i === idx ? { ...u, [key]: val } : u)), []);
  const updateThresh = useCallback((key, val) => setThresholds(prev => ({ ...prev, [key]: val })), []);

  // Llenado rápido (solo admin)
  const llenadoRapido = useCallback(() => {
    setSup({
      proyecto: "Proyecto 1", ubicacion: "Santiago, RD", fecha: "2026-02-22",
      areaTerreno: 1332, precioTerreno: 275000,
      costoM2: 950, softCosts: 0.025, comisionVenta: 0.05, marketing: 0.003, contingencias: 0.02,
      tasaInteres: 0.11, drawFactor: 0.55, comisionBanco: 0.01,
      mesesPredev: 6, mesesConstruccion: 18, mesesPostVenta: 6,
      preventaPct: 0.75, cobroPct: 0.25,
      equityCapital: 300000,
      parqueosDisenados: 33, ratioResidente: 1, divisorVisita: 10, pctDiscapacidad: 0.04,
    });
    setMix([
      { tipo: "Tipo 1", qty: 10, m2: 82, precioUd: 140000 },
      { tipo: "Tipo 2", qty: 10, m2: 93, precioUd: 150000 },
      { tipo: "Tipo 3", qty: 0, m2: 0, precioUd: 0 },
      { tipo: "Tipo 4", qty: 0, m2: 0, precioUd: 0 },
      { tipo: "Tipo 5", qty: 0, m2: 0, precioUd: 0 },
      { tipo: "Tipo 6", qty: 0, m2: 0, precioUd: 0 },
    ]);
  }, []);

  // ─── Funciones de proyectos ───
  const refreshProjects = useCallback(async () => {
    if (!user) return;
    const { data } = await listProjects();
    setProjects(data || []);
  }, [user, listProjects]);

  // Cargar lista al montar o al cambiar usuario
  useEffect(() => {
    if (user) refreshProjects();
  }, [user, refreshProjects]);

  const handleSaveProject = useCallback(async () => {
    if (!sup.proyecto.trim()) {
      setProjectMsg("Escribe un nombre de proyecto primero");
      setTimeout(() => setProjectMsg(""), 3000);
      return;
    }
    setSavingProject(true);
    const { data, error } = await saveProject(sup.proyecto, sup, mix, thresholds, currentProjectId);
    if (error) {
      setProjectMsg("Error al guardar: " + error.message);
    } else {
      setCurrentProjectId(data.id);
      setProjectMsg("Proyecto guardado");
      await refreshProjects();
      trackEvent("proyecto_guardado", { proyecto: sup.proyecto, id: data.id });
    }
    setSavingProject(false);
    setTimeout(() => setProjectMsg(""), 3000);
  }, [sup, mix, thresholds, currentProjectId, saveProject, refreshProjects, trackEvent]);

  const handleLoadProject = useCallback(async (projectId) => {
    const { data, error } = await loadProject(projectId);
    if (error || !data) {
      setProjectMsg("Error al cargar proyecto");
      setTimeout(() => setProjectMsg(""), 3000);
      return;
    }
    setSup(data.supuestos);
    setMix(data.mix);
    setThresholds(data.thresholds);
    setCurrentProjectId(data.id);
    setShowProjectsPanel(false);
    setProjectMsg("Proyecto cargado: " + data.nombre);
    trackEvent("proyecto_cargado", { proyecto: data.nombre, id: data.id });
    setTimeout(() => setProjectMsg(""), 3000);
  }, [loadProject, trackEvent]);

  const handleDeleteProject = useCallback(async (projectId, nombre) => {
    if (!window.confirm(`¿Eliminar "${nombre}"? Esta acción no se puede deshacer.`)) return;
    const { error } = await deleteProject(projectId);
    if (error) {
      setProjectMsg("Error al eliminar");
    } else {
      if (currentProjectId === projectId) setCurrentProjectId(null);
      setProjectMsg("Proyecto eliminado");
      await refreshProjects();
    }
    setTimeout(() => setProjectMsg(""), 3000);
  }, [deleteProject, currentProjectId, refreshProjects]);

  const handleNewProject = useCallback(() => {
    setSup(DEFAULT_SUPUESTOS);
    setMix(DEFAULT_MIX);
    setThresholds(DEFAULT_THRESHOLDS);
    setCurrentProjectId(null);
    setValidationErrors([]);
    setTab("supuestos");
    setProjectMsg("Nuevo proyecto iniciado");
    setTimeout(() => setProjectMsg(""), 3000);
  }, []);

  // Validación de campos obligatorios
  const validateFields = useCallback(() => {
    const errors = [];
    const requiredSup = [
      { key: "proyecto", label: "Nombre del proyecto" },
      { key: "ubicacion", label: "Ubicación" },
      { key: "fecha", label: "Fecha" },
      { key: "areaTerreno", label: "Área del terreno" },
      { key: "precioTerreno", label: "Precio del terreno" },
      { key: "costoM2", label: "Costo de construcción por m²" },
      { key: "softCosts", label: "Costos blandos" },
      { key: "comisionVenta", label: "Comisión inmobiliaria" },
      { key: "tasaInteres", label: "Tasa de interés" },
      { key: "drawFactor", label: "Draw factor" },
      { key: "mesesPredev", label: "Meses de pre-desarrollo" },
      { key: "mesesConstruccion", label: "Meses de construcción" },
      { key: "mesesPostVenta", label: "Meses de entrega" },
      { key: "preventaPct", label: "% preventas" },
      { key: "cobroPct", label: "% cobro antes de entrega" },
      { key: "equityCapital", label: "Aporte del socio capitalista" },
    ];
    requiredSup.forEach(({ key, label }) => {
      const v = sup[key];
      if (v === 0 || v === "" || v == null) errors.push(label);
    });
    if (!mix.some(u => u.qty > 0 && u.m2 > 0 && u.precioUd > 0)) {
      errors.push("Mix de producto (mínimo 1 línea completa)");
    }
    return errors;
  }, [sup, mix]);

  // Generar Análisis
  const handleGenerar = useCallback(async () => {
    const errors = validateFields();
    if (errors.length > 0) {
      setValidationErrors(errors);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    // Check usage limit for free users
    try {
      const res = await fetch("/api/check-usage");
      if (res.ok) {
        const usage = await res.json();
        if (!usage.allowed) {
          setUsageCount(usage.count);
          setShowUsageLimit(true);
          return;
        }
      }
      // If API fails, fail open — allow the analysis
    } catch {
      // Fail open
    }

    setValidationErrors([]);
    setTab("resultados");
    trackEvent("analisis_generado", { proyecto: sup.proyecto });
  }, [validateFields, trackEvent, sup.proyecto]);

  // Imprimir con feedback
  const handlePrint = useCallback(() => {
    if (feedbackSent) {
      window.print();
    } else {
      setShowFeedback(true);
    }
  }, [feedbackSent]);

  const submitFeedbackAndPrint = useCallback(async () => {
    // Guardar feedback en Supabase
    const respuesta2 = feedback2 === "Otro" && feedbackOtro ? `Otro: ${feedbackOtro}` : feedback2;
    try {
      await saveFeedbackToDb(sup.proyecto || "Sin nombre", feedback1, respuesta2, feedback3);
      await trackEvent("feedback_submitted", { proyecto: sup.proyecto, feedback1, feedback2: respuesta2, feedback3 });
    } catch (e) {
      console.log("Error guardando feedback:", e);
    }
    setFeedbackSent(true);
    setShowFeedback(false);
    setTimeout(() => window.print(), 300);
  }, [feedback1, feedback2, feedback3, feedbackOtro, sup.proyecto, saveFeedbackToDb, trackEvent]);

  const skipFeedbackAndPrint = useCallback(() => {
    setFeedbackSent(true);
    setShowFeedback(false);
    trackEvent("feedback_skipped", { proyecto: sup.proyecto });
    setTimeout(() => window.print(), 300);
  }, [trackEvent, sup.proyecto]);

  const r = useMemo(() => calcAll(sup, mix, thresholds), [sup, mix, thresholds]);

  // 7 tablas de sensibilidad como en el Excel
  const sensMargen = useMemo(() => calcSensitivity(sup, mix, thresholds, "margen", "costoM2", "precioVenta", 0, 0, pctVar), [sup, mix, thresholds, pctVar]);
  const sensRoi = useMemo(() => calcSensitivity(sup, mix, thresholds, "roi", "costoM2", "precioVenta", 0, 0, pctVar), [sup, mix, thresholds, pctVar]);
  // ─── TABLAS 3-6: Fórmulas simplificadas del Excel ───
  // El Excel usa fórmulas simplificadas que escalan costos desde el caso base,
  // NO recalcula todo el modelo. Esto replica la lógica exacta del TABLERO.
  const sensTirTasaDuracion = useMemo(() => {
    // Tabla 3: TIR vs Tasa × Duración — 7x7
    const rates = [
      Math.max(0.01, sup.tasaInteres - 0.06),
      Math.max(0.01, sup.tasaInteres - 0.04),
      Math.max(0.01, sup.tasaInteres - 0.02),
      sup.tasaInteres,
      Math.min(0.30, sup.tasaInteres + 0.02),
      Math.min(0.30, sup.tasaInteres + 0.04),
      Math.min(0.30, sup.tasaInteres + 0.06),
    ];
    const durations = [
      Math.max(3, Math.round(sup.mesesConstruccion * 0.5)),
      Math.max(3, Math.round(sup.mesesConstruccion * 0.65)),
      Math.max(3, Math.round(sup.mesesConstruccion * 0.85)),
      sup.mesesConstruccion,
      Math.round(sup.mesesConstruccion * 1.15),
      Math.round(sup.mesesConstruccion * 1.35),
      Math.round(sup.mesesConstruccion * 1.5),
    ];
    // Excel: TIR = (1 + (utilBruta - prestamo*newTasa*drawFactor*(newMeses/12) - prestamo*comBanco) / equityTotal) ^ (12/(predev+newMeses+postventa)) - 1
    const utilBruta = r.ingresoTotal - r.costoPreFinan;
    const grid = rates.map(rate => durations.map(dur => {
      const interes = r.prestamo * rate * sup.drawFactor * (dur / 12);
      const comBanco = r.prestamo * sup.comisionBanco;
      const utilNeta = utilBruta - interes - comBanco;
      const durTotal = sup.mesesPredev + dur + sup.mesesPostVenta;
      if (r.equityTotal <= 0 || durTotal <= 0) return 0;
      const base = 1 + utilNeta / r.equityTotal;
      return base > 0 ? Math.pow(base, 12 / durTotal) - 1 : -1;
    }));
    return {
      grid,
      rowLabels: rates.map((rt, i) => i === 3 ? (rt*100).toFixed(1)+"% (Base)" : (rt*100).toFixed(1)+"%"),
      colLabels: durations.map((d, i) => i === 3 ? d+" (Base)" : d+"m"),
    };
  }, [sup, r]);
  const sensMargenPreventas = useMemo(() => {
    // Tabla 4: Margen vs Costo × Preventas — 7x7
    const costSteps = [-3, -2, -1, 0, 1, 2, 3];
    const preventas = [
      Math.max(0.05, sup.preventaPct - 0.30),
      Math.max(0.05, sup.preventaPct - 0.20),
      Math.max(0.05, sup.preventaPct - 0.10),
      sup.preventaPct,
      Math.min(0.95, sup.preventaPct + 0.10),
      Math.min(0.95, sup.preventaPct + 0.20),
      Math.min(0.95, sup.preventaPct + 0.30),
    ];
    // Excel: margen = (ingreso - costoPreFinan*(1+costDelta) - costoFinanciero*(1-newPrev)/(1-basePrev)) / ingreso
    const basePrev = sup.preventaPct;
    const grid = costSteps.map(cs => preventas.map(pv => {
      const costDelta = cs * pctVar;
      const newCostoPreFinan = r.costoPreFinan * (1 + costDelta);
      const finScale = basePrev < 1 ? (1 - pv) / (1 - basePrev) : 0;
      const newFinanciero = r.costoFinanciero * finScale;
      return r.ingresoTotal > 0
        ? (r.ingresoTotal - newCostoPreFinan - newFinanciero) / r.ingresoTotal : 0;
    }));
    return {
      grid,
      rowLabels: costSteps.map(s => s === 0 ? "Base" : (s > 0 ? "+" : "") + (s * pctVar * 100).toFixed(0) + "%"),
      colLabels: preventas.map((p, i) => i === 3 ? Math.round(p*100)+"% (Base)" : Math.round(p*100)+"%"),
    };
  }, [sup, r, pctVar]);
  const sensTirPreventas = useMemo(() => {
    // Tabla 5: TIR vs % Preventas × Capital — 7x7
    const prevPcts = [
      Math.max(0.05, sup.preventaPct - 0.30),
      Math.max(0.05, sup.preventaPct - 0.20),
      Math.max(0.05, sup.preventaPct - 0.10),
      sup.preventaPct,
      Math.min(0.95, sup.preventaPct + 0.10),
      Math.min(0.95, sup.preventaPct + 0.20),
      Math.min(0.95, sup.preventaPct + 0.30),
    ];
    const capitals = [
      sup.equityCapital * (1 - 3 * pctVar * 5),
      sup.equityCapital * (1 - 2 * pctVar * 5),
      sup.equityCapital * (1 - 1 * pctVar * 5),
      sup.equityCapital,
      sup.equityCapital * (1 + 1 * pctVar * 5),
      sup.equityCapital * (1 + 2 * pctVar * 5),
      sup.equityCapital * (1 + 3 * pctVar * 5),
    ];
    const grid = prevPcts.map(pv => capitals.map(cap => {
      const s = { ...sup, preventaPct: pv, equityCapital: Math.max(0, cap) };
      const res = calcAll(s, mix, thresholds);
      return res.tir;
    }));
    return {
      grid,
      rowLabels: prevPcts.map((p, i) => i === 3 ? Math.round(p*100)+"% (Base)" : Math.round(p*100)+"%"),
      colLabels: capitals.map((c, i) => i === 3 ? fmt(Math.max(0, c)/1000)+"K (Base)" : fmt(Math.max(0, c)/1000)+"K"),
    };
  }, [sup, mix, thresholds, pctVar]);
  const sensMoicPreventas = useMemo(() => {
    // Tabla 6: MOIC vs % Preventas × Capital — 7x7
    const prevPcts = [
      Math.max(0.05, sup.preventaPct - 0.30),
      Math.max(0.05, sup.preventaPct - 0.20),
      Math.max(0.05, sup.preventaPct - 0.10),
      sup.preventaPct,
      Math.min(0.95, sup.preventaPct + 0.10),
      Math.min(0.95, sup.preventaPct + 0.20),
      Math.min(0.95, sup.preventaPct + 0.30),
    ];
    const capitals = [
      sup.equityCapital * (1 - 3 * pctVar * 5),
      sup.equityCapital * (1 - 2 * pctVar * 5),
      sup.equityCapital * (1 - 1 * pctVar * 5),
      sup.equityCapital,
      sup.equityCapital * (1 + 1 * pctVar * 5),
      sup.equityCapital * (1 + 2 * pctVar * 5),
      sup.equityCapital * (1 + 3 * pctVar * 5),
    ];
    const grid = prevPcts.map(pv => capitals.map(cap => {
      const s = { ...sup, preventaPct: pv, equityCapital: Math.max(0, cap) };
      const res = calcAll(s, mix, thresholds);
      return res.moic;
    }));
    return {
      grid,
      rowLabels: prevPcts.map((p, i) => i === 3 ? Math.round(p*100)+"% (Base)" : Math.round(p*100)+"%"),
      colLabels: capitals.map((c, i) => i === 3 ? fmt(Math.max(0, c)/1000)+"K (Base)" : fmt(Math.max(0, c)/1000)+"K"),
    };
  }, [sup, mix, thresholds, pctVar]);
  const sensEstructura = useMemo(() => {
    // Tabla 7: Estructura Óptima de Capital
    const capitals = [];
    const step = Math.max(10000, Math.round(sup.equityCapital * 0.05 / 5000) * 5000) || 30000;
    for (let c = sup.equityCapital * 0.7; c <= sup.equityCapital * 1.3; c += step) capitals.push(Math.round(c));
    return capitals.map(cap => {
      const s = { ...sup, equityCapital: cap };
      const res = calcAll(s, mix, thresholds);
      return { capital: cap, equityTotal: res.equityTotal, preventas: res.preventas, prestamo: res.prestamo, ltv: res.ltv, ltc: res.ltc, cobertura: res.equityTotal > 0 ? res.equityTotal / res.costoPreFinan : 0, tir: res.tir, moic: res.moic };
    });
  }, [sup, mix, thresholds]);
  // 5 escenarios predefinidos
  const escenarios = useMemo(() => {
    const defs = [
      { nombre: "Agresivo", precioDelta: 0.20, costoDelta: -0.10, color: "text-emerald-700", bg: "bg-emerald-200" },
      { nombre: "Optimista", precioDelta: 0.10, costoDelta: -0.05, color: "text-emerald-600", bg: "bg-emerald-200" },
      { nombre: "Base", precioDelta: 0, costoDelta: 0, color: "text-blue-700", bg: "bg-blue-50" },
      { nombre: "Conservador", precioDelta: -0.05, costoDelta: 0.05, color: "text-amber-700", bg: "bg-amber-200" },
      { nombre: "Pesimista", precioDelta: -0.15, costoDelta: 0.10, color: "text-red-700", bg: "bg-red-200" },
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
    // Excel: costosVariables = blandos + comision + marketing (% del ingreso)
    const costosVar = sup.softCosts + sup.comisionVenta + sup.marketing;
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
    <div className="min-h-screen bg-slate-800">
      {showUsageLimit && (
        <UsageLimitModal
          analysisCount={usageCount}
          onClose={() => setShowUsageLimit(false)}
        />
      )}
      {/* Marca de agua para usuarios free (solo visible en print) */}
      {tier !== "pro" && (
        <div className="print-watermark" aria-hidden="true">
          <div className="print-watermark-text">VERSIÓN GRATUITA</div>
          <div className="print-watermark-text">VERSIÓN GRATUITA</div>
          <div className="print-watermark-text">VERSIÓN GRATUITA</div>
          <div className="print-watermark-text">VERSIÓN GRATUITA</div>
          <div className="print-watermark-text">VERSIÓN GRATUITA</div>
        </div>
      )}
      {/* Header */}
      <div className="no-print bg-slate-900 text-white px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-black tracking-widest text-white" style={{letterSpacing:"0.15em"}}>ESTATE<span className="text-blue-400">is</span>REAL</span>
              <span className="text-slate-500">|</span>
              <h1 className="text-lg font-bold tracking-tight">Prefactibilidad Inmobiliaria</h1>
            </div>
            <p className="text-xs text-slate-400">Análisis financiero rápido para proyectos inmobiliarios | v4.2</p>
          </div>
          <div className="flex items-center gap-2">
            {user && (
              <>
                <button
                  onClick={handleNewProject}
                  className="no-print px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded-lg transition"
                  title="Nuevo proyecto"
                >
                  + Nuevo
                </button>
                <button
                  onClick={handleSaveProject}
                  disabled={savingProject}
                  className="no-print px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-lg transition disabled:opacity-50"
                  title={currentProjectId ? "Actualizar proyecto" : "Guardar proyecto"}
                >
                  {savingProject ? "..." : currentProjectId ? "Actualizar" : "Guardar"}
                </button>
                <button
                  onClick={() => { setShowProjectsPanel(!showProjectsPanel); if (!showProjectsPanel) refreshProjects(); }}
                  className="no-print px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded-lg transition"
                  title="Mis proyectos guardados"
                >
                  Mis Proyectos {projects.length > 0 && `(${projects.length})`}
                </button>
              </>
            )}
            <button
              onClick={handlePrint}
              className="no-print px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded-lg transition"
              title="Imprimir todas las secciones"
            >
              Imprimir
            </button>
            <div className="text-right hidden sm:block">
              <div className="text-xs text-slate-400">{sup.proyecto}{currentProjectId && " ✓"}</div>
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
      <div className="no-print bg-slate-900 border-b border-slate-700 px-4 py-2">
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

      {/* Mensaje de estado de proyecto */}
      {projectMsg && (
        <div className="no-print max-w-5xl mx-auto px-4 pt-2">
          <div className="bg-blue-900/50 border border-blue-700 text-blue-200 text-sm px-4 py-2 rounded-lg text-center">
            {projectMsg}
          </div>
        </div>
      )}

      {/* Panel de Mis Proyectos */}
      {showProjectsPanel && (
        <div className="no-print max-w-5xl mx-auto px-4 pt-3">
          <div className="bg-slate-700 border border-slate-600 rounded-xl p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-bold text-slate-200">Mis Proyectos Guardados</h3>
              <button onClick={() => setShowProjectsPanel(false)} className="text-slate-400 hover:text-white text-lg">✕</button>
            </div>
            {projects.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-4">No tienes proyectos guardados aún. Completa los supuestos y haz clic en "Guardar".</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {projects.map(p => (
                  <div key={p.id} className={`flex items-center justify-between p-3 rounded-lg transition ${currentProjectId === p.id ? "bg-blue-900/40 border border-blue-600" : "bg-slate-800 hover:bg-slate-600"}`}>
                    <button
                      onClick={() => handleLoadProject(p.id)}
                      className="flex-1 text-left"
                    >
                      <div className="text-sm font-medium text-slate-100">{p.nombre}</div>
                      <div className="text-xs text-slate-400">
                        {new Date(p.updated_at).toLocaleDateString("es-DO", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        {currentProjectId === p.id && <span className="ml-2 text-blue-400 font-medium">• Activo</span>}
                      </div>
                    </button>
                    <button
                      onClick={() => handleDeleteProject(p.id, p.nombre)}
                      className="ml-3 text-red-400 hover:text-red-300 text-xs px-2 py-1 rounded hover:bg-red-900/30 transition"
                      title="Eliminar proyecto"
                    >
                      Eliminar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="no-print max-w-5xl mx-auto px-4 pt-4">
        <div className="flex gap-1 mb-4">
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
      </div>

      <div className="print-content max-w-5xl mx-auto px-4">
        {/* ═══ TAB: SUPUESTOS ═══ */}
        <div className="print-section" style={{ display: tab === "supuestos" ? "block" : "none" }}>
          <div className="print-header-bar" style={{display:"none"}}><div><span className="brand">ESTATE<span className="accent">is</span>REAL</span><span style={{marginLeft:"10px",fontSize:"8px",color:"#94a3b8"}}>Prefactibilidad Inmobiliaria v1.0</span></div><div className="project-info">{sup.proyecto && <><strong>{sup.proyecto}</strong> — {sup.ubicacion}<br/>{sup.fecha}</>}</div></div>
          <div className="space-y-4 pb-8">
            {/* Errores de validación */}
            {validationErrors.length > 0 && (
              <div className="no-print bg-red-50 border-2 border-red-400 rounded-lg p-4">
                <h4 className="text-sm font-bold text-red-700 mb-2">Campos obligatorios sin completar:</h4>
                <ul className="text-sm text-red-600 space-y-1">
                  {validationErrors.map((e, i) => <li key={i}>• {e}</li>)}
                </ul>
              </div>
            )}
            {/* Proyecto */}
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">Proyecto</h3>
              <div className="grid grid-cols-3 gap-3">
                <InputField label="Nombre" value={sup.proyecto} onChange={v => updateSup("proyecto", v)} type="text" required />
                <InputField label="Ubicación" value={sup.ubicacion} onChange={v => updateSup("ubicacion", v)} type="text" required />
                <InputField label="Fecha" value={sup.fecha} onChange={v => updateSup("fecha", v)} type="date" required />
              </div>
            </div>

            {/* Terreno */}
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">Terreno</h3>
              <div className="grid grid-cols-3 gap-3">
                <InputField label="Área Terreno" value={sup.areaTerreno} onChange={v => updateSup("areaTerreno", v)} suffix="m²" required />
                <MoneyInput label="Precio Total Terreno" value={sup.precioTerreno} onChange={v => updateSup("precioTerreno", v)} required />
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Precio / m² terreno</label>
                  <div className="px-2 py-1.5 bg-slate-100 border border-slate-200 rounded text-sm font-mono text-slate-700">
                    {fmt(r.precioTerrenoM2, 2)}
                  </div>
                </div>
              </div>
            </div>

            {/* Mix de Producto */}
            <div className={`bg-white rounded-lg border p-4 ${mix.some(u => u.qty > 0 && u.m2 > 0 && u.precioUd > 0) ? "border-slate-200" : "border-red-400 border-2"}`}>
              <h3 className={`text-sm font-bold mb-3 uppercase tracking-wide ${mix.some(u => u.qty > 0 && u.m2 > 0 && u.precioUd > 0) ? "text-slate-700" : "text-red-500"}`}>Mix de Producto {mix.some(u => u.qty > 0 && u.m2 > 0 && u.precioUd > 0) ? "" : "*"}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-slate-500 uppercase">
                      <th className="text-left p-2">Tipo</th>
                      <th className="text-center p-2 bg-blue-50">Cantidad</th>
                      <th className="text-center p-2 bg-blue-50">m²/Ud</th>
                      <th className="text-center p-2 bg-blue-50">Precio/Ud</th>
                      <th className="text-right p-2">Precio/m²</th>
                      <th className="text-right p-2">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mix.map((u, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="p-2">
                          <input className="w-full px-1 py-0.5 text-sm border border-slate-200 rounded" value={u.tipo} onChange={e => updateMix(i, "tipo", e.target.value)} />
                        </td>
                        <td className="p-1"><input type="number" className="w-full px-1 py-0.5 text-center text-sm bg-blue-50 border border-blue-200 rounded font-mono text-slate-800" value={u.qty === 0 ? "" : u.qty} onChange={e => updateMix(i, "qty", parseInt(e.target.value) || 0)} onFocus={e => e.target.select()} placeholder="0" min={0} /></td>
                        <td className="p-1"><input type="number" className="w-full px-1 py-0.5 text-center text-sm bg-blue-50 border border-blue-200 rounded font-mono text-slate-800" value={u.m2 === 0 ? "" : u.m2} onChange={e => updateMix(i, "m2", parseFloat(e.target.value) || 0)} onFocus={e => e.target.select()} placeholder="0" min={0} /></td>
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
                <MoneyInput label="Costo de construcción por m² vendible" value={sup.costoM2} onChange={v => updateSup("costoM2", v)} step={50} required />
                <PctField label="Costos blandos (% del ingreso total)" value={sup.softCosts} onChange={v => updateSup("softCosts", v)} step={0.5} required />
                <PctField label="Comisión inmobiliaria (% del ingreso)" value={sup.comisionVenta} onChange={v => updateSup("comisionVenta", v)} step={0.5} required />
                <PctField label="Publicidad y mercadeo (% del ingreso)" value={sup.marketing} onChange={v => updateSup("marketing", v)} step={0.1} />
                <PctField label="Contingencias (% del costo de construcción)" value={sup.contingencias} onChange={v => updateSup("contingencias", v)} step={0.5} />
              </div>
            </div>

            {/* Financiamiento */}
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">Financiamiento Bancario</h3>
              <div className="grid grid-cols-3 gap-3">
                <PctField label="Tasa de interés anual del banco" value={sup.tasaInteres} onChange={v => updateSup("tasaInteres", v)} step={0.5} required />
                <div className="flex flex-col gap-1">
                  <PctField label="Uso promedio del préstamo durante obra" value={sup.drawFactor} onChange={v => updateSup("drawFactor", v)} step={5} required />
                  <span className="text-xs text-slate-400">El banco no desembolsa todo de una vez. Ej: 60% significa que en promedio solo usas el 60% del préstamo durante la obra. Rango típico: 50%–65%.</span>
                </div>
                <PctField label="Comisión bancaria al cierre del préstamo" value={sup.comisionBanco} onChange={v => updateSup("comisionBanco", v)} step={0.5} />
              </div>
            </div>

            {/* Timeline */}
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">Cronograma y Preventas</h3>
              <div className="grid grid-cols-3 gap-3">
                <InputField label="Meses de pre-desarrollo y permisos" value={sup.mesesPredev} onChange={v => updateSup("mesesPredev", v)} suffix="meses" required />
                <InputField label="Meses de construcción" value={sup.mesesConstruccion} onChange={v => updateSup("mesesConstruccion", v)} suffix="meses" required />
                <InputField label="Meses de entrega" value={sup.mesesPostVenta} onChange={v => updateSup("mesesPostVenta", v)} suffix="meses" required />
                <PctField label="% de unidades vendidas durante construcción" value={sup.preventaPct} onChange={v => updateSup("preventaPct", v)} step={5} required />
                <PctField label="% del precio cobrado antes de entrega" value={sup.cobroPct} onChange={v => updateSup("cobroPct", v)} step={5} required />
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
                <MoneyInput label="Aporte en efectivo del socio capitalista" value={sup.equityCapital} onChange={v => updateSup("equityCapital", v)} required />
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

            {/* Botón Generar Análisis */}
            <div className="no-print flex justify-center gap-3 pt-2 pb-4">
              {isAdmin && (
                <button
                  onClick={llenadoRapido}
                  className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 text-sm font-bold rounded-xl shadow-lg transition transform hover:scale-105 active:scale-95"
                >
                  ⚡ Llenado Rápido
                </button>
              )}
              <button
                onClick={handleGenerar}
                className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white text-lg font-bold rounded-xl shadow-lg transition transform hover:scale-105 active:scale-95"
              >
                Generar Análisis
              </button>
            </div>

          <PrintDisclaimer />
          </div>
        </div>

        {/* ═══ TAB: RESULTADOS ═══ */}
        <div className="print-section" style={{ display: tab === "resultados" ? "block" : "none" }}>
          <div className="print-header-bar" style={{display:"none"}}><div><span className="brand">ESTATE<span className="accent">is</span>REAL</span><span style={{marginLeft:"10px",fontSize:"8px",color:"#94a3b8"}}>Prefactibilidad Inmobiliaria v1.0</span></div><div className="project-info">{sup.proyecto && <><strong>{sup.proyecto}</strong> — {sup.ubicacion}<br/>{sup.fecha}</>}</div></div>
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
                <MetricCard label="ROI — Retorno sobre Inversión" value={r.roi} format="pct" threshold={thresholds.roiMin} highlight desc="Utilidad ÷ Costo total. Ganancia por cada unidad monetaria invertida." />
                <MetricCard label="Margen Neto" value={r.margen} format="pct" threshold={thresholds.margenMin} highlight desc="Utilidad ÷ Ingreso. Cuánto queda de cada unidad monetaria vendida." />
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
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="p-1.5 text-left text-slate-500">Concepto</th>
                      <th className="p-1.5 text-right text-slate-500 font-mono">Total</th>
                      <th className="p-1.5 text-right text-slate-500 font-mono">Por Ud</th>
                      <th className="p-1.5 text-right text-slate-500 font-mono">Por m²</th>
                      <th className="p-1.5 text-right text-slate-500 font-mono">% Ingreso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { l: "INGRESO BRUTO TOTAL", v: r.ingresoTotal, bold: true, color: "text-emerald-700" },
                      { l: "(-) Terreno", v: r.precioTerreno },
                      { l: "(-) Construcción directa", v: r.costoConstruccion },
                      { l: "(-) Costos blandos", v: r.costoSoft },
                      { l: "(-) Comisión inmobiliaria", v: r.costoComision },
                      { l: "(-) Publicidad y mercadeo", v: r.costoMarketing },
                      { l: "(-) Contingencias", v: r.costoContingencias },
                      { l: "COSTO TOTAL (antes financiamiento)", v: r.costoPreFinan, bold: true, color: "text-red-600", line: true },
                      { l: "UTILIDAD BRUTA", v: r.ingresoTotal - r.costoPreFinan, bold: true, color: r.ingresoTotal - r.costoPreFinan >= 0 ? "text-emerald-700" : "text-red-600", line: true },
                      { l: "", spacer: true },
                      { l: "COSTOS FINANCIEROS", v: null, bold: true, color: "text-slate-700", header: true },
                      { l: "Préstamo bancario (ref.)", v: r.prestamo, ref: true },
                      { l: "(-) Intereses estimados", v: r.intereses },
                      { l: "(-) Comisión bancaria", v: r.comisionBancaria },
                      { l: "TOTAL COSTO FINANCIERO", v: r.costoFinanciero, bold: true, color: "text-red-600", line: true },
                      { l: "", spacer: true },
                      { l: "COSTO TOTAL DEL PROYECTO", v: r.costoTotal, bold: true, color: "text-red-600", line: true },
                      { l: "UTILIDAD NETA", v: r.utilidadNeta, bold: true, color: r.utilidadNeta >= 0 ? "text-emerald-700" : "text-red-600", line: true, big: true },
                    ].map((row, i) => {
                      if (row.spacer) return <tr key={i}><td colSpan={5} className="h-2"></td></tr>;
                      const perUd = row.v != null && r.unidades > 0 ? row.v / r.unidades : null;
                      const perM2 = row.v != null && r.m2Vendible > 0 ? row.v / r.m2Vendible : null;
                      const pctIng = row.v != null && r.ingresoTotal > 0 ? row.v / r.ingresoTotal : null;
                      return (
                        <tr key={i} className={`${row.line ? "border-t border-slate-300" : ""} ${row.bold ? "font-bold" : "text-slate-600"} ${row.color || ""}`}>
                          <td className={`p-1.5 text-left ${row.header ? "pt-2" : ""}`}>{row.l}</td>
                          <td className="p-1.5 text-right font-mono">{row.v != null ? fmtUSD(row.v) : ""}</td>
                          <td className="p-1.5 text-right font-mono">{perUd != null && !row.header ? fmtUSD(perUd) : ""}</td>
                          <td className="p-1.5 text-right font-mono">{perM2 != null && !row.header ? fmt(perM2, 0) : ""}</td>
                          <td className="p-1.5 text-right font-mono">{pctIng != null && !row.header ? fmtPct(pctIng) : ""}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Usos y Fuentes de Capital */}
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">Usos y Fuentes de Capital</h3>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Usos — ¿En qué se necesita el dinero?</h4>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between px-2 py-1 text-slate-600"><span>Terreno</span><span className="flex gap-3 font-mono"><span className="text-slate-500 text-xs w-12 text-right">{r.costoTotal > 0 ? fmtPct(r.precioTerreno / r.costoTotal) : "—"}</span><span className="w-24 text-right">{fmtUSD(r.precioTerreno)}</span></span></div>
                    <div className="flex justify-between px-2 py-1 text-slate-600"><span>Construcción directa</span><span className="flex gap-3 font-mono"><span className="text-slate-500 text-xs w-12 text-right">{r.costoTotal > 0 ? fmtPct(r.costoConstruccion / r.costoTotal) : "—"}</span><span className="w-24 text-right">{fmtUSD(r.costoConstruccion)}</span></span></div>
                    <div className="flex justify-between px-2 py-1 text-slate-600"><span>Costos blandos</span><span className="flex gap-3 font-mono"><span className="text-slate-500 text-xs w-12 text-right">{r.costoTotal > 0 ? fmtPct(r.costoSoft / r.costoTotal) : "—"}</span><span className="w-24 text-right">{fmtUSD(r.costoSoft)}</span></span></div>
                    <div className="flex justify-between px-2 py-1 text-slate-600"><span>Comisión inmobiliaria</span><span className="flex gap-3 font-mono"><span className="text-slate-500 text-xs w-12 text-right">{r.costoTotal > 0 ? fmtPct(r.costoComision / r.costoTotal) : "—"}</span><span className="w-24 text-right">{fmtUSD(r.costoComision)}</span></span></div>
                    <div className="flex justify-between px-2 py-1 text-slate-600"><span>Publicidad y mercadeo</span><span className="flex gap-3 font-mono"><span className="text-slate-500 text-xs w-12 text-right">{r.costoTotal > 0 ? fmtPct(r.costoMarketing / r.costoTotal) : "—"}</span><span className="w-24 text-right">{fmtUSD(r.costoMarketing)}</span></span></div>
                    <div className="flex justify-between px-2 py-1 text-slate-600"><span>Contingencias</span><span className="flex gap-3 font-mono"><span className="text-slate-500 text-xs w-12 text-right">{r.costoTotal > 0 ? fmtPct(r.costoContingencias / r.costoTotal) : "—"}</span><span className="w-24 text-right">{fmtUSD(r.costoContingencias)}</span></span></div>
                    <div className="flex justify-between px-2 py-1 text-slate-600"><span>Intereses bancarios</span><span className="flex gap-3 font-mono"><span className="text-slate-500 text-xs w-12 text-right">{r.costoTotal > 0 ? fmtPct(r.intereses / r.costoTotal) : "—"}</span><span className="w-24 text-right">{fmtUSD(r.intereses)}</span></span></div>
                    <div className="flex justify-between px-2 py-1 text-slate-600"><span>Comisión bancaria</span><span className="flex gap-3 font-mono"><span className="text-slate-500 text-xs w-12 text-right">{r.costoTotal > 0 ? fmtPct(r.comisionBancaria / r.costoTotal) : "—"}</span><span className="w-24 text-right">{fmtUSD(r.comisionBancaria)}</span></span></div>
                    <div className="flex justify-between px-2 py-1.5 border-t border-slate-300 font-bold text-slate-800 mt-1 pt-1"><span>TOTAL USOS</span><span className="flex gap-3 font-mono"><span className="text-xs w-12 text-right">100%</span><span className="w-24 text-right">{fmtUSD(r.costoTotal)}</span></span></div>
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Fuentes — ¿De dónde sale el dinero?</h4>
                  {(() => { const totalFuentes = r.equityTotal + r.prestamo + r.preventas; return (
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between px-2 py-1 text-slate-600"><span>Aporte socio terreno</span><span className="flex gap-3 font-mono"><span className="text-slate-500 text-xs w-12 text-right">{totalFuentes > 0 ? fmtPct(r.precioTerreno / totalFuentes) : "—"}</span><span className="w-24 text-right">{fmtUSD(r.precioTerreno)}</span></span></div>
                    <div className="flex justify-between px-2 py-1 text-slate-600"><span>Aporte socio capital</span><span className="flex gap-3 font-mono"><span className="text-slate-500 text-xs w-12 text-right">{totalFuentes > 0 ? fmtPct(sup.equityCapital / totalFuentes) : "—"}</span><span className="w-24 text-right">{fmtUSD(sup.equityCapital)}</span></span></div>
                    <div className="flex justify-between px-2 py-1 text-slate-600 border-t border-slate-200 pt-1"><span className="font-semibold">Total equity (socios)</span><span className="flex gap-3 font-mono"><span className="text-slate-500 text-xs w-12 text-right font-semibold">{totalFuentes > 0 ? fmtPct(r.equityTotal / totalFuentes) : "—"}</span><span className="w-24 text-right font-semibold">{fmtUSD(r.equityTotal)}</span></span></div>
                    <div className="flex justify-between px-2 py-1 text-slate-600"><span>Préstamo bancario</span><span className="flex gap-3 font-mono"><span className="text-slate-500 text-xs w-12 text-right">{totalFuentes > 0 ? fmtPct(r.prestamo / totalFuentes) : "—"}</span><span className="w-24 text-right">{fmtUSD(r.prestamo)}</span></span></div>
                    <div className="flex justify-between px-2 py-1 text-slate-600"><span>Preventas cobradas durante construcción</span><span className="flex gap-3 font-mono"><span className="text-slate-500 text-xs w-12 text-right">{totalFuentes > 0 ? fmtPct(r.preventas / totalFuentes) : "—"}</span><span className="w-24 text-right">{fmtUSD(r.preventas)}</span></span></div>
                    <div className="flex justify-between px-2 py-1.5 border-t border-slate-300 font-bold text-slate-800 mt-1 pt-1"><span>TOTAL FUENTES</span><span className="flex gap-3 font-mono"><span className="text-xs w-12 text-right">100%</span><span className="w-24 text-right">{fmtUSD(totalFuentes)}</span></span></div>
                  </div>
                  ); })()}
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
                <MetricCard label="m² vendible/ud" value={r.m2PorUnidad} format="num" />
              </div>
              <p className="text-xs text-slate-500 mt-2 italic">m²/ud — Social: 50–80 | Medio: 80–120 | Premium: 120–200. Tamaño promedio por unidad, define segmento de mercado.</p>
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
          <PrintDisclaimer />
          </div>
        </div>

        {/* ═══ TAB: SENSIBILIDAD ═══ */}
        <div className="print-section" style={{ display: tab === "sensibilidad" ? "block" : "none" }}>
          <div className="print-header-bar" style={{display:"none"}}><div><span className="brand">ESTATE<span className="accent">is</span>REAL</span><span style={{marginLeft:"10px",fontSize:"8px",color:"#94a3b8"}}>Prefactibilidad Inmobiliaria v1.0</span></div><div className="project-info">{sup.proyecto && <><strong>{sup.proyecto}</strong> — {sup.ubicacion}<br/>{sup.fecha}</>}</div></div>
          {tier !== "pro" ? (
            <div className="relative">
              <div className="absolute inset-0 z-10 flex items-center justify-center" style={{backdropFilter:"blur(0px)"}}>
                <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-8 max-w-md mx-4 text-center">
                  <div className="text-4xl mb-3">🔒</div>
                  <h3 className="text-lg font-bold text-slate-800 mb-2">Tablas de Sensibilidad</h3>
                  <p className="text-sm text-slate-500 mb-4">Descubre cómo cambian tus resultados al variar costos, precios y condiciones del banco. Disponible en el plan Pro.</p>
                  <a href="/pricing" className="inline-block bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-3 rounded-xl transition text-sm">Cambiar a Pro — $25/mes</a>
                  <p className="text-xs text-slate-400 mt-3">7 tablas de sensibilidad 7x7 con semáforo visual</p>
                  <button onClick={() => setTab("resultados")} className="mt-3 text-sm text-blue-600 hover:text-blue-500 font-medium transition">← Volver a Resultados</button>
                </div>
              </div>
              <div className="space-y-4 pb-8 opacity-20 pointer-events-none select-none" style={{filter:"blur(4px)", maxHeight:"600px", overflow:"hidden"}}>
                <div className="bg-blue-50 rounded-lg border border-blue-200 p-3 text-sm text-blue-700">
                  <div className="flex items-center justify-between gap-4">
                    <div><strong>Contenido bloqueado</strong> — Cambia a Pro para ver las tablas de sensibilidad completas.</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
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
                <table className="w-full text-xs" style={{ tableLayout: "fixed" }}>
                  <thead>
                    <tr>
                      <th className="p-1.5 text-left bg-slate-100 text-slate-500" style={{ width: "13%" }}>Tasa ↓ \ Meses →</th>
                      {sensTirTasaDuracion.colLabels.map((l, i) => (
                        <th key={i} className={`p-1.5 text-center ${i === 3 ? "bg-blue-100 font-bold" : "bg-slate-100"}`}>{l}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sensTirTasaDuracion.grid.map((row, ri) => (
                      <tr key={ri}>
                        <td className={`p-1.5 font-medium ${ri === 3 ? "bg-blue-100 font-bold" : "bg-slate-50"} text-slate-600`}>
                          {sensTirTasaDuracion.rowLabels[ri]}
                        </td>
                        {row.map((v, ci) => (
                          <td key={ci} className={`p-1.5 text-center font-mono ${ri === 3 && ci === 3 ? "font-bold ring-2 ring-blue-400 rounded" : ""} ${v >= thresholds.tirMin ? "bg-emerald-200 text-emerald-800" : v >= thresholds.tirMin * 0.75 ? "bg-amber-200 text-amber-800" : "bg-red-200 text-red-800"}`}>
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
                <table className="w-full text-xs" style={{ tableLayout: "fixed" }}>
                  <thead>
                    <tr>
                      <th className="p-1.5 text-left bg-slate-100 text-slate-500" style={{ width: "13%" }}>Costo ↓ \ Prev. →</th>
                      {sensMargenPreventas.colLabels.map((l, i) => (
                        <th key={i} className={`p-1.5 text-center ${i === 3 ? "bg-blue-100 font-bold" : "bg-slate-100"}`}>{l}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sensMargenPreventas.grid.map((row, ri) => (
                      <tr key={ri}>
                        <td className={`p-1.5 font-medium ${ri === 3 ? "bg-blue-100 font-bold" : "bg-slate-50"} text-slate-600`}>
                          {sensMargenPreventas.rowLabels[ri]}
                        </td>
                        {row.map((v, ci) => (
                          <td key={ci} className={`p-1.5 text-center font-mono ${ri === 3 && ci === 3 ? "font-bold ring-2 ring-blue-400 rounded" : ""} ${v >= thresholds.margenMin ? "bg-emerald-200 text-emerald-800" : v >= thresholds.margenMin * 0.75 ? "bg-amber-200 text-amber-800" : "bg-red-200 text-red-800"}`}>
                            {fmtPct(v)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tabla 5: TIR vs % Preventas × Equity */}
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <h4 className="text-sm font-bold text-slate-700 mb-3">5. TIR — ¿Qué pasa si varían las preventas o si los socios ponen más capital?</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs" style={{ tableLayout: "fixed" }}>
                  <thead>
                    <tr>
                      <th className="p-1.5 text-left bg-slate-100 text-slate-500" style={{ width: "13%" }}>% Prev. ↓ \ Capital →</th>
                      {sensTirPreventas.colLabels.map((l, i) => (
                        <th key={i} className={`p-1.5 text-center ${i === 3 ? "bg-blue-100 font-bold" : "bg-slate-100"}`}>{l}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sensTirPreventas.grid.map((row, ri) => (
                      <tr key={ri}>
                        <td className={`p-1.5 font-medium ${ri === 3 ? "bg-blue-100 font-bold" : "bg-slate-50"} text-slate-600`}>
                          {sensTirPreventas.rowLabels[ri]}
                        </td>
                        {row.map((v, ci) => (
                          <td key={ci} className={`p-1.5 text-center font-mono ${ri === 3 && ci === 3 ? "font-bold ring-2 ring-blue-400 rounded" : ""} ${v >= thresholds.tirMin ? "bg-emerald-200 text-emerald-800" : v >= thresholds.tirMin * 0.75 ? "bg-amber-200 text-amber-800" : "bg-red-200 text-red-800"}`}>
                            {fmtPct(v)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tabla 6: MOIC vs % Preventas × Equity (custom labels) */}
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <h4 className="text-sm font-bold text-slate-700 mb-3">6. MOIC — ¿Cuántas veces recuperan su dinero los socios según nivel de preventas y capital?</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs" style={{ tableLayout: "fixed" }}>
                  <thead>
                    <tr>
                      <th className="p-1.5 text-left bg-slate-100 text-slate-500" style={{ width: "13%" }}>% Prev. ↓ \ Capital →</th>
                      {sensMoicPreventas.colLabels.map((l, i) => (
                        <th key={i} className={`p-1.5 text-center ${i === 3 ? "bg-blue-100 font-bold" : "bg-slate-100"}`}>{l}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sensMoicPreventas.grid.map((row, ri) => (
                      <tr key={ri}>
                        <td className={`p-1.5 font-medium ${ri === 3 ? "bg-blue-100 font-bold" : "bg-slate-50"} text-slate-600`}>
                          {sensMoicPreventas.rowLabels[ri]}
                        </td>
                        {row.map((v, ci) => (
                          <td key={ci} className={`p-1.5 text-center font-mono ${ri === 3 && ci === 3 ? "font-bold ring-2 ring-blue-400 rounded" : ""} ${v >= thresholds.moicMin ? "bg-emerald-200 text-emerald-800" : v >= thresholds.moicMin * 0.85 ? "bg-amber-200 text-amber-800" : "bg-red-200 text-red-800"}`}>
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
                      <th className="p-1.5 text-center text-slate-500">Preventas</th>
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
                      const allGreen = row.ltv <= thresholds.ltvMax && row.ltc <= thresholds.ltcMax && row.cobertura >= 0.25 && row.tir >= thresholds.tirMin && row.moic >= thresholds.moicMin;
                      const optCell = "bg-emerald-400 text-slate-900 font-bold";
                      const normalCell = (good, marginal) => good ? "bg-emerald-200 text-emerald-800" : marginal ? "bg-amber-200 text-amber-800" : "bg-red-200 text-red-800";
                      return (
                        <tr key={i} className={isBase && !allGreen ? "bg-blue-50 font-bold" : ""}>
                          <td className={`p-1.5 text-center font-mono ${allGreen ? optCell : isBase ? "font-bold" : ""}`}>{fmtUSD(row.capital)}{allGreen ? " ✓" : ""}</td>
                          <td className={`p-1.5 text-center font-mono ${allGreen ? optCell : isBase ? "font-bold" : ""}`}>{fmtUSD(row.equityTotal)}</td>
                          <td className={`p-1.5 text-center font-mono ${allGreen ? optCell : isBase ? "font-bold" : ""}`}>{fmtUSD(row.preventas)}</td>
                          <td className={`p-1.5 text-center font-mono ${allGreen ? optCell : isBase ? "font-bold" : ""}`}>{fmtUSD(row.prestamo)}</td>
                          <td className={`p-1.5 text-center font-mono ${allGreen ? optCell : normalCell(row.ltv <= thresholds.ltvMax, row.ltv <= thresholds.ltvMax * 1.15)}`}>{fmtPct(row.ltv)}</td>
                          <td className={`p-1.5 text-center font-mono ${allGreen ? optCell : normalCell(row.ltc <= thresholds.ltcMax, row.ltc <= thresholds.ltcMax * 1.15)}`}>{fmtPct(row.ltc)}</td>
                          <td className={`p-1.5 text-center font-mono ${allGreen ? optCell : normalCell(row.cobertura >= 0.25, row.cobertura >= 0.15)}`}>{fmtPct(row.cobertura)}</td>
                          <td className={`p-1.5 text-center font-mono ${allGreen ? optCell : normalCell(row.tir >= thresholds.tirMin, row.tir >= thresholds.tirMin * 0.75)}`}>{fmtPct(row.tir)}</td>
                          <td className={`p-1.5 text-center font-mono ${allGreen ? optCell : normalCell(row.moic >= thresholds.moicMin, true)}`}>{row.moic.toFixed(3)}x</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-500 mt-2 italic">A menor capital, mayor TIR (mayor apalancamiento) pero mayor riesgo financiero (LTV/LTC más altos). Fila azul = escenario base actual. Filas verdes con ✓ = escenarios óptimos donde todos los parámetros cumplen los umbrales.</p>
            </div>
          <PrintDisclaimer />
          </div>
          )}
        </div>

        {/* ═══ TAB: ESCENARIOS ═══ */}
        <div className="print-section" style={{ display: tab === "escenarios" ? "block" : "none" }}>
          <div className="print-header-bar" style={{display:"none"}}><div><span className="brand">ESTATE<span className="accent">is</span>REAL</span><span style={{marginLeft:"10px",fontSize:"8px",color:"#94a3b8"}}>Prefactibilidad Inmobiliaria v1.0</span></div><div className="project-info">{sup.proyecto && <><strong>{sup.proyecto}</strong> — {sup.ubicacion}<br/>{sup.fecha}</>}</div></div>
          {tier !== "pro" ? (
            <div className="relative">
              <div className="absolute inset-0 z-10 flex items-center justify-center" style={{backdropFilter:"blur(0px)"}}>
                <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-8 max-w-md mx-4 text-center">
                  <div className="text-4xl mb-3">🔒</div>
                  <h3 className="text-lg font-bold text-slate-800 mb-2">Escenarios de Mercado</h3>
                  <p className="text-sm text-slate-500 mb-4">Evalúa cómo se comporta tu proyecto en 5 escenarios diferentes: desde pesimista hasta optimista. Disponible en el plan Pro.</p>
                  <a href="/pricing" className="inline-block bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-3 rounded-xl transition text-sm">Cambiar a Pro — $25/mes</a>
                  <p className="text-xs text-slate-400 mt-3">5 escenarios + punto de equilibrio detallado</p>
                  <button onClick={() => setTab("resultados")} className="mt-3 text-sm text-blue-600 hover:text-blue-500 font-medium transition">← Volver a Resultados</button>
                </div>
              </div>
              <div className="space-y-4 pb-8 opacity-20 pointer-events-none select-none" style={{filter:"blur(4px)", maxHeight:"600px", overflow:"hidden"}}>
                <div className="bg-blue-50 rounded-lg border border-blue-200 p-3 text-sm text-blue-700">
                  <div className="flex items-center justify-between gap-4">
                    <div><strong>Contenido bloqueado</strong> — Cambia a Pro para ver los escenarios de mercado completos.</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
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
                          <td className="p-2 text-center font-mono text-slate-700">{fmtUSD(e.ingresoTotal)}</td>
                          <td className="p-2 text-center font-mono text-slate-700">{fmtUSD(e.costoPreFinan)}</td>
                          <td className={`p-2 text-center font-mono font-bold ${e.utilidadNeta >= 0 ? "text-emerald-700" : "text-red-700"}`}>{fmtUSD(e.utilidadNeta)}</td>
                          <td className={`p-2 text-center font-mono ${e.margen >= thresholds.margenMin ? "bg-emerald-200 text-emerald-800" : e.margen >= thresholds.margenMin * 0.75 ? "bg-amber-200 text-amber-800" : "bg-red-200 text-red-800"}`}>{fmtPct(e.margen)}</td>
                          <td className={`p-2 text-center font-mono ${e.roi >= thresholds.roiMin ? "bg-emerald-200 text-emerald-800" : e.roi >= thresholds.roiMin * 0.75 ? "bg-amber-200 text-amber-800" : "bg-red-200 text-red-800"}`}>{fmtPct(e.roi)}</td>
                          <td className={`p-2 text-center font-mono ${e.moic >= thresholds.moicMin ? "bg-emerald-200 text-emerald-800" : e.moic >= thresholds.moicMin * 0.85 ? "bg-amber-200 text-amber-800" : "bg-red-200 text-red-800"}`}>{e.moic.toFixed(2)}x</td>
                          <td className={`p-2 text-center font-mono ${e.tir >= thresholds.tirMin ? "bg-emerald-200 text-emerald-800" : e.tir >= thresholds.tirMin * 0.75 ? "bg-amber-200 text-amber-800" : "bg-red-200 text-red-800"}`}>{fmtPct(e.tir)}</td>
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
          <PrintDisclaimer />
          </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="no-print bg-slate-800 text-slate-400 text-xs text-center py-3 mt-8">
        ESTATEisREAL — Prefactibilidad Inmobiliaria v1.0 | Motor de cálculo basado en metodología PE/VC | © Alejandro J. Fondeur M. 2026
      </div>

      {/* Modal de Feedback antes de imprimir */}
      {showFeedback && (
        <div className="no-print fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6">
            <div className="text-center mb-5">
              <span className="text-base font-black tracking-widest text-slate-800" style={{letterSpacing:"0.15em"}}>ESTATE<span className="text-blue-500">is</span>REAL</span>
              <p className="text-sm text-slate-500 mt-2">Antes de imprimir, ayúdanos con 3 preguntas rápidas para mejorar la herramienta.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">1. ¿Qué tan útil te resultó este análisis?</label>
                <div className="flex gap-2">
                  {["Muy útil", "Útil", "Regular", "Poco útil"].map(opt => (
                    <button key={opt} onClick={() => setFeedback1(opt)}
                      className={`flex-1 px-2 py-2 text-xs rounded-lg border transition ${feedback1 === opt ? "bg-blue-600 text-white border-blue-600" : "bg-slate-50 text-slate-600 border-slate-200 hover:border-blue-300"}`}>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">2. ¿Qué te gustaría que agregáramos?</label>
                <div className="flex flex-wrap gap-2">
                  {["Flujo de caja mensual", "Comparar proyectos", "Gráficos visuales", "Más escenarios", "Otro"].map(opt => (
                    <button key={opt} onClick={() => { setFeedback2(opt); if (opt !== "Otro") setFeedbackOtro(""); }}
                      className={`px-3 py-2 text-xs rounded-lg border transition ${feedback2 === opt ? "bg-blue-600 text-white border-blue-600" : "bg-slate-50 text-slate-600 border-slate-200 hover:border-blue-300"}`}>
                      {opt}
                    </button>
                  ))}
                </div>
                {feedback2 === "Otro" && (
                  <input
                    type="text"
                    value={feedbackOtro}
                    onChange={(e) => setFeedbackOtro(e.target.value)}
                    placeholder="Escribe tu sugerencia..."
                    className="mt-2 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                    autoFocus
                  />
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">3. Si esta herramienta fuera de pago, ¿qué modelo preferirías?</label>
                <div className="flex flex-wrap gap-2">
                  {["Mensualidad ($25/mes)", "Pago por análisis ($5-10)", "Ambas opciones", "No pagaría"].map(opt => (
                    <button key={opt} onClick={() => setFeedback3(opt)}
                      className={`px-3 py-2 text-xs rounded-lg border transition ${feedback3 === opt ? "bg-blue-600 text-white border-blue-600" : "bg-slate-50 text-slate-600 border-slate-200 hover:border-blue-300"}`}>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={skipFeedbackAndPrint}
                className="flex-1 px-4 py-2.5 text-sm text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg transition">
                Omitir
              </button>
              <button onClick={submitFeedbackAndPrint}
                className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition">
                Enviar e Imprimir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
