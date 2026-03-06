import Stripe from "stripe";
import { createSupabaseServerClient, createSupabaseAdminClient } from "../../../lib/supabase-server";
import { rateLimit } from "../../../lib/rate-limit";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export async function POST(request) {
  try {
    // H3: Rate limit — 10 req/min
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const rl = rateLimit(ip, 10, 60_000);
    if (!rl.allowed) {
      return Response.json({ error: "Too many requests" }, { status: 429 });
    }

    if (!stripe) {
      return Response.json({ error: "Servicio no disponible" }, { status: 503 });
    }

    // Authenticate from cookies — never trust the request body
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json({ error: "No autenticado" }, { status: 401 });
    }

    // Look up stripe_customer_id from the user's profile (trusted DB, not email search)
    const adminClient = createSupabaseAdminClient();
    const { data: profile } = await adminClient
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .single();

    if (!profile?.stripe_customer_id) {
      return Response.json({ tier: "free", reason: "No customer found" });
    }

    const customerId = profile.stripe_customer_id;

    // Check for active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    if (subscriptions.data.length > 0) {
      const sub = subscriptions.data[0];

      // Use admin client to bypass RLS for profile update
      const { error } = await adminClient
        .from("profiles")
        .update({
          tier: "pro",
          stripe_customer_id: customerId,
          stripe_subscription_id: sub.id,
        })
        .eq("id", user.id);

      if (error) {
        console.error("verify-payment: Error actualizando perfil:", error);
        return Response.json({ error: "Error actualizando perfil" }, { status: 500 });
      }

      return Response.json({ tier: "pro", updated: true });
    }

    return Response.json({ tier: "free", reason: "No active subscription" });
  } catch (err) {
    console.error("verify-payment error:", err);
    return Response.json({ error: "Error al verificar el pago" }, { status: 500 });
  }
}
