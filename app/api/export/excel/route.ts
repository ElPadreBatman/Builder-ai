// app/api/export/soumission/route.ts
// Export Excel professionnel pour soumissions de construction
// Gestion A.F. Construction inc. | RBQ: 5806-1391-01
// Conforme au skill soumission-construction
// Format français (séparateur décimal: virgule)

import { type NextRequest, NextResponse } from "next/server"
// @ts-ignore - xlsx-js-style est un fork de xlsx avec support styling
import XLSX from "xlsx-js-style"
import type { Soumission, Phase } from "@/types/soumission"
import { calculerTotauxSoumission, TAUX_HORAIRES_DEFAUT, DIVISIONS_MASTERFORMAT } from "@/types/soumission"

// ============================================================================
// STYLES CONFORMES AU SKILL
// ============================================================================
const STYLES = {
  // En-têtes principaux (fond bleu foncé, texte blanc)
  header: {
    fill: { fgColor: { rgb: "2F5496" } },
    font: { bold: true, color: { rgb: "FFFFFF" }, sz: 10 },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: {
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } },
    },
  },
  // Séparateurs de division (fond bleu clair)
  division: {
    fill: { fgColor: { rgb: "B4C6E7" } },
    font: { bold: true, sz: 10 },
    alignment: { horizontal: "left", vertical: "center" },
    border: {
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } },
    },
  },
  // Lignes de totaux (fond gris clair)
  total: {
    fill: { fgColor: { rgb: "D6DCE5" } },
    font: { bold: true, sz: 10 },
    border: {
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } },
    },
  },
  // Total TTC (fond orange Gestion AF)
  totalTTC: {
    fill: { fgColor: { rgb: "F47920" } },
    font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
    border: {
      top: { style: "medium", color: { rgb: "000000" } },
      bottom: { style: "medium", color: { rgb: "000000" } },
      left: { style: "medium", color: { rgb: "000000" } },
      right: { style: "medium", color: { rgb: "000000" } },
    },
  },
  // Cellules normales
  cell: {
    border: {
      top: { style: "thin", color: { rgb: "E0E0E0" } },
      bottom: { style: "thin", color: { rgb: "E0E0E0" } },
      left: { style: "thin", color: { rgb: "E0E0E0" } },
      right: { style: "thin", color: { rgb: "E0E0E0" } },
    },
    alignment: { vertical: "center" },
  },
  // Cellules monétaires
  currency: {
    border: {
      top: { style: "thin", color: { rgb: "E0E0E0" } },
      bottom: { style: "thin", color: { rgb: "E0E0E0" } },
      left: { style: "thin", color: { rgb: "E0E0E0" } },
      right: { style: "thin", color: { rgb: "E0E0E0" } },
    },
    alignment: { horizontal: "right", vertical: "center" },
  },
  // Titre document
  title: {
    font: { bold: true, sz: 14, color: { rgb: "F47920" } },
    alignment: { horizontal: "left" },
  },
  // Sous-titre
  subtitle: {
    font: { sz: 10, color: { rgb: "707070" } },
  },
}

