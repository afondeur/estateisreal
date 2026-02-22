"use client";
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext(null);

// Emails con acceso Premium automático (administradores)
const ADMIN_EMAILS = [
  "afondeur@gmail.com",
  "afondeur@merafondeur.com",
];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  async function fetchProfile(userId) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (data) setProfile(data);
    return data;
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) fetchProfile(u.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) fetchProfile(u.id);
      else setProfile(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Login con email + password
  const login = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error };
    return { data };
  }, []);

  // Registro con email + password + nombre
  const signUp = useCallback(async (email, password, nombre, empresa) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error };
    // Actualizar perfil con nombre y empresa
    if (data.user) {
      const isAdmin = ADMIN_EMAILS.includes(email.toLowerCase().trim());
      await supabase.from("profiles").update({
        nombre,
        empresa,
        tier: isAdmin ? "pro" : "free",
      }).eq("id", data.user.id);
    }
    return { data };
  }, []);

  // Login con Google
  const loginWithGoogle = useCallback(async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    return { data, error };
  }, []);

  // Logout
  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }, []);

  // Tracking de eventos
  const trackEvent = useCallback(async (eventType, eventData = {}) => {
    try {
      await supabase.from("analytics_events").insert({
        user_id: user?.id || null,
        event_type: eventType,
        event_data: eventData,
      });
    } catch (e) {
      console.log("Track event error:", e);
    }
  }, [user]);

  // Guardar feedback
  const saveFeedback = useCallback(async (proyecto, pregunta1, pregunta2) => {
    try {
      await supabase.from("feedback").insert({
        user_id: user?.id || null,
        email: user?.email || null,
        proyecto,
        pregunta_1: pregunta1,
        pregunta_2: pregunta2,
      });
    } catch (e) {
      console.log("Save feedback error:", e);
    }
  }, [user]);

  // Tier del usuario
  const tier = profile?.tier || "free";
  const isAdmin = user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase().trim());

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      login,
      signUp,
      loginWithGoogle,
      logout,
      trackEvent,
      saveFeedback,
      tier: isAdmin ? "pro" : tier,
      isAdmin,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
