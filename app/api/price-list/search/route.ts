import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  try {
    const supabase = await createServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Non autorise" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get("q")?.trim()

    if (!query || query.length < 2) {
      return NextResponse.json({ results: [] })
    }

    // Search material_prices using ilike (contains) on material_name, material_code, and category
    const { data, error } = await supabase
      .from("material_prices")
      .select("id, material_name, material_code, category, unit, unit_price, supplier, installation_cost, total_cost")
      .or(`material_name.ilike.%${query}%,material_code.ilike.%${query}%,category.ilike.%${query}%`)
      .eq("is_active", true)
      .order("material_name")
      .limit(20)

    if (error) {
      console.error("[v0] Error searching price list:", error)
      return NextResponse.json({ error: "Erreur lors de la recherche" }, { status: 500 })
    }

    return NextResponse.json({ results: data || [] })
  } catch (error) {
    console.error("[v0] Error in price list search:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