// Format monétaire français (virgule comme séparateur décimal)
const FORMAT_CURRENCY_FR = '# ##0,00 "$"'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    let soumission: Soumission
    
    if (body.soumission) {
      soumission = body.soumission as Soumission
    } else if (body.content) {
      soumission = extractSoumissionFromMarkdown(body.content)
    } else {
      return NextResponse.json({ error: "Données de soumission manquantes" }, { status: 400 })
    }
    
    if (!soumission.projet?.nom || !soumission.phases?.length) {
      return NextResponse.json({ 
        error: "Soumission incomplète: nom du projet et au moins une phase requis" 
      }, { status: 400 })
    }
    
    const totaux = calculerTotauxSoumission(soumission)
    const workbook = XLSX.utils.book_new()
    
    // Feuille 1: Synthèse
    const wsSynthese = createSyntheseSheet(soumission, totaux)
    XLSX.utils.book_append_sheet(workbook, wsSynthese, "Synthèse")
    
    // Feuille 2: Détails par phase
    const wsDetails = createDetailsSheet(soumission)
    XLSX.utils.book_append_sheet(workbook, wsDetails, "Détails par phase")
    
    // Feuille 3: Par division
    const wsParDiv = createParDivisionSheet(soumission, totaux)
    XLSX.utils.book_append_sheet(workbook, wsParDiv, "Par division")
    
    // Feuille 4: Hypothèses
    const wsHypo = createHypothesesSheet(soumission)
    XLSX.utils.book_append_sheet(workbook, wsHypo, "Hypothèses")
    
    // Feuille 5: Inclusions-Exclusions
    const wsInclExcl = createInclusionsExclusionsSheet(soumission)
    XLSX.utils.book_append_sheet(workbook, wsInclExcl, "Inclusions-Exclusions")
    
    const excelBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })
    
    const dateStr = new Date().toISOString().split('T')[0]
    const projetSlug = soumission.projet.nom
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
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
// FEUILLE SYNTHÈSE
// ============================================================================
function createSyntheseSheet(soumission: Soumission, totaux: ReturnType<typeof calculerTotauxSoumission>) {
  const ws: any = {}
  const merge: any[] = []
  let row = 1
  
  // Titre
  ws[`A${row}`] = { v: `SOUMISSION - ${soumission.projet.nom.toUpperCase()}`, s: STYLES.title }
  merge.push({ s: { r: row - 1, c: 0 }, e: { r: row - 1, c: 4 } })
  row++
  
  // Sous-titre client/adresse
  ws[`A${row}`] = { 
    v: `Client: ${soumission.projet.client || 'À confirmer'} | Adresse: ${soumission.projet.adresse || 'À confirmer'}`,
    s: STYLES.subtitle 
  }
  merge.push({ s: { r: row - 1, c: 0 }, e: { r: row - 1, c: 4 } })
  row++
  
  // Date/validité
  ws[`A${row}`] = { 
    v: `Date: ${soumission.projet.date_soumission || new Date().toLocaleDateString('fr-CA')} | Validité: ${soumission.projet.validite_jours || 30} jours | RBQ: 5806-1391-01`,
    s: STYLES.subtitle 
  }
  merge.push({ s: { r: row - 1, c: 0 }, e: { r: row - 1, c: 4 } })
  row += 2
  
  // En-têtes tableau
  const tauxImprevuPct = Math.round(soumission.parametres.taux_imprevu * 100)
  const headers = ['Phase', 'Coûts directs', 'OH 10%', `Imprévus ${tauxImprevuPct}%`, 'Total HT']
  headers.forEach((h, i) => {
    ws[XLSX.utils.encode_cell({ r: row - 1, c: i })] = { v: h, s: STYLES.header }
  })
  row++
  
  // Données par phase
  const dataStartRow = row
  for (const phase of totaux.phaseDetails) {
    ws[`A${row}`] = { v: `${phase.code} - ${phase.nom}`, s: STYLES.cell }
    ws[`B${row}`] = { v: phase.cd, s: { ...STYLES.currency, numFmt: FORMAT_CURRENCY_FR } }
    ws[`C${row}`] = { f: `B${row}*0.1`, s: { ...STYLES.currency, numFmt: FORMAT_CURRENCY_FR } }
    ws[`D${row}`] = { f: `B${row}*${soumission.parametres.taux_imprevu}`, s: { ...STYLES.currency, numFmt: FORMAT_CURRENCY_FR } }
    ws[`E${row}`] = { f: `B${row}+C${row}+D${row}`, s: { ...STYLES.currency, numFmt: FORMAT_CURRENCY_FR } }
    row++
  }
  const dataEndRow = row - 1
  
  // Sous-total
  ws[`A${row}`] = { v: 'SOUS-TOTAL', s: STYLES.total }
  ws[`B${row}`] = { f: `SUM(B${dataStartRow}:B${dataEndRow})`, s: { ...STYLES.total, numFmt: FORMAT_CURRENCY_FR } }
  ws[`C${row}`] = { f: `SUM(C${dataStartRow}:C${dataEndRow})`, s: { ...STYLES.total, numFmt: FORMAT_CURRENCY_FR } }
  ws[`D${row}`] = { f: `SUM(D${dataStartRow}:D${dataEndRow})`, s: { ...STYLES.total, numFmt: FORMAT_CURRENCY_FR } }
  ws[`E${row}`] = { f: `SUM(E${dataStartRow}:E${dataEndRow})`, s: { ...STYLES.total, numFmt: FORMAT_CURRENCY_FR } }
  const subtotalRow = row
  row += 2
  
  // TPS
  ws[`D${row}`] = { v: 'TPS (5%)', s: { font: { bold: true }, alignment: { horizontal: 'right' } } }
  ws[`E${row}`] = { f: `E${subtotalRow}*0.05`, s: { ...STYLES.currency, numFmt: FORMAT_CURRENCY_FR } }
  const tpsRow = row
  row++
  
  // TVQ
  ws[`D${row}`] = { v: 'TVQ (9,975%)', s: { font: { bold: true }, alignment: { horizontal: 'right' } } }
  ws[`E${row}`] = { f: `E${subtotalRow}*0.09975`, s: { ...STYLES.currency, numFmt: FORMAT_CURRENCY_FR } }
  const tvqRow = row
  row++
  
  // Total TTC
  ws[`D${row}`] = { v: 'TOTAL TTC', s: STYLES.totalTTC }
  ws[`E${row}`] = { f: `E${subtotalRow}+E${tpsRow}+E${tvqRow}`, s: { ...STYLES.totalTTC, numFmt: FORMAT_CURRENCY_FR } }
  
  // Définir la plage et les fusions
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: row - 1, c: 4 } })
  ws['!merges'] = merge
  ws['!cols'] = [
    { wch: 30 },
    { wch: 15 },
    { wch: 12 },
    { wch: 15 },
    { wch: 15 },
  ]
  
  return ws
}

