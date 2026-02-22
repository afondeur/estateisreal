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
  console.log("🔔 Webhook recibido");
  console.log("Stripe configurado:", !!stripe);
  console.log("Supabase configurado:", !!supabase);

  if (!stripe) {
    console.error("❌ Stripe no configurado - falta STRIPE_SECRET_KEY");
    return Response.json({ error: "Stripe no configurado" }, { status: 503 });
  }

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    console.log("✅ Firma webhook verificada. Tipo:", event.type);
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const userId = session.metadata?.userId;
      const email = session.metadata?.email;
      const customerId = session.customer;
      const subscriptionId = session.subscription;

      console.log("📦 checkout.session.completed:", {
        userId,
        email,
        customerId,
        subscriptionId,
        hasSupabase: !!supabase,
      });

      if (!userId) {
        console.error("❌ No hay userId en metadata de la sesión");
        break;
      }

      if (!supabase) {
        console.error("❌ Supabase no configurado - falta SUPABASE_SERVICE_ROLE_KEY");
        break;
      }

      const { data, error } = await supabase
        .from("profiles")
        .update({
          tier: "pro",
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
        })
        .eq("id", userId)
        .select();

      if (error) {
        console.error("❌ Error actualizando perfil:", error);
      } else {
        console.log(`✅ Usuario ${email} actualizado a PRO. Rows:`, data?.length);
      }
      break;
    }

    case "customer.subscription.deleted":
    case "customer.subscription.updated": {
      const subscription = event.data.object;
      const customerId = subscription.customer;
      const status = subscription.status;

      console.log("📦 subscription event:", { customerId, status });

      if (supabase && customerId) {
        if (status === "canceled" || status === "unpaid" || status === "past_due") {
          const { error } = await supabase
            .from("profiles")
            .update({ tier: "free" })
            .eq("stripe_customer_id", customerId);

          if (error) console.error("❌ Error downgrade:", error);
          else console.log(`⚠️ Suscripción ${status} → free`);
        } else if (status === "active") {
          const { error } = await supabase
            .from("profiles")
            .update({ tier: "pro" })
            .eq("stripe_customer_id", customerId);

          if (error) console.error("❌ Error reactivación:", error);
          else console.log(`✅ Suscripción reactivada → pro`);
        }
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object;
      console.log(`❌ Pago fallido para customer ${invoice.customer}`);
      break;
    }

    default:
      console.log("ℹ️ Evento no manejado:", event.type);
      break;
  }

  return Response.json({ received: true });
}
