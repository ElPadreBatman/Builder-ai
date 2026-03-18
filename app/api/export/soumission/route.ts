// app/api/export/soumission/route.ts
// Export Excel professionnel pour soumissions de construction
// Gestion A.F. Construction inc. | RBQ: 5806-1391-01
// Conforme au skill soumission-construction

import { type NextRequest, NextResponse } from "next/server"
import * as XLSX from "xlsx"
import { createClient } from "@supabase/supabase-js"
import type { Soumission } from "@/types/soumission"
import { calculerTotauxSoumission, TAUX_HORAIRES_DEFAUT, DIVISIONS_MASTERFORMAT } from "@/types/soumission"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Formats
const CURRENCY_FORMAT = '#,##0.00 $'

// Couleurs du skill (format ARGB pour xlsx-js-style ou hex pour xlsx)
const COLORS = {
  HEADER_BG: '2F5496',      // Bleu foncé - en-têtes
  HEADER_FONT: 'FFFFFF',    // Blanc
  DIVISION_BG: 'B4C6E7',    // Bleu clair - séparateurs division
  TOTAL_BG: 'D6DCE5',       // Gris clair - totaux
  ORANGE: 'F47920',         // Orange Gestion AF
}

type CompanyInfo = {
  company_name: string | null
  rbq_number: string | null
  city: string | null
  province: string | null
  country: string | null
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Support deux modes: JSON structuré ou extraction depuis markdown
    let soumission: Soumission
    let userId: string | null = null
    let companyInfo: CompanyInfo = { company_name: null, rbq_number: null, city: null, province: null, country: null }
    
    if (body.soumission) {
      // Mode 1: Soumission JSON structurée
      soumission = body.soumission as Soumission
      userId = body.userId || null
    } else if (body.content) {
      // Mode 2: Extraction depuis le contenu markdown du chat
      soumission = extractSoumissionFromMarkdown(body.content)
      userId = body.userId || null
    } else {
      return NextResponse.json({ error: "Données de soumission manquantes" }, { status: 400 })
    }
    
    // Charger les infos de compagnie de l'utilisateur si userId fourni
    if (userId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_name, rbq_number, city, province, country")
        .eq("id", userId)
        .single()
      
      if (profile) {
        companyInfo = {
          company_name: profile.company_name,
          rbq_number: profile.rbq_number,
          city: profile.city,
          province: profile.province,
          country: profile.country,
        }
      }
    }
    
    // Valider les données minimales
    if (!soumission.projet?.nom || !soumission.phases?.length) {
      return NextResponse.json({ 
        error: "Soumission incomplète: nom du projet et au moins une phase requis" 
      }, { status: 400 })
    }
    
    // Calculer les totaux
    const totaux = calculerTotauxSoumission(soumission)
    
    // Créer le workbook
    const workbook = XLSX.utils.book_new()
    
    // Feuille 1: Synthèse (conforme au skill)
    const wsSynthese = createSyntheseSheet(soumission, totaux, companyInfo)
    XLSX.utils.book_append_sheet(workbook, wsSynthese, "Synthèse")
    
    // Feuille 2: Détails par phase (conforme au skill)
    const wsDetails = createDetailsSheet(soumission)
    XLSX.utils.book_append_sheet(workbook, wsDetails, "Détails par phase")
    
    // Feuille 3: Par division (conforme au skill)
    const wsParDiv = createParDivisionSheet(soumission, totaux)
    XLSX.utils.book_append_sheet(workbook, wsParDiv, "Par division")
    
    // Feuille 4: Hypothèses (conforme au skill)
    const wsHypo = createHypothesesSheet(soumission)
    XLSX.utils.book_append_sheet(workbook, wsHypo, "Hypothèses")
    
    // Feuille 5: Inclusions-Exclusions (conforme au skill)
    const wsInclExcl = createInclusionsExclusionsSheet(soumission)
    XLSX.utils.book_append_sheet(workbook, wsInclExcl, "Inclusions-Exclusions")
    
    // Générer le fichier
    const excelBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })
    
    // Nom du fichier
    const dateStr = new Date().toISOString().split('T')[0]
    const projetSlug = soumission.projet.nom
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Enlever accents
      .replace(/[^a-z0-9]+/g, '-')
      .substring(0, 30)
    const filename = `soumission-${projetSlug}-${dateStr}.xlsx`
    
    return new NextResponse(excelBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error("[v0] Error generating soumission Excel:", error)
    return NextResponse.json({ 
      error: "Erreur lors de la génération du fichier Excel",
      details: error instanceof Error ? error.message : "Erreur inconnue"
    }, { status: 500 })
  }
}

