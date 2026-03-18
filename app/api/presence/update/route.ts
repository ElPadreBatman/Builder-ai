import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const isOffline = body.offline === true
    const conversationId = body.conversationId ?? null
    const isTyping = body.isTyping ?? false

    // Validate conversation exists if provided
    if (!isOffline && conversationId) {
      const { data: conversationData, error: convError } = await supabase
        .from("conversations")
        .select("id")
        .eq("id", conversationId)
        .single()

      if (convError || !conversationData) {
        console.warn(`[v0] Conversation ${conversationId} not found, skipping current_conversation_id update`)
        // Don't fail the entire request, just skip setting conversation
      }
    }

    // Update last_seen_at, online status, current conversation, and typing
    const updateData: Record<string, unknown> = {
      last_seen_at: new Date().toISOString(),
      is_online: !isOffline,
      is_typing: isOffline ? false : isTyping,
    }

    // Only set current_conversation_id if we have a valid conversation
    if (!isOffline && conversationId) {
      updateData.current_conversation_id = conversationId
    } else if (isOffline) {
      updateData.current_conversation_id = null
    }

    const { error, count } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", user.id)

    // If no rows were updated (profile doesn't exist yet), upsert it
    if (!error && count === 0) {
      const { error: upsertError } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          email: user.email,
          ...updateData,
        })
      if (upsertError) {
        console.error("[v0] Error upserting presence:", upsertError)
        return NextResponse.json({ error: "Erreur lors de la mise a jour de la presence" }, { status: 500 })
      }
    } else if (error) {
      console.error("[v0] Error updating presence:", error)
      return NextResponse.json({ error: "Erreur lors de la mise a jour de la presence" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error in update presence:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
