export const dynamic = 'force-dynamic'

import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get("token")

    console.log("[v0] Validate API called with token:", token?.substring(0, 10) + "...")

    if (!token) {
      return NextResponse.json({ error: "Token manquant" }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("[v0] Missing Supabase environment variables")
      return NextResponse.json({ error: "Configuration serveur manquante" }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Chercher l'invitation avec le token
    const { data: invitation, error } = await supabase
      .from("invitations")
      .select("*")
      .eq("token", token)
      .is("accepted_at", null)
      .maybeSingle()

    console.log("[v0] Invitation found:", invitation ? "yes" : "no")
    if (error) {
      console.error("[v0] Database error:", error)
    }

    if (error) {
      return NextResponse.json({ error: "Erreur lors de la recherche de l'invitation" }, { status: 500 })
    }

    if (!invitation) {
      // Vérifier si le token existe mais a déjà été accepté
      const { data: acceptedInvitation } = await supabase
        .from("invitations")
        .select("accepted_at")
        .eq("token", token)
        .maybeSingle()

      if (acceptedInvitation?.accepted_at) {
        return NextResponse.json({ error: "Cette invitation a déjà été acceptée" }, { status: 410 })
      }

      return NextResponse.json({ error: "Invitation invalide ou expirée" }, { status: 404 })
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json({ error: "Cette invitation a expiré" }, { status: 410 })
    }

    return NextResponse.json({
      email: invitation.email,
      company: invitation.company,
      valid: true,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      }
    })
  } catch (err) {
    console.error("[v0] Unexpected error in validate:", err)
    return NextResponse.json({ error: "Erreur serveur inattendue" }, { status: 500 })
  }
}
