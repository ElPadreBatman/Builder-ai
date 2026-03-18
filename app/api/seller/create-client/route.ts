import { createClient, createAdminClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import Stripe from "stripe"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-01-27.acacia",
})

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    
    // Check if caller is authenticated and is a seller/admin
    const { data: { user: caller } } = await supabase.auth.getUser()
    if (!caller) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .single()

    if (!callerProfile || !["seller", "admin"].includes(callerProfile.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
    }

    const body = await request.json()
    const { email, password, fullName, company, phone, plan, billingCycle, sellerId, invitationId, specialty } = body

    if (!email || !password || !fullName || !company) {
      return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 })
    }

    // Use admin client to create user with service role (bypasses email confirmation)
    const adminClient = createAdminClient()
    
    // Create user via admin API - this creates a confirmed user immediately
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Skip email verification for seller-created accounts
      user_metadata: {
        full_name: fullName,
        first_name: fullName.split(" ")[0],
        last_name: fullName.split(" ").slice(1).join(" "),
        company,
        phone,
        specialty: specialty || "general",
        must_change_password: true, // Flag to force password change on first login
        created_by_seller: sellerId,
      },
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    if (!authData.user) {
      return NextResponse.json({ error: "Erreur lors de la création de l'utilisateur" }, { status: 500 })
    }

    // Create Stripe customer
    let stripeCustomerId: string | null = null
    try {
      console.log("[v0] Creating Stripe customer for:", email, "with fullName:", fullName)
      const stripeCustomer = await stripe.customers.create({
        email,
        name: fullName,
        metadata: {
          supabase_user_id: authData.user.id,
          company,
          phone: phone || "",
          created_by_seller: sellerId || "",
        },
      })
      stripeCustomerId = stripeCustomer.id
      console.log("[v0] Stripe customer created successfully:", stripeCustomerId)
    } catch (stripeError: any) {
      console.error("[v0] Stripe customer creation FAILED with details:", {
        message: stripeError.message,
        code: stripeError.code,
        type: stripeError.type,
        status: stripeError.status,
        statusCode: stripeError.statusCode,
        email,
        fullName,
        stripeSecretKeyExists: !!process.env.STRIPE_SECRET_KEY,
      })
      // Stripe customer creation failed - still create user profile but without Stripe ID
      // This can be synced later via a separate script
    }

    // Create profile with Stripe customer ID
    const { error: profileError } = await supabase.from("profiles").insert({
      id: authData.user.id,
      email,
      full_name: fullName,
      company,
      phone,
      specialty: specialty || "general",
      role: "admin", // New client is admin of their own company
      subscription_status: "trialing",
      subscription_type: plan || "free",
      trial_end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      stripe_customer_id: stripeCustomerId,
    })

    if (profileError) {
      console.error("Profile creation error:", profileError)
    }

    // Track sale if seller exists
    if (sellerId) {
      const { data: seller } = await supabase
        .from("sellers")
        .select("id, commission_rate")
        .eq("user_id", sellerId)
        .single()

      if (seller) {
        const planPrices: Record<string, { monthly: number; yearly: number }> = {
          base: { monthly: 39.99, yearly: 31.99 },
          pro: { monthly: 69.99, yearly: 55.99 },
        }
        const price = planPrices[plan] || planPrices.base
        const amount = billingCycle === "yearly" ? price.yearly * 12 : price.monthly
        const commission = amount * (seller.commission_rate / 100)

        await supabase.from("sales").insert({
          seller_id: seller.id,
          invitation_id: invitationId,
          client_user_id: authData.user.id,
          plan_sold: plan,
          billing_cycle: billingCycle,
          amount,
          commission_amount: commission,
          status: "pending",
        })

        // Update seller stats
        await supabase
          .from("sellers")
          .update({ 
            total_sales: (seller as any).total_sales + 1,
            updated_at: new Date().toISOString()
          })
          .eq("id", seller.id)
      }
    }

    return NextResponse.json({ 
      success: true, 
      userId: authData.user.id,
      message: "Compte créé avec succès" 
    })

  } catch (error: any) {
    console.error("Create client error:", error)
    return NextResponse.json({ error: error.message || "Erreur serveur" }, { status: 500 })
  }
}
