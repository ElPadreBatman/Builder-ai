import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import Stripe from "stripe"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-01-27.acacia",
})

/**
 * Creates a Stripe customer and returns the customer ID.
 * Returns null on failure without throwing.
 */
async function createStripeCustomer(params: {
  email: string
  name: string
  userId: string
  company?: string
}): Promise<string | null> {
  try {
    const customer = await stripe.customers.create({
      email: params.email,
      name: params.name,
      metadata: {
        supabase_user_id: params.userId,
        company: params.company || "",
      },
    })
    console.log("[auth/callback] Stripe customer created:", customer.id, "for user:", params.userId)
    return customer.id
  } catch (err: any) {
    console.error("[auth/callback] Stripe customer creation failed:", err.message, "for user:", params.userId)
    return null
  }
}

/**
 * Ensures the user profile is complete in Supabase and that a Stripe customer exists.
 * The DB trigger creates the profile automatically, but without stripe_customer_id.
 * This function fills in the gap.
 */
async function ensureUserSetup(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: { id: string; email?: string; user_metadata?: Record<string, any> }
): Promise<{ isNewUser: boolean }> {
  const email = user.email ?? ""
  const meta = user.user_metadata ?? {}
  const fullName = meta.full_name || meta.name || ""

  // 1. Check current profile state
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, stripe_customer_id, subscription_type, trial_end_date")
    .eq("id", user.id)
    .single()

  console.log("[auth/callback] Profile check:", {
    userId: user.id,
    profileExists: !!profile,
    hasStripeId: !!profile?.stripe_customer_id,
    profileError: profileError?.message,
  })

  // 2. If profile doesn't exist at all (trigger may have failed), create it
  if (!profile) {
    console.log("[auth/callback] Profile missing — creating manually")

    const stripeCustomerId = await createStripeCustomer({
      email,
      name: fullName,
      userId: user.id,
      company: meta.company || email.split("@")[1] || "",
    })

    const { error: insertError } = await supabase.from("profiles").insert({
      id: user.id,
      email,
      full_name: fullName,
      first_name: meta.first_name || fullName.split(" ")[0] || "",
      last_name: meta.last_name || fullName.split(" ").slice(1).join(" ") || "",
      company: meta.company || email.split("@")[1] || "default",
      phone: meta.phone || "",
      role: meta.role || "admin",
      specialty: meta.specialty || "general",
      subscription_status: "trialing",
      subscription_type: meta.plan || "free",
      trial_end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      stripe_customer_id: stripeCustomerId,
    })

    if (insertError) {
      console.error("[auth/callback] Profile insert failed:", insertError.message)
    } else {
      console.log("[auth/callback] Profile created with stripe_customer_id:", stripeCustomerId)
    }

    return { isNewUser: true }
  }

  // 3. Profile exists but no Stripe customer → create Stripe customer and update profile
  if (!profile.stripe_customer_id) {
    console.log("[auth/callback] Profile exists but missing stripe_customer_id — creating Stripe customer")

    const stripeCustomerId = await createStripeCustomer({
      email,
      name: fullName,
      userId: user.id,
      company: meta.company || "",
    })

    if (stripeCustomerId) {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("id", user.id)

      if (updateError) {
        console.error("[auth/callback] Failed to update profile with stripe_customer_id:", updateError.message)
      } else {
        console.log("[auth/callback] Profile updated with stripe_customer_id:", stripeCustomerId)
      }
    }

    // Still treat as new user if subscription/trial not yet set
    const hasSubscription = !!profile.trial_end_date
    return { isNewUser: !hasSubscription }
  }

  // 4. Profile exists with Stripe customer — returning user
  console.log("[auth/callback] User fully set up, stripe_customer_id:", profile.stripe_customer_id)
  return { isNewUser: false }
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const token_hash = requestUrl.searchParams.get("token_hash")
  const type = requestUrl.searchParams.get("type")
  const next = requestUrl.searchParams.get("next") ?? "/dashboard"

  const supabase = await createClient()

  // ─── Email confirmation via token_hash ───────────────────────────────────
  if (token_hash && type) {
    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as "signup" | "email" | "recovery" | "invite" | "magiclink" | "email_change",
    })

    if (verifyError) {
      console.error("[auth/callback] Token verification error:", verifyError.message)
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(verifyError.message)}`, requestUrl.origin)
      )
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      console.error("[auth/callback] No user after token verification")
      return NextResponse.redirect(new URL("/login?error=auth_failed", requestUrl.origin))
    }

    // Must change password flow
    if (user.user_metadata?.must_change_password) {
      return NextResponse.redirect(new URL("/change-password", requestUrl.origin))
    }

    const { isNewUser } = await ensureUserSetup(supabase, user)

    // New users → onboarding, returning users → dashboard/next
    if (isNewUser) {
      return NextResponse.redirect(new URL("/onboarding", requestUrl.origin))
    }

    return NextResponse.redirect(new URL(next, requestUrl.origin))
  }

  // ─── OAuth callback via code ─────────────────────────────────────────────
  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      console.error("[auth/callback] OAuth code exchange error:", exchangeError.message)
      return NextResponse.redirect(new URL("/login?error=auth_failed", requestUrl.origin))
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      console.error("[auth/callback] No user after OAuth exchange")
      return NextResponse.redirect(new URL("/login?error=auth_failed", requestUrl.origin))
    }

    if (user.user_metadata?.must_change_password) {
      return NextResponse.redirect(new URL("/change-password", requestUrl.origin))
    }

    const { isNewUser } = await ensureUserSetup(supabase, user)

    if (isNewUser) {
      return NextResponse.redirect(new URL("/onboarding", requestUrl.origin))
    }

    return NextResponse.redirect(new URL(next, requestUrl.origin))
  }

  return NextResponse.redirect(new URL("/login?error=auth_failed", requestUrl.origin))
}
