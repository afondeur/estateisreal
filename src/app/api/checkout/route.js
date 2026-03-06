import Stripe from "stripe";
import { createSupabaseServerClient } from "../../../lib/supabase-server";
import { rateLimit } from "../../../lib/rate-limit";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export async function POST(request) {
  try {
    // H3: Rate limit — 5 req/min
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const rl = rateLimit(ip, 5, 60_000);
    if (!rl.allowed) {
      return Response.json({ error: "Too many requests" }, { status: 429 });
    }

    // Authenticate from cookies — never trust the request body
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json({ error: "No autenticado" }, { status: 401 });
    }

    if (!stripe) {
      return Response.json({ error: "Stripe no está configurado" }, { status: 503 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: user.email,
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      metadata: {
        userId: user.id,
        email: user.email,
      },
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://estateisreal.com"}/cuenta?plan=pro&success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://estateisreal.com"}/pricing?canceled=true`,
    });

    return Response.json({ url: session.url });
  } catch (err) {
    console.error("Error creando sesión de checkout:", err);
    return Response.json({ error: "Error al iniciar el pago" }, { status: 500 });
  }
}
