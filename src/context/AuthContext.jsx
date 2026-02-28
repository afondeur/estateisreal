"use client";
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  async function fetchProfile(userId) {
    if (!supabase) return null;
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (data) setProfile(data);
    return data;
  }

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

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
    if (!supabase) return { error: { message: "Servicio no disponible" } };
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error };
    return { data };
  }, []);

  // Registro con email + password + nombre
  const signUp = useCallback(async (email, password, nombre, empresa) => {
    if (!supabase) return { error: { message: "Servicio no disponible" } };
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error };
    // Update profile with name and company (wait for trigger to create the profile)
    if (data.user) {
      await new Promise(r => setTimeout(r, 500));
      await supabase.from("profiles").update({
        nombre,
        empresa,
      }).eq("id", data.user.id);
      await fetchProfile(data.user.id);
    }
    return { data };
  }, []);

  // Login con Google
  const loginWithGoogle = useCallback(async () => {
    if (!supabase) return { error: { message: "Servicio no disponible" } };
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    return { data, error };
  }, []);

  // Logout
  const logout = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }, []);

  // Tracking de eventos
  const trackEvent = useCallback(async (eventType, eventData = {}) => {
    if (!supabase) return;
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
  const saveFeedback = useCallback(async (proyecto, pregunta1, pregunta2, pregunta3) => {
    if (!supabase) return;
    try {
      await supabase.from("feedback").insert({
        user_id: user?.id || null,
        email: user?.email || null,
        proyecto,
        pregunta_1: pregunta1,
        pregunta_2: pregunta2,
        pregunta_3: pregunta3 || null,
      });
    } catch (e) {
      console.log("Save feedback error:", e);
    }
  }, [user]);

  // Refrescar perfil manualmente (después de pago Stripe, etc.)
  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id);
  }, [user]);

  // ─── PROYECTOS ───
  // Guardar proyecto (crear o actualizar)
  const saveProject = useCallback(async (nombre, supuestos, mixData, thresholdsData, projectId = null) => {
    if (!supabase || !user) return { error: { message: "No autenticado" } };
    try {
      if (projectId) {
        // Actualizar existente
        const { data, error } = await supabase
          .from("proyectos")
          .update({ nombre, supuestos, mix: mixData, thresholds: thresholdsData, updated_at: new Date().toISOString() })
          .eq("id", projectId)
          .eq("user_id", user.id)
          .select()
          .single();
        return { data, error };
      } else {
        // Crear nuevo
        const { data, error } = await supabase
          .from("proyectos")
          .insert({ user_id: user.id, nombre, supuestos, mix: mixData, thresholds: thresholdsData })
          .select()
          .single();
        return { data, error };
      }
    } catch (e) {
      return { error: { message: e.message } };
    }
  }, [user]);

  // Listar proyectos del usuario
  const listProjects = useCallback(async () => {
    if (!supabase || !user) return { data: [], error: null };
    const { data, error } = await supabase
      .from("proyectos")
      .select("id, nombre, created_at, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    return { data: data || [], error };
  }, [user]);

  // Cargar un proyecto
  const loadProject = useCallback(async (projectId) => {
    if (!supabase || !user) return { data: null, error: { message: "No autenticado" } };
    const { data, error } = await supabase
      .from("proyectos")
      .select("*")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .single();
    return { data, error };
  }, [user]);

  // Eliminar un proyecto
  const deleteProject = useCallback(async (projectId) => {
    if (!supabase || !user) return { error: { message: "No autenticado" } };
    const { error } = await supabase
      .from("proyectos")
      .delete()
      .eq("id", projectId)
      .eq("user_id", user.id);
    return { error };
  }, [user]);

  // Tier and admin status — read exclusively from the database
  const isAdmin = profile?.is_admin === true;
  const tier = isAdmin ? "pro" : (profile?.tier || "free");

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
      refreshProfile,
      saveProject,
      listProjects,
      loadProject,
      deleteProject,
      tier,
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
