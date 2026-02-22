"use client";
import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analysisCount, setAnalysisCount] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem("eir_user");
    if (saved) {
      try { setUser(JSON.parse(saved)); } catch {}
    }
    const count = localStorage.getItem("eir_analysis_count");
    const month = localStorage.getItem("eir_analysis_month");
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${now.getMonth()}`;
    if (month === currentMonth && count) {
      setAnalysisCount(parseInt(count) || 0);
    } else {
      localStorage.setItem("eir_analysis_month", currentMonth);
      localStorage.setItem("eir_analysis_count", "0");
      setAnalysisCount(0);
    }
    setLoading(false);
  }, []);

  const login = (email, name) => {
    const u = { email, name, plan: "free", createdAt: new Date().toISOString() };
    setUser(u);
    localStorage.setItem("eir_user", JSON.stringify(u));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("eir_user");
  };

  const upgradePlan = () => {
    if (!user) return;
    const updated = { ...user, plan: "premium" };
    setUser(updated);
    localStorage.setItem("eir_user", JSON.stringify(updated));
  };

  const incrementAnalysis = () => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${now.getMonth()}`;
    const savedMonth = localStorage.getItem("eir_analysis_month");
    let newCount;
    if (savedMonth !== currentMonth) {
      newCount = 1;
      localStorage.setItem("eir_analysis_month", currentMonth);
    } else {
      newCount = analysisCount + 1;
    }
    setAnalysisCount(newCount);
    localStorage.setItem("eir_analysis_count", String(newCount));
  };

  const canAnalyze = () => {
    if (!user) return true;
    if (user.plan === "premium") return true;
    return analysisCount < 3;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, upgradePlan, analysisCount, incrementAnalysis, canAnalyze }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
