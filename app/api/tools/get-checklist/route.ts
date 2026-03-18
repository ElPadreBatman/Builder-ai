import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { assembly_type, project_complexity } = body

    if (!assembly_type) {
      return NextResponse.json(
        { error: "assembly_type is required" },
        { status: 400 }
      )
    }

    // Normalize assembly_type (convert spaces to underscores, lowercase)
    const normalizedType = assembly_type.toLowerCase().replace(/\s+/g, "_")

    // Try exact match first
    let { data: checklist } = await supabase
      .from("assembly_checklists")
      .select("*")
      .eq("assembly_type", normalizedType)
      .single()

    // If not found, try partial match
    if (!checklist) {
      const { data } = await supabase
        .from("assembly_checklists")
        .select("*")
        .ilike("assembly_type", `%${normalizedType}%`)
        .limit(1)
      
      checklist = data?.[0]
    }

    // If still not found, try matching key words
    if (!checklist) {
      const keywords = normalizedType.split("_")
      for (const keyword of keywords) {
        if (keyword.length > 3) {
          const { data } = await supabase
            .from("assembly_checklists")
            .select("*")
            .ilike("assembly_type", `%${keyword}%`)
            .limit(1)
          
          if (data?.[0]) {
            checklist = data[0]
            break
          }
        }
      }
    }

    if (checklist) {
      // Adjust minimum lines based on complexity if provided
      let adjustedMinLines = checklist.minimum_lines
      if (project_complexity === "simple") {
        adjustedMinLines = Math.max(5, checklist.minimum_lines - 3)
      } else if (project_complexity === "complexe") {
        adjustedMinLines = checklist.minimum_lines + 5
      }

      return NextResponse.json({
        found: true,
        assembly_type: checklist.assembly_type,
        assembly_name: checklist.assembly_name,
        minimum_lines: adjustedMinLines,
        required_items: checklist.required_items,
        validation_questions: checklist.validation_questions || [],
      })
    }

    // Return a generic checklist structure if not found
    return NextResponse.json({
      found: false,
      assembly_type,
      message: "Checklist non trouvée. Utiliser une structure minimale standard.",
      minimum_lines: 5,
      required_items: [
        {
          category: "Structure",
          items: ["Éléments structuraux principaux"],
          mandatory: true,
        },
        {
          category: "Fixations",
          items: ["Fixations et connecteurs"],
          mandatory: true,
        },
        {
          category: "Main-d'oeuvre",
          items: ["Installation"],
          mandatory: true,
        },
      ],
      validation_questions: [
        "Quelles sont les dimensions exactes?",
        "Y a-t-il des contraintes particulières?",
      ],
    })
  } catch (error) {
    console.error("Error in get-checklist:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
