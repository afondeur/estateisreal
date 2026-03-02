import { createSupabaseServerClient, createSupabaseAdminClient } from "../../../../lib/supabase-server";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request, { params }) {
  try {
    const { token } = await params;

    if (!token || !UUID_REGEX.test(token)) {
      return Response.json({ error: "Token inválido" }, { status: 400 });
    }

    // Verify authenticated user
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json({ error: "No autenticado" }, { status: 401 });
    }

    // Find project by share_token (admin client bypasses RLS)
    const admin = createSupabaseAdminClient();
    const { data: project, error: findError } = await admin
      .from("proyectos")
      .select("*")
      .eq("share_token", token)
      .single();

    if (findError || !project) {
      return Response.json({ error: "Proyecto no encontrado o link inválido" }, { status: 404 });
    }

    // If the user is the owner, don't clone
    if (project.user_id === user.id) {
      return Response.json({ cloned: false, message: "Este proyecto ya es tuyo" });
    }

    // Clone the project for the current user (without share_token)
    const { data: cloned, error: cloneError } = await admin
      .from("proyectos")
      .insert({
        user_id: user.id,
        nombre: `Copia de ${project.nombre}`,
        supuestos: project.supuestos,
        mix: project.mix,
        thresholds: project.thresholds,
      })
      .select("id, nombre")
      .single();

    if (cloneError) {
      console.error("share/clone error:", cloneError);
      return Response.json({ error: "Error al clonar el proyecto" }, { status: 500 });
    }

    return Response.json({
      cloned: true,
      projectId: cloned.id,
      nombre: cloned.nombre,
      message: `Proyecto "${cloned.nombre}" copiado exitosamente a tu cuenta`,
    });
  } catch (err) {
    console.error("share route error:", err);
    return Response.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
