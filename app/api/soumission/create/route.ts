// app/api/soumission/create/route.ts
// Endpoint orchestrateur appelé par le tool soumission_create de l'agent Bob Buildr
// Crée un workflow, génère toutes les divisions, calcule les totaux

import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { generateAllDivisions, DIVISION_CONFIG } from "@/lib/division-agent"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Taux d'imprévus selon le type d'estimation
const IMPREVU_RATES: Record<string, number> = {
  A: 0.05,
  B: 0.08,
  C: 0.12,
  D: 0.18,
}

// Complexité selon le type d'estimation
function mapComplexity(estimationType: string): "simple" | "standard" | "complex" {
  if (estimationType === "A") return "complex"
  if (estimationType === "D") return "simple"
  return "standard"
}

// Extrait les pièces du projet depuis la description
function extractPieces(description: string, projectType: string): string[] {
  const keywords = [
    "cuisine", "salle de bain", "chambre", "salon", "vestibule", "sous-sol",
    "garage", "fondation", "toiture", "escalier", "suite principale",
    "salle d'eau", "buanderie", "bureau", "bibliothèque", "agrandissement",
  ]
  const found = keywords.filter(kw => description?.toLowerCase().includes(kw))
  return found.length > 0 ? found : [projectType || "rénovation"]
}

// Génère un numéro de soumission unique
function generateSoumissionNumber(): string {
  const year = new Date().getFullYear()
  const seq = Date.now().toString().slice(-5)
  return `SOQ-${year}-${seq}`
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { conversation_id, project_info, divisions } = body

    if (!project_info || !divisions || !Array.isArray(divisions)) {
      return NextResponse.json(
        { error: "project_info et divisions (array) sont requis" },
        { status: 400 }
      )
    }

    const estimationType = project_info.estimation_type || "C"
    const complexity = mapComplexity(estimationType)
    const superficie = project_info.superficie_pi2 || 1000
    const pieces = extractPieces(project_info.description || "", project_info.project_type || "")
    const soumissionNumber = generateSoumissionNumber()

    // Valider que les codes de divisions existent
    const validDivisions = divisions.filter(d => DIVISION_CONFIG[d])
    if (validDivisions.length === 0) {
      return NextResponse.json(
        { error: `Aucune division valide. Codes acceptés: ${Object.keys(DIVISION_CONFIG).join(", ")}` },
        { status: 400 }
      )
    }

    // ─── 1. Créer le workflow dans Supabase ───────────────────────────────────
    const { data: workflow, error: workflowError } = await supabase
      .from("soumission_workflow")
      .insert({
        status: "generating",
        estimation_type: estimationType,
        complexity,
        project_context: {
          ...project_info,
          title: project_info.description?.slice(0, 80) || `Projet ${project_info.client_name || ""}`,
        },
        soumission_number: soumissionNumber,
        conversation_id: conversation_id || null,
        total_items: 0,
        total_amount: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (workflowError || !workflow) {
      console.error("[create] Workflow insert error:", workflowError)
      return NextResponse.json(
        { error: workflowError?.message || "Erreur création workflow" },
        { status: 500 }
      )
    }

    // ─── 2. Générer toutes les divisions ─────────────────────────────────────
    const divisionResults = await generateAllDivisions(workflow.id, {
      projectType: project_info.project_type || "renovation_generale",
      complexity,
      pieces,
      surfaces: {
        total_pi2: superficie,
        plancher: superficie,
      },
      constraints: [],
      selectedDivisions: validDivisions,
    })

    // ─── 3. Calculer les totaux ───────────────────────────────────────────────
    const sous_total = divisionResults.reduce((sum, d) => sum + d.subtotal, 0)
    const imprevu_rate = IMPREVU_RATES[estimationType] ?? 0.12
    const imprevu_amount = sous_total * imprevu_rate
    const total_ht = sous_total + imprevu_amount
    const tps = total_ht * 0.05
    const tvq = total_ht * 0.09975
    const total_ttc = total_ht + tps + tvq
    const totalItems = divisionResults.reduce((sum, d) => sum + d.items.length, 0)

    // ─── 4. Mettre à jour le workflow avec les résultats ─────────────────────
    await supabase
      .from("soumission_workflow")
      .update({
        status: "generated",
        divisions_data: divisionResults,
        total_items: totalItems,
        total_amount: Math.round(total_ht),
        updated_at: new Date().toISOString(),
      })
      .eq("id", workflow.id)

    // ─── 5. Retourner les données complètes pour formatage par l'agent ────────
    return NextResponse.json({
      workflow_id: workflow.id,
      soumission_number: soumissionNumber,
      estimation_type: estimationType,
      complexity,
      project_info,

      // Données de chaque division avec items détaillés
      divisions: divisionResults.map(d => ({
        division_code: d.division_code,
        division_name: d.division_name,
        items: d.items.map(item => ({
          code: item.code,
          description: item.description,
          type: "Mat.", // sera affiné par l'agent selon la source
          unit: item.unit,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.total,
          source: item.source,
          confidence: item.confidence,
        })),
        subtotal: Math.round(d.subtotal),
        warnings: d.warnings,
        item_count: d.items.length,
      })),

      // Totaux financiers pré-calculés
      totaux: {
        sous_total: Math.round(sous_total),
        imprevu_rate,
        imprevu_pct: `${Math.round(imprevu_rate * 100)} %`,
        imprevu_amount: Math.round(imprevu_amount),
        total_ht: Math.round(total_ht),
        tps_rate: 0.05,
        tps: Math.round(tps),
        tvq_rate: 0.09975,
        tvq: Math.round(tvq),
        total_ttc: Math.round(total_ttc),
      },

      // Méta-validation
      meta: {
        total_lignes: totalItems,
        total_divisions: divisionResults.length,
        divisions_list: validDivisions,
        warnings: divisionResults.flatMap(d => d.warnings || []),
        date_generation: new Date().toISOString(),
      },
    })
  } catch (error: any) {
    console.error("[soumission/create] Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
