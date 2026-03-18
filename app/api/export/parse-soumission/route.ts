// app/api/export/parse-soumission/route.ts
// Parse le contenu markdown d'une conversation en objet Soumission structure
// VERSION AMÉLIORÉE - Support tableaux délimités par tabulations

import { type NextRequest, NextResponse } from "next/server"
import type { Soumission } from "@/types/soumission"
import { DIVISIONS_MASTERFORMAT } from "@/types/soumission"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { content } = body

    if (!content) {
      return NextResponse.json({ error: "Contenu manquant" }, { status: 400 })
    }

    // Regex-only parsing - extracts EXACT data from the conversation
    // (AI parsing was removed because it invents/modifies prices instead of extracting faithfully)
    const soumission = extractSoumissionFromMarkdown(content)

    const totalItems = soumission.phases?.reduce((sum, p) => sum + p.divisions.reduce((s, d) => s + d.items.length, 0), 0) || 0
    if (!soumission.phases?.length || totalItems === 0) {
      return NextResponse.json({
        error: `Impossible d'extraire une soumission complete. Aucun poste de cout trouve. Projet detecte: "${soumission.projet?.nom || "inconnu"}"`,
      }, { status: 422 })
    }

    // Build parsing report for transparency
    const report = {
      totalItems,
      totalPhases: soumission.phases?.length || 0,
      totalDivisions: soumission.phases?.reduce((sum, p) => sum + p.divisions.length, 0) || 0,
      coutsDirect: soumission.phases?.reduce((sum, p) => 
        sum + p.divisions.reduce((ds, d) => 
          ds + d.items.reduce((is, i) => is + (i.quantite * i.prix_unitaire), 0), 0), 0) || 0,
      divisions: soumission.phases?.flatMap(p => 
        p.divisions.map(d => ({
          code: d.code,
          nom: d.nom,
          items: d.items.length,
          total: d.items.reduce((s, i) => s + (i.quantite * i.prix_unitaire), 0),
        }))
      ) || [],
    }

    return NextResponse.json({ soumission, report })
  } catch (error) {
    console.error("[v0] Error parsing soumission:", error)
    return NextResponse.json({
      error: "Erreur lors du parsing de la soumission",
      details: error instanceof Error ? error.message : "Erreur inconnue",
    }, { status: 500 })
  }
}