// ============================================================================
// FEUILLE DÉTAILS PAR PHASE
// ============================================================================
function createDetailsSheet(soumission: Soumission) {
  const ws: any = {}
  const merge: any[] = []
  let row = 1
  
  // En-têtes
  const headers = ['Code', 'Description', 'Type', 'Unité', 'Qté', 'Prix un.', 'Total', 'Phase']
  headers.forEach((h, i) => {
    ws[XLSX.utils.encode_cell({ r: 0, c: i })] = { v: h, s: STYLES.header }
  })
  row++
  
  for (const phase of soumission.phases) {
    for (const division of phase.divisions) {
      // Séparateur de division
      const divNom = DIVISIONS_MASTERFORMAT[division.code] || division.nom
      ws[`A${row}`] = { v: `Division ${division.code} - ${divNom}`, s: STYLES.division }
      // Fusionner la ligne de division
      merge.push({ s: { r: row - 1, c: 0 }, e: { r: row - 1, c: 7 } })
      for (let c = 1; c <= 7; c++) {
        ws[XLSX.utils.encode_cell({ r: row - 1, c })] = { v: '', s: STYLES.division }
      }
      row++
      
      // Items
      const itemsStartRow = row
      for (const item of division.items) {
        const desc = item.est_estimation ? `${item.description} ⚠️` : item.description
        ws[`A${row}`] = { v: item.code || '', s: STYLES.cell }
        ws[`B${row}`] = { v: desc, s: STYLES.cell }
        ws[`C${row}`] = { v: item.type, s: { ...STYLES.cell, alignment: { horizontal: 'center' } } }
        ws[`D${row}`] = { v: item.unite, s: { ...STYLES.cell, alignment: { horizontal: 'center' } } }
        ws[`E${row}`] = { v: item.quantite, s: { ...STYLES.cell, numFmt: '#,##0.00' } }
        ws[`F${row}`] = { v: item.prix_unitaire, s: { ...STYLES.currency, numFmt: FORMAT_CURRENCY_FR } }
        ws[`G${row}`] = { f: `E${row}*F${row}`, s: { ...STYLES.currency, numFmt: FORMAT_CURRENCY_FR } }
        ws[`H${row}`] = { v: phase.code, s: { ...STYLES.cell, alignment: { horizontal: 'center' } } }
        row++
      }
      
      // Sous-total division
      if (division.items.length > 0) {
        ws[`A${row}`] = { v: '', s: STYLES.total }
        ws[`B${row}`] = { v: `Sous-total Div. ${division.code}`, s: STYLES.total }
        ws[`C${row}`] = { v: '', s: STYLES.total }
        ws[`D${row}`] = { v: '', s: STYLES.total }
        ws[`E${row}`] = { v: '', s: STYLES.total }
        ws[`F${row}`] = { v: '', s: STYLES.total }
        ws[`G${row}`] = { f: `SUM(G${itemsStartRow}:G${row - 1})`, s: { ...STYLES.total, numFmt: FORMAT_CURRENCY_FR } }
        ws[`H${row}`] = { v: '', s: STYLES.total }
        row++
      }
    }
  }
  
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: row - 1, c: 7 } })
  ws['!merges'] = merge
  ws['!cols'] = [
    { wch: 10 },
    { wch: 45 },
    { wch: 6 },
    { wch: 8 },
    { wch: 8 },
    { wch: 12 },
    { wch: 12 },
    { wch: 7 },
  ]
  
  return ws
}

