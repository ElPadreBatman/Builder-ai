// app/api/soumission/validate/route.ts
// Validation globale de la soumission avant génération finale

import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  stats: {
    total_items: number
    total_amount: number
    divisions_count: number
    avg_confidence: number
  }
}

export async function POST(request: Request) {
  try {
    const { workflowId } = await request.json()

    if (!workflowId) {
      return NextResponse.json({ error: "workflowId requis" }, { status: 400 })
    }

    // Charger le workflow
    const { data: workflow, error: workflowError } = await supabase
      .from("soumission_workflow")
      .select("*")
      .eq("id", workflowId)
      .single()

    if (workflowError || !workflow) {
      return NextResponse.json({ error: "Workflow non trouvé" }, { status: 404 })
    }

    const errors: string[] = []
    const warnings: string[] = []
    const divisions = workflow.divisions_data || []

    // 1. Validation des seuils de lignes
    let totalItems = 0
    let totalAmount = 0
    let totalConfidence = 0

    for (const division of divisions) {
      const itemCount = division.items?.length || 0
      totalItems += itemCount
      
      const subtotal = division.subtotal || 0
      totalAmount += subtotal

      const avgConf = division.metadata?.avg_confidence || 0
      totalConfidence += avgConf * itemCount

      // Charger les seuils
      const { data: thresholds } = await supabase
        .from("division_thresholds")
        .select("*")
        .eq("division_code", division.division_code)
        .single()

      if (thresholds) {
        const complexity = workflow.complexity || "standard"
        const minItems = thresholds[`min_items_${complexity}`] || 1
        const maxItems = thresholds[`max_items_${complexity}`] || 100

        if (itemCount < minItems) {
          warnings.push(`Division ${division.division_code}: ${itemCount} items < seuil minimum ${minItems}`)
        }
        if (itemCount > maxItems) {
          errors.push(`Division ${division.division_code}: ${itemCount} items > seuil maximum ${maxItems}`)
        }
      }

      // Ajouter les warnings de la division
      if (division.warnings) {
        warnings.push(...division.warnings)
      }
    }

    // 2. Validation du total de lignes selon le type de soumission
    const estimationType = workflow.estimation_type || "C"
    const lineThresholds: Record<string, { min: number; max: number }> = {
      "A": { min: 5, max: 20 },
      "B": { min: 15, max: 50 },
      "C": { min: 40, max: 150 },
      "D": { min: 100, max: 500 }
    }

    const threshold = lineThresholds[estimationType]
    if (threshold) {
      if (totalItems < threshold.min) {
        warnings.push(`Type ${estimationType}: ${totalItems} lignes < minimum recommandé ${threshold.min}`)
      }
      if (totalItems > threshold.max) {
        warnings.push(`Type ${estimationType}: ${totalItems} lignes > maximum recommandé ${threshold.max}`)
      }
    }

    // 3. Validation des prix (cohérence)
    for (const division of divisions) {
      for (const item of division.items || []) {
        // Prix unitaire suspect
        if (item.unit_price <= 0) {
          errors.push(`${item.code}: Prix unitaire invalide (${item.unit_price})`)
        }
        if (item.unit_price > 10000) {
          warnings.push(`${item.code}: Prix unitaire élevé (${item.unit_price} $)`)
        }

        // Quantité suspecte
        if (item.quantity <= 0) {
          errors.push(`${item.code}: Quantité invalide (${item.quantity})`)
        }
        if (item.quantity > 10000) {
          warnings.push(`${item.code}: Quantité élevée (${item.quantity})`)
        }

        // Confiance faible
        if (item.confidence < 0.5) {
          warnings.push(`${item.code}: Confiance faible (${Math.round(item.confidence * 100)}%)`)
        }
      }
    }

    // 4. Validation du budget
    if (workflow.budget_max && totalAmount > workflow.budget_max) {
      errors.push(`Total ${totalAmount.toFixed(2)} $ dépasse le budget max ${workflow.budget_max} $`)
    }

    // 5. Calculer la confiance moyenne
    const avgConfidence = totalItems > 0 ? totalConfidence / totalItems : 0

    // 6. Mettre à jour le statut du workflow
    const valid = errors.length === 0
    await supabase
      .from("soumission_workflow")
      .update({
        status: valid ? "validated" : "validation_failed",
        validation_result: { valid, errors, warnings },
        total_items: totalItems,
        total_amount: totalAmount,
        updated_at: new Date().toISOString()
      })
      .eq("id", workflowId)

    const result: ValidationResult = {
      valid,
      errors,
      warnings,
      stats: {
        total_items: totalItems,
        total_amount: totalAmount,
        divisions_count: divisions.length,
        avg_confidence: avgConfidence
      }
    }

    return NextResponse.json(result)

  } catch (error: any) {
    console.error("[validate] Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