// ============================================================================
// FEUILLE SYNTHÈSE (Conforme au skill)
// Structure: Phase | Coûts directs | OH 10% | Imprévus X% | Total HT
// ============================================================================
function createSyntheseSheet(soumission: Soumission, totaux: ReturnType<typeof calculerTotauxSoumission>, companyInfo: CompanyInfo) {
  const data: any[][] = []
  
  // En-tête du document avec infos de compagnie
  const locationStr = [companyInfo.city, companyInfo.province, companyInfo.country].filter(Boolean).join(", ")
  
  data.push([`SOUMISSION - ${soumission.projet.nom.toUpperCase()}`])
  
  // Infos de compagnie si disponibles
  if (companyInfo.company_name) {
    data.push([`${companyInfo.company_name}`])
    if (companyInfo.rbq_number || locationStr) {
      const details = [companyInfo.rbq_number ? `RBQ: ${companyInfo.rbq_number}` : "", locationStr].filter(Boolean).join(" | ")
      if (details) data.push([details])
    }
  }
  
  data.push([`Client: ${soumission.projet.client || 'À confirmer'} | Adresse: ${soumission.projet.adresse || 'À confirmer'}`])
  data.push([`Date: ${soumission.projet.date_soumission || new Date().toLocaleDateString('fr-CA')} | Validité: ${soumission.projet.validite_jours || 30} jours`])
  data.push([]) // Ligne vide
  
  // En-têtes tableau - conforme au skill
  const tauxImprevuPct = Math.round(soumission.parametres.taux_imprevu * 100)
  data.push(['Phase', 'Coûts directs', 'OH 10%', `Imprévus ${tauxImprevuPct}%`, 'Total HT'])
  const headerRow = data.length
  
  // Données par phase avec FORMULES Excel
  const dataStartRow = data.length + 1
  for (let i = 0; i < totaux.phaseDetails.length; i++) {
    const phase = totaux.phaseDetails[i]
    const row = dataStartRow + i
    data.push([
      `${phase.code} - ${phase.nom}`,
      phase.cd,  // Sera formaté en currency
      `=B${row}*0.1`,  // OH 10% - FORMULE
      `=B${row}*${soumission.parametres.taux_imprevu}`,  // Imprévus - FORMULE
      `=B${row}+C${row}+D${row}`  // Total HT - FORMULE
    ])
  }
  const dataEndRow = data.length
  
  // Sous-total avec FORMULES
  const subtotalRow = data.length + 1
  data.push([
    'SOUS-TOTAL',
    `=SUM(B${dataStartRow}:B${dataEndRow})`,
    `=SUM(C${dataStartRow}:C${dataEndRow})`,
    `=SUM(D${dataStartRow}:D${dataEndRow})`,
    `=SUM(E${dataStartRow}:E${dataEndRow})`
  ])
  
  data.push([]) // Ligne vide
  
  // Taxes avec FORMULES - conforme au skill
  const tpsRow = data.length + 1
  data.push(['', '', '', 'TPS (5%)', `=E${subtotalRow}*0.05`])
  const tvqRow = data.length + 1
  data.push(['', '', '', 'TVQ (9,975%)', `=E${subtotalRow}*0.09975`])
  
  // Total TTC avec FORMULE
  data.push(['', '', '', 'TOTAL TTC', `=E${subtotalRow}+E${tpsRow}+E${tvqRow}`])
  
  const ws = XLSX.utils.aoa_to_sheet(data)
  
  // Largeurs colonnes
  ws['!cols'] = [
    { wch: 30 },  // Phase
    { wch: 14 },  // Coûts directs
    { wch: 12 },  // OH
    { wch: 14 },  // Imprévus
    { wch: 14 },  // Total HT
  ]
  
  // Appliquer le format monétaire aux cellules appropriées
  // Note: xlsx basique ne supporte pas le styling avancé sans xlsx-js-style
  // Les formules seront calculées à l'ouverture dans Excel
  
  return ws
}

