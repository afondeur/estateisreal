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
    if (!stripe) {
      return Response.json({ error: "Stripe no está configurado" }, { status: 503 });
    }

    const { email, userId } = await req.json();

    if (!email || !userId) {
      return Response.json({ error: "Faltan datos del usuario" }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      metadata: {
        userId,
        email,
      },
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://estateisreal.com"}/cuenta?plan=pro&success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://estateisreal.com"}/pricing?canceled=true`,
    });

    return Response.json({ url: session.url });
  } catch (err) {
    console.error("Error creando sesión de checkout:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