// ============================================================================
// FEUILLE PAR DIVISION
// ============================================================================
function createParDivisionSheet(soumission: Soumission, totaux: ReturnType<typeof calculerTotauxSoumission>) {
  const ws: any = {}
  let row = 1
  
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
  
  // En-têtes
  const headers = ['Division', 'Intitulé', 'MO $', 'Mat./Loc. $', 'Total']
  headers.forEach((h, i) => {
    ws[XLSX.utils.encode_cell({ r: 0, c: i })] = { v: h, s: STYLES.header }
  })
  row++
  
  const sortedDivisions = Object.entries(divisionTotals).sort((a, b) => a[0].localeCompare(b[0]))
  const dataStartRow = row
  
  for (const [code, div] of sortedDivisions) {
    ws[`A${row}`] = { v: code, s: STYLES.cell }
    ws[`B${row}`] = { v: div.nom, s: STYLES.cell }
    ws[`C${row}`] = { v: div.mo, s: { ...STYLES.currency, numFmt: FORMAT_CURRENCY_FR } }
    ws[`D${row}`] = { v: div.mat, s: { ...STYLES.currency, numFmt: FORMAT_CURRENCY_FR } }
    ws[`E${row}`] = { f: `C${row}+D${row}`, s: { ...STYLES.currency, numFmt: FORMAT_CURRENCY_FR } }
    row++
  }
  const dataEndRow = row - 1
  
  // Total
  ws[`A${row}`] = { v: '', s: STYLES.total }
  ws[`B${row}`] = { v: 'TOTAL', s: STYLES.total }
  ws[`C${row}`] = { f: `SUM(C${dataStartRow}:C${dataEndRow})`, s: { ...STYLES.total, numFmt: FORMAT_CURRENCY_FR } }
  ws[`D${row}`] = { f: `SUM(D${dataStartRow}:D${dataEndRow})`, s: { ...STYLES.total, numFmt: FORMAT_CURRENCY_FR } }
  ws[`E${row}`] = { f: `SUM(E${dataStartRow}:E${dataEndRow})`, s: { ...STYLES.total, numFmt: FORMAT_CURRENCY_FR } }
  
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: row - 1, c: 4 } })
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
// FEUILLE HYPOTHÈSES
// ============================================================================
function createHypothesesSheet(soumission: Soumission) {
  const ws: any = {}
  let row = 1
  
  // En-têtes
  const headers = ['Élément', 'Valeur', 'Unité', 'Source', 'Notes']
  headers.forEach((h, i) => {
    ws[XLSX.utils.encode_cell({ r: 0, c: i })] = { v: h, s: STYLES.header }
  })
  row++
  
  // Hypothèses du projet
  const hypotheses = [...(soumission.hypotheses || [])]
  
  // Ajouter infos projet
  hypotheses.push(
    { element: 'Type soumission', valeur: soumission.projet.categorie, unite: '', source: 'RBQ', notes: `Imprévus ${Math.round(soumission.parametres.taux_imprevu * 100)}%` },
    { element: 'Durée estimée', valeur: soumission.projet.duree_jours.toString(), unite: 'jours', source: 'Estimation', notes: '' }
  )
  
  // Taux horaires
  const taux = soumission.taux_horaires || TAUX_HORAIRES_DEFAUT
  for (const [metier, tauxHoraire] of Object.entries(taux)) {
    if (tauxHoraire) {
      hypotheses.push({
        element: `Taux ${metier.charAt(0).toUpperCase() + metier.slice(1)}`,
        valeur: tauxHoraire.toFixed(2).replace('.', ','),
        unite: '$/h',
        source: 'CCQ',
        notes: ''
      })
    }
  }
  
  for (const hypo of hypotheses) {
    const bgStyle = row % 2 === 0 ? { fill: { fgColor: { rgb: "FAFAFA" } } } : {}
    ws[`A${row}`] = { v: hypo.element, s: { ...STYLES.cell, ...bgStyle } }
    ws[`B${row}`] = { v: hypo.valeur, s: { ...STYLES.cell, ...bgStyle } }
    ws[`C${row}`] = { v: hypo.unite || '', s: { ...STYLES.cell, ...bgStyle } }
    ws[`D${row}`] = { v: hypo.source, s: { ...STYLES.cell, ...bgStyle } }
    ws[`E${row}`] = { v: hypo.notes || '', s: { ...STYLES.cell, ...bgStyle } }
    row++
  }
  
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: row - 1, c: 4 } })
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
// FEUILLE INCLUSIONS-EXCLUSIONS
// ============================================================================
function createInclusionsExclusionsSheet(soumission: Soumission) {
  const ws: any = {}
  let row = 1
  
  // En-têtes
  ws['A1'] = { v: 'INCLUS (✅)', s: { ...STYLES.header, fill: { fgColor: { rgb: "E8F5E9" } }, font: { bold: true, color: { rgb: "2E7D32" } } } }
  ws['B1'] = { v: '', s: STYLES.header }
  ws['C1'] = { v: 'EXCLUS (❌)', s: { ...STYLES.header, fill: { fgColor: { rgb: "FFEBEE" } }, font: { bold: true, color: { rgb: "C62828" } } } }
  row++
  
  const inclusions = soumission.inclusions || []
  const exclusions = soumission.exclusions || []
  const maxLen = Math.max(inclusions.length, exclusions.length, 1)
  
  for (let i = 0; i < maxLen; i++) {
    ws[`A${row}`] = { 
      v: inclusions[i] ? `✅ ${inclusions[i]}` : '', 
      s: { ...STYLES.cell, font: { color: { rgb: "2E7D32" } } } 
    }
    ws[`B${row}`] = { v: '', s: STYLES.cell }
    ws[`C${row}`] = { 
      v: exclusions[i] ? `❌ ${exclusions[i]}` : '', 
      s: { ...STYLES.cell, font: { color: { rgb: "C62828" } } } 
    }
    row++
  }
  
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: row - 1, c: 2 } })
  ws['!cols'] = [
    { wch: 50 },
    { wch: 5 },
    { wch: 50 },
  ]
  
  return ws
}

