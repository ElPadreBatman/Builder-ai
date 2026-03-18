import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface ProjectDimensions {
  length_ft?: number
  width_ft?: number
  height_ft?: number
  perimeter_ft?: number
  area_sqft?: number
}

function calculateExpectedQuantity(
  itemType: string,
  dimensions: ProjectDimensions,
  wasteFactor: number = 1.05
): { quantity: number; formula: string } | null {
  const { length_ft, width_ft, height_ft, perimeter_ft, area_sqft } = dimensions

  switch (itemType.toLowerCase()) {
    case "mur":
    case "murs":
    case "cloison":
      if (perimeter_ft && height_ft) {
        return {
          quantity: perimeter_ft * height_ft * wasteFactor,
          formula: `perimetre (${perimeter_ft} pi) x hauteur (${height_ft} pi) x ${wasteFactor}`,
        }
      }
      if (length_ft && height_ft) {
        return {
          quantity: length_ft * height_ft * 2 * wasteFactor,
          formula: `longueur (${length_ft} pi) x hauteur (${height_ft} pi) x 2 faces x ${wasteFactor}`,
        }
      }
      break

    case "toiture":
    case "toit":
      if (length_ft && width_ft) {
        const slopeFactor = 1.15 // facteur pente standard
        return {
          quantity: length_ft * width_ft * slopeFactor * wasteFactor,
          formula: `longueur (${length_ft} pi) x largeur (${width_ft} pi) x facteur pente (1.15) x ${wasteFactor}`,
        }
      }
      if (area_sqft) {
        return {
          quantity: area_sqft * 1.15 * wasteFactor,
          formula: `superficie (${area_sqft} pi²) x facteur pente (1.15) x ${wasteFactor}`,
        }
      }
      break

    case "dalle":
    case "plancher":
    case "plafond":
      if (length_ft && width_ft) {
        return {
          quantity: length_ft * width_ft * wasteFactor,
          formula: `longueur (${length_ft} pi) x largeur (${width_ft} pi) x ${wasteFactor}`,
        }
      }
      if (area_sqft) {
        return {
          quantity: area_sqft * wasteFactor,
          formula: `superficie (${area_sqft} pi²) x ${wasteFactor}`,
        }
      }
      break

    case "perimetre":
    case "fondation":
      if (perimeter_ft) {
        return {
          quantity: perimeter_ft * wasteFactor,
          formula: `perimetre (${perimeter_ft} pi) x ${wasteFactor}`,
        }
      }
      if (length_ft && width_ft) {
        const perim = 2 * (length_ft + width_ft)
        return {
          quantity: perim * wasteFactor,
          formula: `2 x (longueur + largeur) = ${perim} pi x ${wasteFactor}`,
        }
      }
      break
  }

  return null
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      item_type,
      calculated_quantity,
      unit,
      project_dimensions,
      waste_factor = 1.05,
    } = body

    if (!item_type || calculated_quantity === undefined || !unit || !project_dimensions) {
      return NextResponse.json(
        { error: "item_type, calculated_quantity, unit, and project_dimensions are required" },
        { status: 400 }
      )
    }

    // Get formula from database if exists
    const { data: formulaData } = await supabase
      .from("geometry_formulas")
      .select("*")
      .ilike("item_type", `%${item_type}%`)
      .limit(1)

    const dbFormula = formulaData?.[0]
    const effectiveWasteFactor = waste_factor || dbFormula?.default_waste_factor || 1.05
    const tolerance = dbFormula?.tolerance_percent || 10

    // Calculate expected quantity
    const result = calculateExpectedQuantity(item_type, project_dimensions, effectiveWasteFactor)

    if (!result) {
      return NextResponse.json({
        valid: true,
        calculated_quantity: Number(calculated_quantity),
        expected_quantity: null,
        deviation_percent: 0,
        message: "Impossible de calculer la quantite attendue. Dimensions insuffisantes.",
        formula_used: "Non applicable",
      })
    }

    const expected = result.quantity
    const calculated = Number(calculated_quantity)
    const deviationPercent = Math.abs((calculated - expected) / expected) * 100

    const isValid = deviationPercent <= tolerance

    let message = ""
    if (isValid) {
      message = `Quantite valide. Ecart de ${deviationPercent.toFixed(1)}% (tolerance: ${tolerance}%)`
    } else if (calculated < expected) {
      message = `Quantite trop basse. Calculee: ${calculated.toFixed(1)}, Attendue: ${expected.toFixed(1)} (ecart: ${deviationPercent.toFixed(1)}%)`
    } else {
      message = `Quantite trop elevee. Calculee: ${calculated.toFixed(1)}, Attendue: ${expected.toFixed(1)} (ecart: ${deviationPercent.toFixed(1)}%)`
    }

    return NextResponse.json({
      valid: isValid,
      calculated_quantity: calculated,
      expected_quantity: Math.round(expected * 100) / 100,
      deviation_percent: Math.round(deviationPercent * 10) / 10,
      message,
      formula_used: result.formula,
    })
  } catch (error) {
    console.error("Error in validate-geometry:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
