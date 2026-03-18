import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { incrementSoumissionUsage, checkSubscriptionStatus } from "@/lib/subscription-check"

// GET /api/soumissions?conversationId=xxx
// Returns all soumission versions for a conversation
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const conversationId = searchParams.get("conversationId")

  if (!conversationId) {
    return NextResponse.json({ error: "conversationId requis" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("soumissions")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching soumissions:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ soumissions: data })
}

// POST /api/soumissions
// Save or update a soumission for a conversation
// Supports two modes:
//   - newVersion: true  -> always creates a new row (explicit "save as version")
//   - newVersion: false (default) -> upserts the latest draft row
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 })
  }

  const body = await request.json()
  const { conversationId, soumission, status, newVersion } = body

  if (!conversationId || !soumission) {
    return NextResponse.json({ error: "conversationId et soumission requis" }, { status: 400 })
  }

  // Get user's company
  const { data: profile } = await supabase
    .from("profiles")
    .select("company")
    .eq("id", user.id)
    .single()

  // Check if this is a NEW soumission (not an update to existing one)
  const { data: existingForConv } = await supabase
    .from("soumissions")
    .select("id")
    .eq("conversation_id", conversationId)
    .limit(1)
    .single()

  const isFirstSoumissionForConversation = !existingForConv

  // If this is a brand new soumission, check subscription and increment usage
  if (isFirstSoumissionForConversation) {
    const subscriptionStatus = await checkSubscriptionStatus()
    
    if (!subscriptionStatus.canCreateSoumission) {
      return NextResponse.json({ 
        error: subscriptionStatus.message || "Limite de soumissions atteinte pour ce mois",
        limitReached: true 
      }, { status: 403 })
    }

    // Increment usage counter (uses subscription_usage table for accurate tracking)
    const incremented = await incrementSoumissionUsage(user.id)
    if (!incremented) {
      return NextResponse.json({ 
        error: "Limite de soumissions atteinte pour ce mois",
        limitReached: true 
      }, { status: 403 })
    }
  }

  // If explicitly saving as new version, always insert
  if (newVersion) {
    const { data, error } = await supabase
      .from("soumissions")
      .insert({
        conversation_id: conversationId,
        user_id: user.id,
        company: profile?.company || null,
        data: soumission,
        status: status || "brouillon",
      })
      .select()
      .single()

    if (error) {
      console.error("Error inserting soumission version:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ soumission: data })
  }

  // Default: upsert latest draft
  const { data: existing } = await supabase
    .from("soumissions")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  if (existing) {
    const { data, error } = await supabase
      .from("soumissions")
      .update({
        data: soumission,
        status: status || "brouillon",
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select()
      .single()

    if (error) {
      console.error("Error updating soumission:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ soumission: data })
  } else {
    const { data, error } = await supabase
      .from("soumissions")
      .insert({
        conversation_id: conversationId,
        user_id: user.id,
        company: profile?.company || null,
        data: soumission,
        status: status || "brouillon",
      })
      .select()
      .single()

    if (error) {
      console.error("Error inserting soumission:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ soumission: data })
  }
}