// ============================================================================
// EXTRACTION DEPUIS MARKDOWN
// ============================================================================
function extractSoumissionFromMarkdown(content: string): Soumission {
  const nomProjet = extractValue(content, /(?:SOUMISSION[^–—-]*[–—-]\s*TYPE\s*[A-D]\s*\n)([^\n]+)/i) 
    || extractValue(content, /(?:Objet|Projet)[:\s]+([^\n]+)/i)
    || 'Soumission'
  
  const typeMatch = content.match(/Type\s*([A-D])/i)
  const categorie = (typeMatch ? typeMatch[1].toUpperCase() : 'C') as 'A' | 'B' | 'C' | 'D'
  
  const tauxImprevus: Record<string, number> = { 'A': 0.10, 'B': 0.15, 'C': 0.20, 'D': 0.25 }
  
  const adresse = extractValue(content, /(?:Chantier|Adresse)[:\s]+([^\n,]+)/i) || 'À confirmer'
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
  
  // Extraire inclusions
  const inclusionsMatch = content.match(/INCLUS[^\n]*\n((?:.*?(?:✓|✅)[^\n]*\n?)+)/gi)
  if (inclusionsMatch) {
    const inclusionLines = inclusionsMatch[0].match(/(?:✓|✅)\s*([^\n✓✅❌]+)/g)
    if (inclusionLines) {
      soumission.inclusions = inclusionLines.map(l => l.replace(/^[✓✅]\s*/, '').trim())
    }
  }
  
  // Extraire exclusions
  const exclusionsMatch = content.match(/EXCLUS[^\n]*\n((?:.*?(?:❌|✗)[^\n]*\n?)+)/gi)
  if (exclusionsMatch) {
    const exclusionLines = exclusionsMatch[0].match(/(?:❌|✗)\s*([^\n✓✅❌]+)/g)
    if (exclusionLines) {
      soumission.exclusions = exclusionLines.map(l => l.replace(/^[❌✗]\s*/, '').trim())
    }
  }
  
  // Extraire les divisions
  const divisions: Map<string, { nom: string; items: any[] }> = new Map()
  
  // Parser les tableaux avec le format de l'agent
  const tableRegex = /\|\s*([0-9]{2}\s*[0-9]{2}\s*[0-9]{2})\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|/g
  let itemMatch
  
  while ((itemMatch = tableRegex.exec(content)) !== null) {
    const code = itemMatch[1].trim()
    const description = itemMatch[2].trim()
    const type = itemMatch[3].trim()
    const unite = itemMatch[4].trim()
    const qteStr = itemMatch[5].trim()
    const prixStr = itemMatch[6].trim()
    
    const divCode = code.substring(0, 2).replace(/\s/g, '')
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
  
  // Fallback: tableaux markdown standards
  if (divisions.size === 0) {
    const tables = extractTablesFromMarkdown(content)
    const defaultDiv = { nom: 'Travaux', items: [] as any[] }
    
    for (const table of tables) {
      const headers = table.data[0]?.map(h => h.toLowerCase()) || []
      const codeIdx = headers.findIndex(h => h.includes('code'))
      const descIdx = headers.findIndex(h => h.includes('desc'))
      const typeIdx = headers.findIndex(h => h.includes('type'))
      const qteIdx = headers.findIndex(h => h.includes('qté') || h.includes('qty'))
      const uniteIdx = headers.findIndex(h => h.includes('unité') || h.includes('unit'))
      const prixIdx = headers.findIndex(h => h.includes('prix'))
      
      for (let i = 1; i < table.data.length; i++) {
        const row = table.data[i]
        if (row.length < 4) continue
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

function extractValue(content: string, regex: RegExp): string | null {
  const match = content.match(regex)
  return match ? match[1].trim() : null
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
