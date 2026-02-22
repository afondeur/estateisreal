import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
  : null;

export async function POST(req) {
  try {
    if (!stripe || !supabase) {
      return Response.json({ error: "Servicio no disponible" }, { status: 503 });
    }

    const { email, userId } = await req.json();

    if (!email || !userId) {
      return Response.json({ error: "Faltan datos" }, { status: 400 });
    }

    // Buscar al customer en Stripe por email
    const customers = await stripe.customers.list({ email, limit: 1 });

    if (customers.data.length === 0) {
      return Response.json({ tier: "free", reason: "No customer found" });
    }

    const customer = customers.data[0];

    // Buscar suscripciones activas
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: "active",
      limit: 1,
    });

    if (subscriptions.data.length > 0) {
      // Tiene suscripción activa → actualizar a pro en Supabase
      const sub = subscriptions.data[0];

      const { error } = await supabase
        .from("profiles")
        .update({
          tier: "pro",
          stripe_customer_id: customer.id,
          stripe_subscription_id: sub.id,
        })
        .eq("id", userId);

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
