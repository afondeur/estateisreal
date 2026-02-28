import Stripe from "stripe";
import { createSupabaseServerClient, createSupabaseAdminClient } from "../../../lib/supabase-server";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export async function POST() {
  try {
    if (!stripe) {
      return Response.json({ error: "Servicio no disponible" }, { status: 503 });
    }

    // Authenticate from cookies — never trust the request body
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json({ error: "No autenticado" }, { status: 401 });
    }

    // Search Stripe customer by authenticated email
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });

    if (customers.data.length === 0) {
      return Response.json({ tier: "free", reason: "No customer found" });
    }

    const customer = customers.data[0];

    // Check for active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: "active",
      limit: 1,
    });

    if (subscriptions.data.length > 0) {
      const sub = subscriptions.data[0];

      // Use admin client to bypass RLS for profile update
      const adminClient = createSupabaseAdminClient();
      const { error } = await adminClient
        .from("profiles")
        .update({
          tier: "pro",
          stripe_customer_id: customer.id,
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
    return Response.json({ error: err.message }, { status: 500 });
  }
}
