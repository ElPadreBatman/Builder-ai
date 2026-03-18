import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { createClient } from "@supabase/supabase-js"
import { GRACE_PERIOD_DAYS, STRIPE_PRODUCTS } from "@/lib/subscription"
import Stripe from "stripe"

// Use service role for webhook operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const body = await req.text()
  const headersList = await headers()
  const signature = headersList.get("stripe-signature")

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    // For sandbox mode, we might not have a webhook secret
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } else {
      // In development/sandbox, parse event directly
      event = JSON.parse(body) as Stripe.Event
    }
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message)
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutComplete(session)
        break
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionUpdate(subscription)
        break
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionDeleted(subscription)
        break
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice
        await handlePaymentSucceeded(invoice)
        break
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice
        await handlePaymentFailed(invoice)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error("Webhook handler error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.supabase_user_id
  const planId = session.metadata?.plan_id
  const customerId = session.customer as string
  const subscriptionId = session.subscription as string

  if (!userId) {
    console.error("No user ID in checkout session metadata")
    return
  }

  // Update profile with subscription info
  await supabase.from("profiles").update({
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    subscription_type: planId || "base",
    subscription_status: "trialing",
  }).eq("id", userId)
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string
  
  // Find user by customer ID
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .single()

  if (!profile) {
    console.error("No profile found for customer:", customerId)
    return
  }

  // Determine plan type from price
  const priceId = subscription.items.data[0]?.price.id
  const productId = subscription.items.data[0]?.price.product as string
  let planType = "base"
  
  if (productId === STRIPE_PRODUCTS.PRO) {
    planType = "pro"
  } else if (productId === STRIPE_PRODUCTS.BASE) {
    planType = "base"
  }

  // Update subscription status
  await supabase.from("profiles").update({
    subscription_status: subscription.status,
    subscription_type: planType,
    stripe_subscription_id: subscription.id,
    subscription_end_date: subscription.current_period_end 
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null,
    trial_end_date: subscription.trial_end
      ? new Date(subscription.trial_end * 1000).toISOString()
      : null,
  }).eq("id", profile.id)
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string
  
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .single()

  if (!profile) return

  // Downgrade to free plan
  await supabase.from("profiles").update({
    subscription_status: "canceled",
    subscription_type: "free",
    stripe_subscription_id: null,
    subscription_end_date: new Date().toISOString(),
  }).eq("id", profile.id)
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string
  
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .single()

  if (!profile) return

  // Reset monthly usage on successful payment
  await supabase.from("profiles").update({
    subscription_status: "active",
    soumissions_this_month: 0,
    usage_reset_date: new Date().toISOString(),
  }).eq("id", profile.id)
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string
  
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, subscription_status")
    .eq("stripe_customer_id", customerId)
    .single()

  if (!profile) return

  // Mark as past_due
  await supabase.from("profiles").update({
    subscription_status: "past_due",
  }).eq("id", profile.id)

  // Schedule cancellation after grace period
  // In a production app, you'd use a job queue or Stripe's built-in dunning
  console.log(`Payment failed for user ${profile.id}. Grace period: ${GRACE_PERIOD_DAYS} days`)
}