// ============================================================================
// EXTRACTION DEPUIS MARKDOWN / TEXTE
// Supporte: tableaux markdown pipe-delim, tableaux tab-delim, listes textuelles
// ============================================================================
function extractSoumissionFromMarkdown(rawContent: string): Soumission {
  // =====================================================================
  // STEP 0: If the conversation contains multiple revisions, only use the LAST one.
  // This prevents duplicating items from earlier versions (e.g. Rev 2.0 + Rev 3.0).
  // We look for markers like "RÉVISION 3.0", "SOUMISSION ULTRA-DÉTAILLÉE – RÉVISION",
  // "Version finale", etc. and keep only from the last marker onward.
  // =====================================================================
  let content = rawContent
  
  // Find all revision/soumission header positions
  const revisionMarkers = [
    /SOUMISSION\s+ULTRA[–—-]D[ÉE]TAILL[ÉE]E?\s*[–—-]\s*R[ÉE]VISION\s*[\d.]+/gi,
    /SOUMISSION\s+D[ÉE]TAILL[ÉE]E?\s*[–—-]\s*R[ÉE]VISION\s*[\d.]+/gi,
    /R[ÉE]VISION\s+[\d.]+\s*[–—-]/gi,
    /SOUMISSION\s*[–—-]+\s*[^\n]{5,}(?:\n|$)/gi,
  ]
  
  let lastRevisionStart = -1
  for (const marker of revisionMarkers) {
    let m
    while ((m = marker.exec(rawContent)) !== null) {
      if (m.index > lastRevisionStart) {
        lastRevisionStart = m.index
      }
    }
  }
  
  if (lastRevisionStart > 0) {
    // Only use content from the last revision header onward
    content = rawContent.substring(lastRevisionStart)
  }

  // --- Nom du projet ---
  const nomProjet =
    extractValue(content, /SOUMISSION\s*[–—-]+\s*([^\n]+)/i) ||
    extractValue(content, /(?:Objet|Projet|Objet des travaux)[:\s]+([^\n]+)/i) ||
    extractValue(content, /SOUMISSION[^\n]*[–—-]\s*([^\n]+)/i) ||
    extractValue(content, /(?:SOUMISSION[^–—-]*[–—-]\s*TYPE\s*[A-D]\s*\n)([^\n]+)/i) ||
    "Soumission"

  const typeMatch = content.match(/Type\s*([A-D])/i)
  const categorie = (typeMatch ? typeMatch[1].toUpperCase() : "C") as "A" | "B" | "C" | "D"

  const tauxImprevus: Record<string, number> = { A: 0.05, B: 0.10, C: 0.15, D: 0.20 }

  // --- Adresse & Client ---
  const adresse =
    extractValue(content, /Adresse\s+du\s+chantier\s*\n([^\n📞]+)/i) ||
    extractValue(content, /(?:Chantier|Adresse)[:\s]+([^\n,]+)/i) ||
    "A confirmer"
  const client =
    extractValue(content, /Client\s*\n([^\n📞]+)/i) ||
    extractValue(content, /Client[:\s]+([^\n📞]+)/i) ||
    "A confirmer"

  // --- Duree ---
  const dureeMatch = content.match(/(\d+)\s*semaines?\s*ouvrables/i) || content.match(/[Dd]ur[ée]e[:\s]+(\d+)/i)
  const dureeJours = dureeMatch
    ? (content.match(/(\d+)\s*semaines?\s*ouvrables/i) ? parseInt(dureeMatch[1]) * 5 : parseInt(dureeMatch[1]))
    : 15

  // --- Validite ---
  const validiteMatch = content.match(/[Vv]alidit[ée][^:]*[:\s]+(\d+)/i)
  const validiteJours = validiteMatch ? parseInt(validiteMatch[1]) : 30

  // --- Taux imprevu intégré ---
  const imprevuMatch = content.match(/impr[ée]vus[^(]*\(?(\d+)\s*%/i)
  const tauxImprevu = imprevuMatch ? parseInt(imprevuMatch[1]) / 100 : tauxImprevus[categorie] || 0.15

  // --- Taux frais gestion ---
  const fgMatch = content.match(/(?:gestion|administration|assurance)[^(]*\(?(\d+)\s*%/i)
  const tauxFG = fgMatch ? parseInt(fgMatch[1]) / 100 : 0.10

  // --- Description du projet ---
  const description = extractValue(content, /Objet des travaux\s*\n([\s\S]*?)(?=\n\s*\n|\nSoumissionnaire)/i) || ""

  const soumission: Soumission = {
    projet: {
      nom: nomProjet.trim(),
      adresse: adresse.trim(),
      client: client.replace(/📞.*$/, "").trim(),
      categorie,
      duree_jours: dureeJours,
      validite_jours: validiteJours,
      description: description.trim(),
    },
    phases: [],
    parametres: {
      taux_imprevu: tauxImprevu,
      taux_fg: tauxFG,
      taux_tps: 0.05,
      taux_tvq: 0.09975,
      inclure_deplacement: content.toLowerCase().includes("deplacement"),
    },
    inclusions: [],
    exclusions: [],
  }

  // --- Extraire inclusions (multiple formats) ---
  const inclusions: string[] = []
  // Format: ✅ or ✓ bullet points
  const inclSection = content.match(/✅\s*INCLUS[^\n]*\n([\s\S]*?)(?=❌|EXCLUS|$)/i) ||
    content.match(/INCLUS[^\n]*\n([\s\S]*?)(?=❌|EXCLUS|$)/i)
  if (inclSection) {
    const lines = inclSection[1].split("\n")
    for (const line of lines) {
      const cleaned = line.replace(/^[✅✓•\-*]\s*/, "").trim()
      if (cleaned && cleaned.length > 3 && !cleaned.startsWith("❌") && !cleaned.match(/^EXCLUS/i)) {
        inclusions.push(cleaned)
      }
    }
  }
  // Format: pipe-delimited table
  if (inclusions.length === 0) {
    const inclTableMatch = content.match(/INCLUS[^\n]*\n[^\n]*\n((?:\|[^\n]+\n)+)/i)
    if (inclTableMatch) {
      const rows = inclTableMatch[1].split("\n").filter(r => r.includes("|"))
      for (const row of rows) {
        const cells = row.split("|").map(c => c.trim()).filter(Boolean)
        if (cells[0] && !cells[0].includes("---")) {
          const cleaned = cells[0].replace(/^[✅✓]\s*/, "").trim()
          if (cleaned) inclusions.push(cleaned)
        }
      }
    }
  }
  soumission.inclusions = inclusions

  // --- Extraire exclusions (multiple formats) ---
  const exclusions: string[] = []
  const exclSection = content.match(/❌\s*EXCLUS[^\n]*\n([\s\S]*?)(?=\n(?:Acceptation|Signature|#{1,3}\s|\d+\.\s+[A-Z])|$)/i) ||
    content.match(/EXCLUS[^\n]*\n([\s\S]*?)(?=\n(?:Acceptation|Signature|#{1,3}\s|\d+\.\s+[A-Z])|$)/i)
  if (exclSection) {
    const lines = exclSection[1].split("\n")
    for (const line of lines) {
      const cleaned = line.replace(/^[❌✗•\-*]\s*/, "").trim()
      if (cleaned && cleaned.length > 3 && !cleaned.startsWith("✅") && !cleaned.match(/^Si tu veux/i)) {
        exclusions.push(cleaned)
      }
    }
  }
  if (exclusions.length === 0) {
    const exclTableMatch = content.match(/EXCLUS[^\n]*\n[^\n]*\n((?:\|[^\n]+\n)+)/i)
    if (exclTableMatch) {
      const rows = exclTableMatch[1].split("\n").filter(r => r.includes("|"))
      for (const row of rows) {
        const cells = row.split("|").map(c => c.trim()).filter(Boolean)
        const exclCell = cells.length > 1 ? cells[1] : cells[0]
        if (exclCell && !exclCell.includes("---")) {
          const cleaned = exclCell.replace(/^[❌✗]\s*/, "").trim()
          if (cleaned) exclusions.push(cleaned)
        }
      }
    }
  }
  soumission.exclusions = exclusions

  // --- Extraire hypotheses (text bullet list or table) ---
  const hypoRegex = /HYPOTH[ÈE]SES|METHODOLOGIE/i
  if (hypoRegex.test(content)) {
    const hypoSection = content.split(hypoRegex)[1]?.split(/\n(?:\d+\.\s+[A-Z]|#{1,3}\s)/)[0] || ""
    const hypotheses: Array<{ element: string; valeur: string; source: string }> = []

    // Table format
    const hypoTableRegex = /\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|/g
    let hypoMatch
    while ((hypoMatch = hypoTableRegex.exec(hypoSection)) !== null) {
      const element = hypoMatch[1].trim()
      if (element.toLowerCase().includes("element") || element.includes("---")) continue
      hypotheses.push({ element, valeur: hypoMatch[2].trim(), source: hypoMatch[4].trim() })
    }

    // Bullet/text format: parse "Key : value" lines
    if (hypotheses.length === 0) {
      const lines = hypoSection.split("\n")
      for (const line of lines) {
        const cleaned = line.replace(/^[-•*→]\s*/, "").trim()
        if (!cleaned || cleaned.length < 5) continue
        // Match "Label : value" or "Label: value"
        const kvMatch = cleaned.match(/^([^:]+)[:\s]+(.+)$/)
        if (kvMatch) {
          hypotheses.push({
            element: kvMatch[1].trim(),
            valeur: kvMatch[2].trim(),
            source: "Agent",
          })
        }
      }
    }

    if (hypotheses.length > 0) {
      soumission.hypotheses = hypotheses
    }
  }

  // --- Extraire les divisions ---
  const phaseMap: Map<string, { nom: string; divisions: Map<string, { nom: string; items: any[] }> }> = new Map()

  // Detecter les phases (PH-0, PH-1, etc.) - supports ### prefix or plain text
  const phaseRegex = /(?:^|\n)(?:#{1,4}\s*)?(PH[–—-]?\d+)\s*[–—-]\s*([^\n]+)/gi
  let phaseMatch
  const phasePositions: Array<{ code: string; nom: string; start: number }> = []

  while ((phaseMatch = phaseRegex.exec(content)) !== null) {
    const code = phaseMatch[1].replace(/[–—]/g, "-").toUpperCase()
    phasePositions.push({ code, nom: phaseMatch[2].trim(), start: phaseMatch.index })
  }

  // First detect #### Division headers for context
  const divHeaderRegex = /#{1,4}\s*Division\s+(\d{2})\s*[–—-]\s*([^\n]+)/gi
  let divHeaderMatch
  const divHeaderPositions: Array<{ code: string; nom: string; start: number }> = []
  while ((divHeaderMatch = divHeaderRegex.exec(content)) !== null) {
    divHeaderPositions.push({ code: divHeaderMatch[1], nom: divHeaderMatch[2].trim(), start: divHeaderMatch.index })
  }

  // =========================================================================
  // STRATEGY 1: Tab-separated tables under #### Division XX headers
  // Format: "01 11 00\tGestion projet\tST\tforfait\t1\t900,00 $\t900,00 $"
  // This is the most common output format from the AI assistant
  // =========================================================================
  if (divHeaderPositions.length > 0) {
    for (let dh = 0; dh < divHeaderPositions.length; dh++) {
      const divH = divHeaderPositions[dh]
      const nextStart = dh + 1 < divHeaderPositions.length ? divHeaderPositions[dh + 1].start : content.length
      const section = content.substring(divH.start, nextStart)
      const lines = section.split("\n")

      for (const line of lines) {
        if (!line.trim()) continue

        // Try tab-separated first (most common)
        let cells = line.split("\t").map(c => c.trim())
        
        // If not enough tab-separated cells, try pipe-separated
        if (cells.length < 6) {
          if (line.includes("|")) {
            cells = line.split("|").map(c => c.trim()).filter(Boolean)
          }
        }
        
        if (cells.length < 6) continue

        // Check if first cell is a MasterFormat code: "XX XX XX"
        const codeCell = cells[0]
        if (!/^\d{2}\s\d{2}\s\d{2}$/.test(codeCell)) continue

        // Skip sous-total lines
        if (cells.join(" ").toLowerCase().includes("sous-total")) continue

        const code = codeCell
        const description = cells[1]
        const type = cells[2]
        const unite = cells[3]
        const qte = parseFloat(cells[4].replace(/[^\d.,]/g, "").replace(",", ".")) || 1
        const prix = parseMoney(cells[5])
        const divCode = code.substring(0, 2)

        if (prix <= 0 || !description || description.length < 2) continue

        // Determine phase
        let currentPhaseCode = "PH-1"
        let currentPhaseNom = nomProjet
        for (let p = phasePositions.length - 1; p >= 0; p--) {
          if (divH.start > phasePositions[p].start) {
            currentPhaseCode = phasePositions[p].code
            currentPhaseNom = phasePositions[p].nom
            break
          }
        }

        if (!phaseMap.has(currentPhaseCode)) {
          phaseMap.set(currentPhaseCode, { nom: currentPhaseNom, divisions: new Map() })
        }
        const phase = phaseMap.get(currentPhaseCode)!
        if (!phase.divisions.has(divCode)) {
          phase.divisions.set(divCode, { nom: DIVISIONS_MASTERFORMAT[divCode] || divH.nom, items: [] })
        }
        phase.divisions.get(divCode)!.items.push({
          code,
          description: description.replace(/⚠️/g, "").trim(),
          type: normalizeType(type),
          quantite: qte,
          unite,
          prix_unitaire: prix,
        })
      }
    }
  }

  // =========================================================================
  // STRATEGY 1b: Global scan for tab/pipe-separated rows with MasterFormat codes
  // For content without #### Division headers but with structured rows
  // =========================================================================
  if (!hasItems(phaseMap)) {
    const allLines = content.split("\n")
    for (const line of allLines) {
      if (!line.trim()) continue

      let cells = line.split("\t").map(c => c.trim())
      if (cells.length < 6 && line.includes("|")) {
        cells = line.split("|").map(c => c.trim()).filter(Boolean)
      }
      if (cells.length < 6) continue

      const codeCell = cells[0]
      if (!/^\d{2}\s\d{2}\s\d{2}$/.test(codeCell)) continue
      if (cells.join(" ").toLowerCase().includes("sous-total")) continue

      const code = codeCell
      const description = cells[1]
      const type = cells[2]
      const unite = cells[3]
      const qte = parseFloat(cells[4].replace(/[^\d.,]/g, "").replace(",", ".")) || 1
      const prix = parseMoney(cells[5])
      const divCode = code.substring(0, 2)

      if (prix <= 0 || !description || description.length < 2) continue

      // Determine phase from position
      let currentPhaseCode = "PH-1"
      let currentPhaseNom = nomProjet
      const lineIdx = content.indexOf(line)
      for (let p = phasePositions.length - 1; p >= 0; p--) {
        if (lineIdx > phasePositions[p].start) {
          currentPhaseCode = phasePositions[p].code
          currentPhaseNom = phasePositions[p].nom
          break
        }
      }

      if (!phaseMap.has(currentPhaseCode)) {
        phaseMap.set(currentPhaseCode, { nom: currentPhaseNom, divisions: new Map() })
      }
      const phase = phaseMap.get(currentPhaseCode)!
      if (!phase.divisions.has(divCode)) {
        phase.divisions.set(divCode, { nom: DIVISIONS_MASTERFORMAT[divCode] || `Division ${divCode}`, items: [] })
      }
      phase.divisions.get(divCode)!.items.push({
        code,
        description: description.replace(/⚠️/g, "").trim(),
        type: normalizeType(type),
        quantite: qte,
        unite,
        prix_unitaire: prix,
      })
    }
  }

  // STRATEGY 2: Division-based text format avec tableaux TAB-DELIMITED ⭐ NOUVEAU
  if (phaseMap.size === 0) {
    const divisionRegex = /DIVISION\s+(\d{2})\s*[–—-]+\s*([^\n]+)/gi
    let divMatch
    const divPositions: Array<{ code: string; nom: string; start: number; end: number }> = []

    while ((divMatch = divisionRegex.exec(content)) !== null) {
      divPositions.push({
        code: divMatch[1],
        nom: divMatch[2].trim(),
        start: divMatch.index,
        end: content.length,
      })
    }
    // Set end positions
    for (let i = 0; i < divPositions.length - 1; i++) {
      divPositions[i].end = divPositions[i + 1].start
    }

    if (divPositions.length > 0) {
      // Determine current phase
      let currentPhaseCode = "PH-1"
      let currentPhaseNom = nomProjet.trim()
      
      // Find the phase this division belongs to
      for (let p = phasePositions.length - 1; p >= 0; p--) {
        if (divPositions[0].start > phasePositions[p].start) {
          currentPhaseCode = phasePositions[p].code
          currentPhaseNom = phasePositions[p].nom
          break
        }
      }

      phaseMap.set(currentPhaseCode, { nom: currentPhaseNom, divisions: new Map() })
      const phase = phaseMap.get(currentPhaseCode)!

      for (const div of divPositions) {
        const section = content.substring(div.start, div.end)
        const items: any[] = []

        // First try: 7-column tab/pipe-separated rows with MasterFormat codes
        const sectionLines = section.split("\n")
        for (const line of sectionLines) {
          if (!line.trim()) continue
          let cells = line.split("\t").map(c => c.trim())
          if (cells.length < 6 && line.includes("|")) {
            cells = line.split("|").map(c => c.trim()).filter(Boolean)
          }
          if (cells.length < 6) continue
          const codeCell = cells[0]
          if (!/^\d{2}\s\d{2}\s\d{2}$/.test(codeCell)) continue
          if (cells.join(" ").toLowerCase().includes("sous-total")) continue
          const prix = parseMoney(cells[5])
          if (prix <= 0 || !cells[1] || cells[1].length < 2) continue
          items.push({
            code: codeCell,
            description: cells[1].replace(/⚠️/g, "").trim(),
            type: normalizeType(cells[2] || "Mat."),
            quantite: parseFloat(cells[4].replace(/[^\d.,]/g, "").replace(",", ".")) || 1,
            unite: cells[3] || "forf.",
            prix_unitaire: prix,
          })
        }

        // Fallback: Parse tableaux TAB-DELIMITED simples (2-col: Description\tMontant)
        if (items.length === 0) {
          const tabTableMatch = section.match(/Description\s+Montant\s*\n([\s\S]*?)(?=\n\n|DIVISION|Sous-total|\Z)/i)
          if (tabTableMatch) {
            const lines = tabTableMatch[1].split("\n")
            for (const line of lines) {
              if (!line.trim()) continue
              if (line.toLowerCase().includes("sous-total")) continue
              const parts = line.split(/\t+|\s{2,}/).map(p => p.trim()).filter(Boolean)
              if (parts.length >= 2) {
                const description = parts[0]
                const montantStr = parts[parts.length - 1].replace(/[^\d\s,]/g, "").trim()
                const montant = parseFloat(montantStr.replace(/\s/g, "").replace(",", ".")) || 0
                if (montant > 0 && description.length > 2) {
                  items.push({
                    code: `${div.code}.${String(items.length + 1).padStart(2, "0")}`,
                    description: description,
                    type: detectTypeFromDesc(description),
                    quantite: 1,
                    unite: "forf.",
                    prix_unitaire: montant,
                  })
                }
              }
            }
          }
        }

        // Fallback: Parse line items: "XX.XX\tDescription\tTotal $" or "XX.XX Description Total $"
        if (items.length === 0) {
          const lineItemRegex = /(\d{2}\.\d{2})\s+([^\t\n$]+?)\s+(\d[\d\s,.]*)\s*\$/gm
          let lineMatch
          while ((lineMatch = lineItemRegex.exec(section)) !== null) {
            const desc = lineMatch[2].trim()
            const totalStr = lineMatch[3].replace(/\s/g, "").replace(",", ".")
            const total = parseFloat(totalStr) || 0
            if (total > 0 && desc.length > 2) {
              items.push({
                code: lineMatch[1],
                description: desc,
                type: detectTypeFromDesc(desc),
                quantite: 1,
                unite: "forf.",
                prix_unitaire: total,
              })
            }
          }
        }

        // Also try tab-separated table rows (No | Description | Total)
        if (items.length === 0) {
          const tabLineRegex = /(\d{2}\.\d{2})\s*\|\s*([^|]+)\|\s*([^|\n]+)/gm
          let tabMatch
          while ((tabMatch = tabLineRegex.exec(section)) !== null) {
            const desc = tabMatch[2].trim()
            const totalStr = tabMatch[3].replace(/[^\d.,]/g, "").replace(",", ".")
            const total = parseFloat(totalStr) || 0
            if (total > 0) {
              items.push({
                code: tabMatch[1],
                description: desc,
                type: detectTypeFromDesc(desc),
                quantite: 1,
                unite: "forf.",
                prix_unitaire: total,
              })
            }
          }
        }

        // Also try simple markdown table within the division section
        if (items.length === 0) {
          const lines = section.split("\n")
          for (const line of lines) {
            if (!line.includes("|")) continue
            if (line.includes("---")) continue
            const cells = line.split("|").map(c => c.trim()).filter(Boolean)
            if (cells.length < 2) continue
            // Check if first cell is a code like XX.XX
            const codeMatch = cells[0].match(/^\d{2}\.\d{2}$/)
            if (codeMatch) {
              const desc = cells[1] || ""
              const totalCell = cells[cells.length - 1]
              const totalStr = totalCell.replace(/[^\d.,]/g, "").replace(",", ".")
              const total = parseFloat(totalStr) || 0
              if (total > 0 && desc.length > 2) {
                items.push({
                  code: cells[0],
                  description: desc,
                  type: detectTypeFromDesc(desc),
                  quantite: 1,
                  unite: "forf.",
                  prix_unitaire: total,
                })
              }
            }
          }
        }

        if (items.length > 0) {
          phase.divisions.set(div.code, {
            nom: DIVISIONS_MASTERFORMAT[div.code] || div.nom,
            items,
          })
        }
      }
    }
  }

  // STRATEGY 2c: Parse YAML/text format with inline tables like:
  // "Code	Description	Type	Qté	Prix un.	Total"
  // "26 24 13	Panneau 200A Siemens	Mat.	1	2 450 $	2 450 $"
  // This format uses tabs and Code format "XX XX XX" (with spaces)
  if (!hasItems(phaseMap)) {
    // Find all phase headers like "PH‑1 – ÉLECTRICITÉ" or "PH-1 - Electricite"
    const yamlPhaseRegex = /PH[–—-](\d+)\s*[–—-]\s*([^\n]+)/gi
    let yamlPhaseMatch
    const yamlPhases: Array<{ code: string; nom: string; start: number; end: number }> = []
    
    while ((yamlPhaseMatch = yamlPhaseRegex.exec(content)) !== null) {
      yamlPhases.push({
        code: `PH-${yamlPhaseMatch[1]}`,
        nom: yamlPhaseMatch[2].trim(),
        start: yamlPhaseMatch.index,
        end: content.length,
      })
    }
    
    // Set end positions
    for (let i = 0; i < yamlPhases.length - 1; i++) {
      yamlPhases[i].end = yamlPhases[i + 1].start
    }
    
    for (const phase of yamlPhases) {
      const section = content.substring(phase.start, phase.end)
      
      // Look for Division headers and their items
      const divRegex = /Division\s+(\d{2})\s*[–—-]\s*([^\n]+)/gi
      let divMatch
      const divPositions: Array<{ code: string; nom: string; start: number; end: number }> = []
      
      while ((divMatch = divRegex.exec(section)) !== null) {
        divPositions.push({
          code: divMatch[1],
          nom: divMatch[2].trim(),
          start: divMatch.index,
          end: section.length,
        })
      }
      
      for (let i = 0; i < divPositions.length - 1; i++) {
        divPositions[i].end = divPositions[i + 1].start
      }
      
      if (divPositions.length > 0) {
        if (!phaseMap.has(phase.code)) {
          phaseMap.set(phase.code, { nom: phase.nom, divisions: new Map() })
        }
        const phaseData = phaseMap.get(phase.code)!
        
        for (const div of divPositions) {
          const divSection = section.substring(div.start, div.end)
          const items: any[] = []
          
          // Parse tab-separated lines with Code format "XX XX XX"
          const lines = divSection.split("\n")
          for (const line of lines) {
            // Skip header lines and empty lines
            if (!line.trim() || line.toLowerCase().includes("code") && line.toLowerCase().includes("description")) continue
            if (line.toLowerCase().includes("sous-total") || line.toLowerCase().includes("sous‑total")) continue
            
            // Try tab-separated
            let cells = line.split("\t").map(c => c.trim())
            
            // If tab split didn't work (< 6 columns), try multiple spaces
            if (cells.length < 6) {
              cells = line.split(/\s{2,}/).map(c => c.trim())
            }
            
            if (cells.length < 6) continue  // Need at least 6 columns: Code, Desc, Type, Unite, Qte, Prix
            
            // Check if first cell is MasterFormat code "XX XX XX"
            const codeMatch = cells[0].match(/^(\d{2})\s+(\d{2})\s+(\d{2})$/)
            if (!codeMatch) continue
            
            const itemCode = cells[0]
            const description = cells[1]
            const type = cells[2]
            const unite = cells[3]  // Column 3 = Unité
            const qteStr = cells[4]  // Column 4 = Qté
            
            // Parse quantity from column 4
            let qte = 1
            const qteNumMatch = qteStr.match(/^(\d+(?:[.,]\d+)?)/)
            if (qteNumMatch) {
              qte = parseFloat(qteNumMatch[1].replace(",", ".")) || 1
            }
            
            // Get price from column 5 (Prix unitaire)
            // FIX: Be careful with cells that start with "$" - that's the currency, not the price
            let prixUnitStr = cells[5] || ""
            let prixTotalStr = cells[6] || ""
            
            // If cells[5] is just "$" then the actual price is in cells[6] and total is in cells[7]
            if (prixUnitStr === "$" && cells[6]) {
              prixUnitStr = cells[6]
              prixTotalStr = cells[7] || ""
            }
            
            // Also handle case where the price and total are stuck together: "2 450 $2 450 $"
            // by joining remaining cells and extracting money values
            if (!prixUnitStr || prixUnitStr === "$") {
              const remainingCells = cells.slice(5).join(" ")
              const moneyMatches = remainingCells.match(/[\d\s,]+\s*\$/g)
              if (moneyMatches && moneyMatches.length >= 1) {
                prixUnitStr = moneyMatches[0]
                prixTotalStr = moneyMatches.length > 1 ? moneyMatches[1] : ""
              }
            }
            
            let prix = parseMoney(prixUnitStr)
            const prixTotal = parseMoney(prixTotalStr)
            
            // Sanity check: detect if price was multiplied by itself or quantity
            // E.g., if prix=2450 and qte=1, but prixTotal=6002500, that's prix*prix (wrong!)
            if (prix > 0 && prixTotal > 0) {
              const expectedTotal = prix * qte
              const expectedTotalWithTolerance = expectedTotal * 1.05 // Allow 5% tolerance
              if (prixTotal > expectedTotalWithTolerance && qte > 0) {
                // Check if prixTotal looks like prix * prix (multiplication by self)
                const ratioToPrix = prixTotal / prix
                if (Math.abs(ratioToPrix - prix) < prix * 0.01) {
                  // prixTotal ≈ prix * prix, so it was multiplied by itself!
                  console.log(`[v0] Detected self-multiplication: prix=${prix}, prixTotal=${prixTotal} for ${itemCode}. Using prix_unitaire only.`)
                  // Use prix as-is, ignore prixTotal
                } else if (prixTotal > expectedTotal * 5) {
                  // prixTotal is just suspiciously high
                  console.log(`[v0] Ignoring suspicious total ${prixTotalStr} (${prixTotal}) vs expected ${expectedTotal} for item ${itemCode}`)
                }
              }
            } else if (prix === 0 && prixTotal > 0 && qte > 0) {
              prix = prixTotal / qte
            }
            
            if (prix > 0 && description && description.length > 2) {
              items.push({
                code: itemCode,
                description: description.replace(/⚠️/g, "").trim(),
                type: normalizeType(type),
                quantite: qte,
                unite: unite || "u",
                prix_unitaire: prix,
              })
            }
          }
          
          // Also try parsing simple "Description\tMontant" format
          if (items.length === 0) {
            for (const line of lines) {
              if (!line.trim()) continue
              if (line.toLowerCase().includes("sous-total")) continue
              
              // Match lines like "Armoires mélamine haute qualité 14' linéaires\n≈ 14 500 $"
              // Or "≈ 4 644 $" after a description
              const priceMatch = line.match(/≈?\s*([\d\s,]+)\s*\$/)
              if (priceMatch) {
                const prix = parseMoney(priceMatch[1])
                // Find the description in previous context
                const descMatch = line.match(/^([^≈$]+?)(?:≈|\$|$)/)
                if (descMatch && descMatch[1].trim().length > 3 && prix > 0) {
                  items.push({
                    code: `${div.code}.${String(items.length + 1).padStart(2, "0")}`,
                    description: descMatch[1].trim(),
                    type: detectTypeFromDesc(descMatch[1]),
                    quantite: 1,
                    unite: "forf.",
                    prix_unitaire: prix,
                  })
                }
              }
            }
          }
          
          if (items.length > 0) {
            phaseData.divisions.set(div.code, {
              nom: DIVISIONS_MASTERFORMAT[div.code] || div.nom,
              items,
            })
          }
        }
      }
      
      // If no divisions found but there are inline items, try to extract them
      if (!phaseMap.get(phase.code)?.divisions.size) {
        // Look for inline items format: "Code  Description  Type  Qté  Prix  Total"
        const lines = section.split("\n")
        const items: any[] = []
        
        for (const line of lines) {
          if (!line.trim()) continue
          
          // Try to match "XX XX XX\tDescription\tType\tQty\tPrice\tTotal" format
          const cells = line.split("\t").map(c => c.trim())
          if (cells.length >= 5) {
            const codeMatch = cells[0].match(/^(\d{2})\s+(\d{2})\s+(\d{2})$/)
            if (codeMatch) {
              const prix = parseMoney(cells[4] || cells[5])
              if (prix > 0 && cells[1]?.length > 2) {
                items.push({
                  code: cells[0],
                  description: cells[1].replace(/⚠️/g, "").trim(),
                  type: normalizeType(cells[2] || "Mat."),
                  quantite: parseFloat(cells[3]?.replace(/[^\d.,]/g, "").replace(",", ".")) || 1,
                  unite: cells[3]?.match(/[a-z]+$/i)?.[0] || "u",
                  prix_unitaire: prix,
                })
              }
            }
          }
        }
        
        if (items.length > 0) {
          if (!phaseMap.has(phase.code)) {
            phaseMap.set(phase.code, { nom: phase.nom, divisions: new Map() })
          }
          const divCode = items[0].code.substring(0, 2)
          phaseMap.get(phase.code)!.divisions.set(divCode, {
            nom: DIVISIONS_MASTERFORMAT[divCode] || `Division ${divCode}`,
            items,
          })
        }
      }
    }
  }

  // STRATEGY 2d: Parse "SYNTHÈSE FINANCIÈRE" table format
  // Format: "Phase | Coûts directs | OH | Imprévus | Total HT"
  // "PH‑1 – ÉLECTRICITÉ SÉCURITÉ	9 850,00 $	985,00 $	1 773,00 $	12 608,00 $"
  if (!hasItems(phaseMap)) {
    const syntheseMatch = content.match(/SYNTH[ÈE]SE\s+FINANCI[ÈE]RE[^\n]*\n([\s\S]*?)(?=\n\n\d+\.\s+|TPS|TVQ|TOTAL\s+TTC|\n\n#)/i)
    if (syntheseMatch) {
      const syntheseSection = syntheseMatch[1]
      const lines = syntheseSection.split("\n")
      
      for (const line of lines) {
        if (!line.trim()) continue
        if (line.toLowerCase().includes("phase") && line.toLowerCase().includes("cout")) continue
        if (line.toLowerCase().includes("sous-total") || line.toLowerCase().includes("sous‑total")) continue
        if (line.includes("---")) continue
        
        // Try to match phase line: "PH‑1 – ÉLECTRICITÉ SÉCURITÉ	9 850,00 $	..."
        const phaseLineMatch = line.match(/PH[–—-](\d+)\s*[–—-]\s*([^\t|]+)/)
        if (phaseLineMatch) {
          const phaseCode = `PH-${phaseLineMatch[1]}`
          const phaseNom = phaseLineMatch[2].trim()
          
          // Extract the costs direct value (first money amount after phase name)
          const moneyMatches = line.match(/[\d\s,]+\s*\$/g)
          if (moneyMatches && moneyMatches.length > 0) {
            const coutsDirect = parseMoney(moneyMatches[0])
            
            if (coutsDirect > 0) {
              if (!phaseMap.has(phaseCode)) {
                phaseMap.set(phaseCode, { nom: phaseNom, divisions: new Map() })
              }
              
              // Create a generic division for this phase with a single forfait item
              const divCode = "00"
              phaseMap.get(phaseCode)!.divisions.set(divCode, {
                nom: phaseNom,
                items: [{
                  code: `${phaseCode.replace("PH-", "")}.00`,
                  description: `Forfait ${phaseNom}`,
                  type: "ST",
                  quantite: 1,
                  unite: "forf.",
                  prix_unitaire: coutsDirect,
                }],
              })
            }
          }
        }
      }
    }
  }
  
  // STRATEGY 2e: Parse "TOTALISATION PAR DIVISION" table
  // Format: "Division | Intitulé | Total"
  // "26 | Électricité | 9 850 $"
  if (!hasItems(phaseMap)) {
    const totalisationMatch = content.match(/TOTALISATION\s+PAR\s+DIVISION[^\n]*\n([\s\S]*?)(?=\n\n\d+\.\s+|TOTAL\s+DIRECT|\n\n#)/i)
    if (totalisationMatch) {
      const totSection = totalisationMatch[1]
      const lines = totSection.split("\n")
      
      const defaultPhaseCode = "PH-1"
      if (!phaseMap.has(defaultPhaseCode)) {
        phaseMap.set(defaultPhaseCode, { nom: nomProjet, divisions: new Map() })
      }
      const phaseData = phaseMap.get(defaultPhaseCode)!
      
      for (const line of lines) {
        if (!line.trim()) continue
        if (line.toLowerCase().includes("division") && line.toLowerCase().includes("intitul")) continue
        if (line.toLowerCase().includes("total direct")) continue
        if (line.includes("---")) continue
        
        // Parse pipe-separated or tab-separated: "26 | Électricité | 9 850 $"
        let cells = line.includes("|") 
          ? line.split("|").map(c => c.trim()).filter(Boolean)
          : line.split("\t").map(c => c.trim()).filter(Boolean)
        
        if (cells.length >= 3) {
          const divCode = cells[0].replace(/[^\d]/g, "").padStart(2, "0")
          const divNom = cells[1]
          const total = parseMoney(cells[2])
          
          if (divCode && total > 0 && divNom && divNom.length > 1) {
            phaseData.divisions.set(divCode, {
              nom: DIVISIONS_MASTERFORMAT[divCode] || divNom,
              items: [{
                code: `${divCode}.00`,
                description: `Forfait ${divNom}`,
                type: "ST",
                quantite: 1,
                unite: "forf.",
                prix_unitaire: total,
              }],
            })
          }
        }
      }
    }
  }

  // STRATEGY 3: Fallback - generic markdown tables
  if (phaseMap.size === 0 || !hasItems(phaseMap)) {
    const tables = extractTablesFromMarkdown(content)
    const defaultDivisions: Map<string, { nom: string; items: any[] }> = new Map()

    for (const table of tables) {
      const headers = table.data[0]?.map(h => h.toLowerCase()) || []
      const codeIdx = headers.findIndex(h => h.includes("code") || h.includes("no"))
      const descIdx = headers.findIndex(h => h.includes("desc"))
      const typeIdx = headers.findIndex(h => h.includes("type"))
      const qteIdx = headers.findIndex(h => h.includes("qte") || h.includes("qty") || h.includes("qté"))
      const uniteIdx = headers.findIndex(h => h.includes("unite") || h.includes("unit") || h.includes("unité"))
      const prixIdx = headers.findIndex(h => h.includes("prix"))
      const totalIdx = headers.findIndex(h => h.includes("total") || h.includes("montant"))

      for (let i = 1; i < table.data.length; i++) {
        const row = table.data[i]
        if (row.length < 2) continue
        if (row.join("").toLowerCase().includes("sous-total") || row.join("").toLowerCase().includes("sous‑total")) continue

        const itemCode = codeIdx >= 0 ? row[codeIdx] : ""
        const divCode = itemCode.length >= 2 ? itemCode.substring(0, 2).replace(/[.\s]/g, "") : "00"
        const desc = descIdx >= 0 ? row[descIdx] : row[1] || row[0]

        // Try prix unitaire first, then total as fallback
        let prix = 0
        let qte = 1
        if (prixIdx >= 0) {
          prix = parseMoney(row[prixIdx])
          qte = qteIdx >= 0 ? (parseFloat(row[qteIdx]?.replace(/[^\d.,]/g, "").replace(",", ".")) || 1) : 1
        } else if (totalIdx >= 0) {
          prix = parseMoney(row[totalIdx])
          qte = 1
        } else {
          // Last column is likely the total
          prix = parseMoney(row[row.length - 1])
          qte = 1
        }

        const unite = uniteIdx >= 0 ? row[uniteIdx] : "forf."

        if (desc && prix > 0) {
          if (!defaultDivisions.has(divCode)) {
            defaultDivisions.set(divCode, { nom: DIVISIONS_MASTERFORMAT[divCode] || `Division ${divCode}`, items: [] })
          }
          defaultDivisions.get(divCode)!.items.push({
            code: itemCode,
            description: desc.replace(/⚠️/g, "").trim(),
            type: typeIdx >= 0 ? normalizeType(row[typeIdx]) : detectTypeFromDesc(desc),
            quantite: qte,
            unite,
            prix_unitaire: prix,
          })
        }
      }
    }

    if (defaultDivisions.size > 0) {
      const phaseCode = "PH-1"
      if (!phaseMap.has(phaseCode)) {
        phaseMap.set(phaseCode, { nom: nomProjet.trim(), divisions: defaultDivisions })
      } else {
        // Merge into existing
        const phase = phaseMap.get(phaseCode)!
        for (const [k, v] of defaultDivisions) {
          if (!phase.divisions.has(k)) phase.divisions.set(k, v)
        }
      }
    }
  }

  // =====================================================================
  // DEDUPLICATION: If the same code+description appears more than once
  // in a division, keep only the LAST occurrence (most recent/corrected).
  // This handles cases where multiple revisions exist in the conversation.
  // =====================================================================
  for (const [, phaseData] of phaseMap) {
    for (const [, div] of phaseData.divisions) {
      if (div.items.length <= 1) continue
      const seen = new Map<string, number>()
      // Walk forward: for each code+description key, record the last index
      for (let i = 0; i < div.items.length; i++) {
        const key = `${div.items[i].code}::${div.items[i].description.toLowerCase()}`
        seen.set(key, i)
      }
      // Keep only items whose index matches the last occurrence
      div.items = div.items.filter((item, idx) => {
        const key = `${item.code}::${item.description.toLowerCase()}`
        return seen.get(key) === idx
      })
    }
  }

  // Convert map to phases
  if (phaseMap.size > 0) {
    const sortedPhases = Array.from(phaseMap.entries()).sort((a, b) => a[0].localeCompare(b[0]))
    for (const [code, phaseData] of sortedPhases) {
      const divisions = Array.from(phaseData.divisions.entries())
        .filter(([, div]) => div.items.length > 0)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([divCode, div]) => ({
          code: divCode,
          nom: div.nom,
          items: div.items,
        }))
      if (divisions.length > 0) {
        soumission.phases.push({ code, nom: phaseData.nom, divisions })
      }
    }
  }

  return soumission
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
function hasItems(phaseMap: Map<string, { nom: string; divisions: Map<string, { nom: string; items: any[] }> }>): boolean {
  for (const [, phase] of phaseMap) {
    for (const [, div] of phase.divisions) {
      if (div.items.length > 0) return true
    }
  }
  return false
}

function parseMoney(s: string | undefined): number {
  if (!s) return 0
  // Remove currency symbols, spaces used as thousands separators, then parse
  // Handles: "2 660,00 $", "900,00$", "1,400.00", "3 200,00 $"
  let cleaned = s.replace(/[$\s]/g, "").trim()
  // If comma is used as decimal separator (French format): "2660,00" -> "2660.00"
  // But also handle "1,400.00" (English format)
  if (cleaned.includes(",") && cleaned.includes(".")) {
    // Both present: comma is thousands sep, dot is decimal
    cleaned = cleaned.replace(/,/g, "")
  } else if (cleaned.includes(",")) {
    // Only comma: it's the decimal separator (French)
    cleaned = cleaned.replace(",", ".")
  }
  return parseFloat(cleaned) || 0
}

function extractValue(content: string, regex: RegExp): string | null {
  const match = content.match(regex)
  return match ? match[1].trim() : null
}

function normalizeType(type: string): string {
  const t = type.toLowerCase().trim()
  if (t.includes("mo") || t.includes("main") || t === "h") return "MO"
  if (t.includes("mat")) return "Mat."
  if (t.includes("loc")) return "Loc."
  if (t.includes("st") || t.includes("sous")) return "ST"
  if (t.includes("equip") || t.includes("équip")) return "Equip."
  return type
}

function detectTypeFromDesc(desc: string): string {
  const d = desc.toLowerCase()
  if (d.includes("main") || d.includes("mo ") || d.includes("installation") || d.includes("pose") || d.includes("finition") || d.includes("ponçage") || d.includes("peinture") || d.includes("joints")) return "MO"
  if (d.includes("location") || d.includes("loc")) return "Loc."
  if (d.includes("sous-trait") || d.includes("st")) return "ST"
  if (d.includes("mobilisation") || d.includes("coordination") || d.includes("assurance") || d.includes("gestion")) return "ST"
  if (d.includes("excavat") || d.includes("transport") || d.includes("compactage") || d.includes("implantation")) return "ST"
  if (d.includes("électri") || d.includes("circuit") || d.includes("luminaire") || d.includes("plinthe") || d.includes("thermostat")) return "ST"
  return "Mat."
}

function extractTablesFromMarkdown(markdown: string): Array<{ name: string; data: string[][] }> {
  const tables: Array<{ name: string; data: string[][] }> = []
  const lines = markdown.split("\n")

  let currentSection = ""
  let inTable = false
  let currentTable: string[][] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    if (line.startsWith("#")) {
      currentSection = line.replace(/^#+\s*/, "").replace(/\*\*/g, "").trim()
    }

    if (line.startsWith("|") && !inTable) {
      inTable = true
      currentTable = []
    }

    if (inTable && line.startsWith("|")) {
      if (!line.includes("---")) {
        const cells = line
          .split("|")
          .slice(1, -1)
          .map(cell => cell.trim())
        currentTable.push(cells)
      }
    } else if (inTable && !line.startsWith("|")) {
      if (currentTable.length > 0) {
        tables.push({ name: currentSection || `Tableau ${tables.length + 1}`, data: currentTable })
      }
      inTable = false
      currentTable = []
    }
  }

  if (currentTable.length > 0) {
    tables.push({ name: currentSection || `Tableau ${tables.length + 1}`, data: currentTable })
  }

  return tables
}