// ============================================================================
// FEUILLE DÉTAILS PAR PHASE (Conforme au skill)
// Avec séparateurs de division (fond bleu clair #B4C6E7)
// ============================================================================
function createDetailsSheet(soumission: Soumission) {
  const data: any[][] = []
  
  // En-têtes - conforme au skill
  data.push(['Code', 'Description', 'Type', 'Unité', 'Qté', 'Prix un.', 'Total', 'Phase'])
  
  for (const phase of soumission.phases) {
    for (const division of phase.divisions) {
      // Séparateur de division (ligne fusionnée avec fond bleu clair)
      const divNom = DIVISIONS_MASTERFORMAT[division.code] || division.nom
      data.push([`Division ${division.code} - ${divNom}`, '', '', '', '', '', '', ''])
      
      // Items de la division
      const itemsStartRow = data.length + 1
      for (const item of division.items) {
        const row = data.length + 1
        const desc = item.est_estimation ? `${item.description} ⚠️` : item.description
        data.push([
          item.code || '',
          desc,
          item.type,
          item.unite,
          item.quantite,
          item.prix_unitaire,
          `=E${row}*F${row}`,  // FORMULE Total
          phase.code
        ])
      }
      
      // Sous-total division avec FORMULE
      if (division.items.length > 0) {
        const subtotalRow = data.length + 1
        data.push([
          '',
          `Sous-total Div. ${division.code}`,
          '',
          '',
          '',
          '',
          `=SUM(G${itemsStartRow}:G${subtotalRow - 1})`,
          ''
        ])
      }
    }
  }
  
  const ws = XLSX.utils.aoa_to_sheet(data)
  
  // Largeurs colonnes - conforme au skill
  ws['!cols'] = [
    { wch: 10 },  // Code
    { wch: 45 },  // Description
    { wch: 6 },   // Type
    { wch: 8 },   // Unité
    { wch: 7 },   // Qté
    { wch: 11 },  // Prix un.
    { wch: 12 },  // Total
    { wch: 7 },   // Phase
  ]
  
  return ws
}

