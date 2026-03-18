import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = await createServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    const { data: profile } = await supabase.from("profiles").select("company, role").eq("id", user.id).single()

    if (!profile || !["admin", "director"].includes(profile.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
    }

    const { data: invitations, error } = await supabase
      .from("invitations")
      .select("*")
      .eq("company", profile.company)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[v0] Error fetching invitations:", error)
      return NextResponse.json({ error: "Erreur lors de la récupération des invitations" }, { status: 500 })
    }

    return NextResponse.json({ invitations })
  } catch (error) {
    console.error("[v0] Error in list invitations:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
