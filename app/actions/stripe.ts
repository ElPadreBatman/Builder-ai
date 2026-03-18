"use server"

import { stripe } from "@/lib/stripe"
import { getPriceId, TRIAL_DAYS, type PlanType, type BillingInterval } from "@/lib/subscription"
import { createClient, createAdminClient } from "@/lib/supabase/server"

/**
 * Creates or updates a user profile after signup.
 * Uses admin client (service role) to bypass RLS since user session is not yet established.
 */
export async function createProfileAfterSignup(data: {
  userId: string
  email: string
  firstName: string
  lastName: string
  company?: string
  role?: string
  planId: string
}) {
  // Use admin client to bypass RLS - user session not available yet after signup
  const supabase = createAdminClient()
  
  const profileData = {
    id: data.userId,
    email: data.email,
    first_name: data.firstName,
    last_name: data.lastName,
    company: data.company || null,
    role: data.role || "admin",
    subscription_status: "trialing",
    subscription_type: data.planId,
    trial_end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  }

  const { error } = await supabase
    .from("profiles")
    .upsert(profileData, { onConflict: "id" })

  if (error) {
    console.error("[v0] Profile creation error:", error)
    throw new Error(`Failed to create profile: ${error.message}`)
  }

  return { success: true }
}

export async function createCheckoutSession(
  planId: PlanType,
  interval: BillingInterval
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    throw new Error("You must be logged in to subscribe")
  }

  const priceId = getPriceId(planId, interval)
  if (!priceId) {
    throw new Error("Invalid plan or pricing")
  }

  // Get or create Stripe customer
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id, email, first_name, last_name")
    .eq("id", user.id)
    .single()

  let customerId = profile?.stripe_customer_id

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: profile?.email || user.email,
      name: profile ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() : undefined,
      metadata: { supabase_user_id: user.id },
    })
    customerId = customer.id

    await supabase
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", user.id)
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: TRIAL_DAYS,
      metadata: { supabase_user_id: user.id, plan_id: planId },
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/pricing?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/pricing?canceled=true`,
    metadata: { supabase_user_id: user.id, plan_id: planId },
  })

  return { url: session.url }
}

/**
 * Creates a Stripe checkout session for a newly registered user.
 * Called right after signup when the user selected a paid plan.
 */
export async function createCheckoutSessionAfterSignup(
  userId: string,
  email: string,
  fullName: string,
  planId: PlanType,
  interval: BillingInterval
) {
  const priceId = getPriceId(planId, interval)
  if (!priceId) {
    throw new Error("Invalid plan or pricing")
  }

  // Create Stripe customer for new user
  const customer = await stripe.customers.create({
    email,
    name: fullName || undefined,
    metadata: { supabase_user_id: userId },
  })

  // Save customer ID to profile
  const supabase = await createClient()
  await supabase
    .from("profiles")
    .update({ stripe_customer_id: customer.id })
    .eq("id", userId)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

  const session = await stripe.checkout.sessions.create({
    customer: customer.id,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: TRIAL_DAYS,
      metadata: { supabase_user_id: userId, plan_id: planId },
    },
    success_url: `${appUrl}/chat?subscribed=true`,
    cancel_url: `${appUrl}/chat`,
    metadata: { supabase_user_id: userId, plan_id: planId },
  })

  return { url: session.url }
}

export async function createCustomerPortalSession() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    throw new Error("You must be logged in")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single()

  if (!profile?.stripe_customer_id) {
    throw new Error("No subscription found")
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/profile`,
  })

  return { url: session.url }
}

export async function getSubscriptionStatus() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return null
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_status, subscription_type, subscription_end_date, trial_end_date, stripe_customer_id")
    .eq("id", user.id)
    .single()

  return profile
}