// ============================================================================
// FEUILLE PAR DIVISION (Conforme au skill)
// Structure: Division | Intitulé | MO $ | Mat./Loc. $ | Total
// ============================================================================
function createParDivisionSheet(soumission: Soumission, totaux: ReturnType<typeof calculerTotauxSoumission>) {
  const data: any[][] = []
  
  // Agréger par division
  const divisionTotals: Record<string, { nom: string; mo: number; mat: number }> = {}
  
  for (const phase of soumission.phases) {
    for (const division of phase.divisions) {
      if (!divisionTotals[division.code]) {
        divisionTotals[division.code] = {
          nom: DIVISIONS_MASTERFORMAT[division.code] || division.nom,
          mo: 0,
          mat: 0
        }
      }
      
      for (const item of division.items) {
        const total = item.quantite * item.prix_unitaire
        if (item.type === 'MO') {
          divisionTotals[division.code].mo += total
        } else {
          divisionTotals[division.code].mat += total
        }
      }
    }
  }
  
  // En-têtes - conforme au skill
  data.push(['Division', 'Intitulé', 'MO $', 'Mat./Loc. $', 'Total'])
  
  // Trier par code de division
  const sortedDivisions = Object.entries(divisionTotals).sort((a, b) => a[0].localeCompare(b[0]))
  
  const dataStartRow = 2
  for (const [code, div] of sortedDivisions) {
    const row = data.length + 1
    data.push([
      code,
      div.nom,
      div.mo,
      div.mat,
      `=C${row}+D${row}`  // FORMULE
    ])
  }
  const dataEndRow = data.length
  
  // Total avec FORMULES
  data.push([
    '',
    'TOTAL',
    `=SUM(C${dataStartRow}:C${dataEndRow})`,
    `=SUM(D${dataStartRow}:D${dataEndRow})`,
    `=SUM(E${dataStartRow}:E${dataEndRow})`
  ])
  
  const ws = XLSX.utils.aoa_to_sheet(data)
  
  ws['!cols'] = [
    { wch: 10 },
    { wch: 30 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
  ]
  
  return ws
}

// ============================================================================
// FEUILLE HYPOTHÈSES (Conforme au skill)
// Structure: Élément | Valeur | Unité | Source | Notes
// ============================================================================
function createHypothesesSheet(soumission: Soumission) {
  const data: any[][] = []
  
  // En-têtes - conforme au skill
  data.push(['Élément', 'Valeur', 'Unité', 'Source', 'Notes'])
  
  // Hypothèses du projet
  if (soumission.hypotheses?.length) {
    for (const hypo of soumission.hypotheses) {
      data.push([
        hypo.element,
        hypo.valeur,
        hypo.unite || '',
        hypo.source,
        hypo.notes || ''
      ])
    }
  }
  
  // Ajouter les infos projet comme hypothèses par défaut
  data.push(['Type soumission', soumission.projet.categorie, '', 'RBQ', `Imprévus ${Math.round(soumission.parametres.taux_imprevu * 100)}%`])
  data.push(['Durée estimée', soumission.projet.duree_jours.toString(), 'jours', 'Estimation', ''])
  
  // Taux horaires utilisés
  const taux = soumission.taux_horaires || TAUX_HORAIRES_DEFAUT
  for (const [metier, tauxHoraire] of Object.entries(taux)) {
    if (tauxHoraire) {
      data.push([`Taux ${metier.charAt(0).toUpperCase() + metier.slice(1)}`, tauxHoraire.toFixed(2), '$/h', 'CCQ', ''])
    }
  }
  
  const ws = XLSX.utils.aoa_to_sheet(data)
  
  ws['!cols'] = [
    { wch: 25 },
    { wch: 15 },
    { wch: 10 },
    { wch: 15 },
    { wch: 40 },
  ]
  
  return ws
}

// ============================================================================
// FEUILLE INCLUSIONS-EXCLUSIONS (Conforme au skill)
// Structure: INCLUS (✅) | | EXCLUS (❌)
// ============================================================================
function createInclusionsExclusionsSheet(soumission: Soumission) {
  const data: any[][] = []
  
  // En-têtes - conforme au skill
  data.push(['INCLUS (✅)', '', 'EXCLUS (❌)'])
  
  const inclusions = soumission.inclusions || []
  const exclusions = soumission.exclusions || []
  const maxLen = Math.max(inclusions.length, exclusions.length, 1)
  
  for (let i = 0; i < maxLen; i++) {
    data.push([
      inclusions[i] ? `✅ ${inclusions[i]}` : '',
      '',
      exclusions[i] ? `❌ ${exclusions[i]}` : ''
    ])
  }
  
  const ws = XLSX.utils.aoa_to_sheet(data)
  
  ws['!cols'] = [
    { wch: 50 },
    { wch: 5 },
    { wch: 50 },
  ]
  
  return ws
}

// ============================================================================
// EXTRACTION DEPUIS MARKDOWN (Mode fallback amélioré)
// ============================================================================
function extractSoumissionFromMarkdown(content: string): Soumission {
  // Extraction améliorée depuis le format de soumission Gestion AF
  
  // Extraire le nom du projet (après "SOUMISSION BUDGÉTAIRE" ou similaire)
  const nomProjet = extractValue(content, /(?:SOUMISSION[^–—-]*[–—-]\s*TYPE\s*[A-D]\s*\n)([^\n]+)/i) 
    || extractValue(content, /(?:Objet|Projet)[:\s]+([^\n]+)/i)
    || 'Soumission'
  
  // Extraire le type (A, B, C, D)
  const typeMatch = content.match(/Type\s*([A-D])/i)
  const categorie = (typeMatch ? typeMatch[1].toUpperCase() : 'C') as 'A' | 'B' | 'C' | 'D'
  
  // Taux d'imprévus selon le type
  const tauxImprevus: Record<string, number> = { 'A': 0.10, 'B': 0.15, 'C': 0.20, 'D': 0.25 }
  
  // Extraire l'adresse
  const adresse = extractValue(content, /(?:Chantier|Adresse)[:\s]+([^\n,]+)/i) || 'À confirmer'
  
  // Extraire le client
  const client = extractValue(content, /Client[:\s]+([^\n]+)/i) || 'À confirmer'
  
  const soumission: Soumission = {
    projet: {
      nom: nomProjet.trim(),
      adresse: adresse.trim(),
      client: client.trim(),
      categorie,
      duree_jours: parseInt(extractValue(content, /durée[:\s]+(\d+)/i) || '5'),
      validite_jours: parseInt(extractValue(content, /[Vv]alidité[^:]*[:\s]+(\d+)/i) || '30'),
    },
    phases: [],
    parametres: {
      taux_imprevu: tauxImprevus[categorie] || 0.15,
      taux_fg: 0.10,
      taux_tps: 0.05,
      taux_tvq: 0.09975,
      inclure_deplacement: content.toLowerCase().includes('déplacement'),
    },
    inclusions: [],
    exclusions: [],
  }
  
  // Extraire les inclusions
  const inclusionsMatch = content.match(/INCLUS[^\n]*\n((?:.*?(?:✓|✅)[^\n]*\n?)+)/gi)
  if (inclusionsMatch) {
    const inclusionLines = inclusionsMatch[0].match(/(?:✓|✅)\s*([^\n✓✅❌]+)/g)
    if (inclusionLines) {
      soumission.inclusions = inclusionLines.map(l => l.replace(/^[✓✅]\s*/, '').trim())
    }
  }
  
  // Extraire les exclusions
  const exclusionsMatch = content.match(/EXCLUS[^\n]*\n((?:.*?(?:❌|✗)[^\n]*\n?)+)/gi)
  if (exclusionsMatch) {
    const exclusionLines = exclusionsMatch[0].match(/(?:❌|✗)\s*([^\n✓✅❌]+)/g)
    if (exclusionLines) {
      soumission.exclusions = exclusionLines.map(l => l.replace(/^[❌✗]\s*/, '').trim())
    }
  }
  
  // Extraire les divisions depuis les tableaux
  const divisionRegex = /(?:DIVISION|Div\.?)\s*(\d{2})\s*[–—-]\s*([^\n]+)/gi
  const divisions: Map<string, { nom: string; items: any[] }> = new Map()
  
  let divMatch
  while ((divMatch = divisionRegex.exec(content)) !== null) {
    const divCode = divMatch[1]
    const divNom = divMatch[2].trim()
    if (!divisions.has(divCode)) {
      divisions.set(divCode, { nom: divNom, items: [] })
    }
  }
  
  // Extraire les items des tableaux
  const tableRegex = /\|\s*([0-9]{2}\s*[0-9]{2}\s*[0-9]{2})\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|/g
  let itemMatch
  
  while ((itemMatch = tableRegex.exec(content)) !== null) {
    const code = itemMatch[1].trim()
    const description = itemMatch[2].trim()
    const type = itemMatch[3].trim()
    const unite = itemMatch[4].trim()
    const qteStr = itemMatch[5].trim()
    const prixStr = itemMatch[6].trim()
    
    // Déterminer la division depuis le code (premiers 2 chiffres)
    const divCode = code.substring(0, 2).replace(/\s/g, '')
    
    // Parser quantité et prix
    const quantite = parseFloat(qteStr.replace(/[^\d.,]/g, '').replace(',', '.')) || 1
    const prix_unitaire = parseFloat(prixStr.replace(/[^\d.,]/g, '').replace(',', '.')) || 0
    
    if (!divisions.has(divCode)) {
      divisions.set(divCode, { nom: DIVISIONS_MASTERFORMAT[divCode] || `Division ${divCode}`, items: [] })
    }
    
    divisions.get(divCode)!.items.push({
      code,
      description,
      type: normalizeType(type),
      quantite,
      unite,
      prix_unitaire,
    })
  }
  
  // Fallback: extraire depuis tableaux markdown standards
  if (divisions.size === 0) {
    const tables = extractTablesFromMarkdown(content)
    const defaultDiv = { nom: 'Travaux', items: [] as any[] }
    
    for (const table of tables) {
      // Chercher les colonnes pertinentes
      const headers = table.data[0]?.map(h => h.toLowerCase()) || []
      const codeIdx = headers.findIndex(h => h.includes('code'))
      const descIdx = headers.findIndex(h => h.includes('desc'))
      const typeIdx = headers.findIndex(h => h.includes('type'))
      const qteIdx = headers.findIndex(h => h.includes('qté') || h.includes('qty'))
      const uniteIdx = headers.findIndex(h => h.includes('unité') || h.includes('unit'))
      const prixIdx = headers.findIndex(h => h.includes('prix'))
      const totalIdx = headers.findIndex(h => h.includes('total'))
      
      for (let i = 1; i < table.data.length; i++) {
        const row = table.data[i]
        if (row.length < 4) continue
        
        // Skip les lignes de sous-total
        if (row.join('').toLowerCase().includes('sous-total')) continue
        
        const item = {
          code: codeIdx >= 0 ? row[codeIdx] : '',
          description: descIdx >= 0 ? row[descIdx] : row[1] || row[0],
          type: normalizeType(typeIdx >= 0 ? row[typeIdx] : detectType(row)),
          quantite: parseFloat((qteIdx >= 0 ? row[qteIdx] : row[2])?.replace(/[^\d.,]/g, '').replace(',', '.')) || 1,
          unite: uniteIdx >= 0 ? row[uniteIdx] : row[3] || 'unité',
          prix_unitaire: parseFloat((prixIdx >= 0 ? row[prixIdx] : row[4])?.replace(/[^\d.,]/g, '').replace(',', '.')) || 0,
        }
        
        if (item.description && item.prix_unitaire > 0) {
          defaultDiv.items.push(item)
        }
      }
    }
    
    if (defaultDiv.items.length > 0) {
      divisions.set('00', defaultDiv)
    }
  }
  
  // Construire la phase
  if (divisions.size > 0) {
    const phase: Phase = {
      code: 'PH-1',
      nom: extractValue(content, /PH[–—-]1\s*[–—-]\s*([^\n]+)/i) || nomProjet,
      divisions: Array.from(divisions.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([code, div]) => ({
          code,
          nom: div.nom,
          items: div.items,
        }))
    }
    soumission.phases.push(phase)
  }
  
  return soumission
}

function normalizeType(type: string): string {
  const t = type.toLowerCase().trim()
  if (t.includes('mo') || t.includes('main') || t === 'h') return 'MO'
  if (t.includes('mat')) return 'Mat.'
  if (t.includes('loc')) return 'Loc.'
  if (t.includes('st') || t.includes('sous')) return 'ST'
  if (t.includes('équip') || t.includes('equip')) return 'Équip.'
  return type
}

function extractValue(content: string, regex: RegExp): string | null {
  const match = content.match(regex)
  return match ? match[1].trim() : null
}

function detectType(row: string[]): string {
  const text = row.join(' ').toLowerCase()
  if (text.includes('main') || text.includes('mo') || text.includes('heure')) return 'MO'
  if (text.includes('location') || text.includes('loc')) return 'Loc.'
  if (text.includes('sous-trait') || text.includes('st')) return 'ST'
  return 'Mat.'
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
        const cells = line.split("|").slice(1, -1).map((cell) => cell.trim())
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
