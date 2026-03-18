// app/api/soumission/render/route.ts
// Génération du document final (Markdown, JSON, ou données pour PDF)

import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const { workflowId, format = "markdown" } = await request.json()

    if (!workflowId) {
      return NextResponse.json({ error: "workflowId requis" }, { status: 400 })
    }

    // Charger le workflow complet
    const { data: workflow, error: workflowError } = await supabase
      .from("soumission_workflow")
      .select("*")
      .eq("id", workflowId)
      .single()

    if (workflowError || !workflow) {
      return NextResponse.json({ error: "Workflow non trouvé" }, { status: 404 })
    }

    // Générer selon le format demandé
    let output: any

    switch (format) {
      case "markdown":
        output = generateMarkdown(workflow)
        break
      case "json":
        output = generateJSON(workflow)
        break
      case "pdf_data":
        output = generatePDFData(workflow)
        break
      default:
        output = generateMarkdown(workflow)
    }

    // Mettre à jour le statut
    await supabase
      .from("soumission_workflow")
      .update({
        status: "rendered",
        rendered_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", workflowId)

    return NextResponse.json({ 
      format, 
      output,
      workflow_id: workflowId,
      generated_at: new Date().toISOString()
    })

  } catch (error: any) {
    console.error("[render] Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

function generateMarkdown(workflow: any): string {
  const lines: string[] = []
  const project = workflow.project_context || {}
  const divisions = workflow.divisions_data || []

  // En-tête
  lines.push(`# SOUMISSION ${workflow.estimation_type || "C"} - ${project.title || "Projet"}`)
  lines.push("")
  lines.push(`**No:** ${workflow.soumission_number || "SOQ-" + Date.now()}`)
  lines.push(`**Date:** ${new Date().toLocaleDateString("fr-CA")}`)
  lines.push(`**Client:** ${project.client_name || "N/A"}`)
  lines.push(`**Adresse:** ${project.address || "N/A"}`)
  lines.push("")

  // Résumé
  lines.push("## RÉSUMÉ")
  lines.push("")
  lines.push(`| Métrique | Valeur |`)
  lines.push(`|----------|--------|`)
  lines.push(`| Total lignes | ${workflow.total_items || 0} |`)
  lines.push(`| Total divisions | ${divisions.length} |`)
  lines.push(`| **TOTAL** | **${formatMoney(workflow.total_amount || 0)}** |`)
  lines.push("")

  // Divisions
  for (const division of divisions) {
    lines.push(`## Division ${division.division_code} - ${division.division_name}`)
    lines.push("")

    if (division.items && division.items.length > 0) {
      lines.push("| Code | Description | Qté | Unité | Prix unit. | Total |")
      lines.push("|------|-------------|-----|-------|------------|-------|")

      for (const item of division.items) {
        lines.push(`| ${item.code} | ${item.description} | ${item.quantity} | ${item.unit} | ${formatMoney(item.unit_price)} | ${formatMoney(item.total)} |`)
      }

      lines.push("")
      lines.push(`**Sous-total Division ${division.division_code}:** ${formatMoney(division.subtotal)}`)
      lines.push("")
    } else {
      lines.push("*Aucun item pour cette division*")
      lines.push("")
    }
  }

  // Total final
  lines.push("---")
  lines.push("")
  lines.push(`## TOTAL GÉNÉRAL: ${formatMoney(workflow.total_amount || 0)}`)
  lines.push("")

  // Notes
  if (workflow.validation_result?.warnings?.length > 0) {
    lines.push("### Notes et avertissements")
    lines.push("")
    for (const warning of workflow.validation_result.warnings) {
      lines.push(`- ${warning}`)
    }
    lines.push("")
  }

  // Conditions
  lines.push("### Conditions")
  lines.push("")
  lines.push("- Prix valides 30 jours")
  lines.push("- Taxes en sus")
  lines.push("- Acompte de 30% à la signature")
  lines.push("")

  return lines.join("\n")
}

function generateJSON(workflow: any): any {
  const project = workflow.project_context || {}
  const divisions = workflow.divisions_data || []

  return {
    soumission: {
      number: workflow.soumission_number || `SOQ-${Date.now()}`,
      type: workflow.estimation_type || "C",
      date: new Date().toISOString(),
      status: workflow.status
    },
    client: {
      name: project.client_name,
      phone: project.client_phone,
      email: project.client_email,
      address: project.address
    },
    project: {
      title: project.title,
      type: project.project_type,
      complexity: workflow.complexity,
      pieces: project.pieces || []
    },
    divisions: divisions.map((div: any) => ({
      code: div.division_code,
      name: div.division_name,
      items: div.items || [],
      subtotal: div.subtotal || 0,
      item_count: div.items?.length || 0
    })),
    totals: {
      items: workflow.total_items || 0,
      amount: workflow.total_amount || 0,
      divisions: divisions.length
    },
    validation: workflow.validation_result || null,
    metadata: {
      generated_at: new Date().toISOString(),
      workflow_id: workflow.id
    }
  }
}

function generatePDFData(workflow: any): any {
  // Données structurées pour le générateur PDF existant
  const json = generateJSON(workflow)

  return {
    ...json,
    pdf_config: {
      template: "soumission_standard",
      logo: true,
      header_color: "#f97316",
      font_family: "Helvetica"
    },
    sections: [
      { type: "header", data: json.soumission },
      { type: "client_info", data: json.client },
      { type: "project_summary", data: json.project },
      ...json.divisions.map((div: any) => ({
        type: "division_table",
        data: div
      })),
      { type: "totals", data: json.totals },
      { type: "conditions", data: { terms: ["Prix valides 30 jours", "Taxes en sus", "Acompte 30%"] } }
    ]
  }
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: "CAD"
  }).format(amount)
}
