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
  if (!stripe) {
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
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const userId = session.metadata?.userId;
      const email = session.metadata?.email;
      const customerId = session.customer;
      const subscriptionId = session.subscription;

      if (userId && supabase) {
        await supabase
          .from("profiles")
          .update({
            tier: "pro",
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
          })
          .eq("id", userId);

        console.log(`✅ Usuario ${email} actualizado a PRO`);
      }
      break;
    }

    case "customer.subscription.deleted":
    case "customer.subscription.updated": {
      const subscription = event.data.object;
      const customerId = subscription.customer;
      const status = subscription.status;

      if (supabase && customerId) {
        if (status === "canceled" || status === "unpaid" || status === "past_due") {
          await supabase
            .from("profiles")
            .update({ tier: "free" })
            .eq("stripe_customer_id", customerId);

          console.log(`⚠️ Suscripción ${status} para customer ${customerId} → free`);
        } else if (status === "active") {
          await supabase
            .from("profiles")
            .update({ tier: "pro" })
            .eq("stripe_customer_id", customerId);

          console.log(`✅ Suscripción reactivada para customer ${customerId} → pro`);
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
      break;
  }

  return Response.json({ received: true });
}
