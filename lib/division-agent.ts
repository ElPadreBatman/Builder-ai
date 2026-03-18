// lib/division-agent.ts
// Template partagé pour tous les agents de division MasterFormat
// Chaque agent génère les items de sa division en utilisant les tools existants

import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface DivisionContext {
  workflowId: string
  divisionCode: string
  divisionName: string
  projectType: string
  complexity: "simple" | "standard" | "complex"
  pieces: string[]
  surfaces: Record<string, number>
  constraints: string[]
  existingItems?: any[]
}

export interface DivisionItem {
  code: string
  description: string
  quantity: number
  unit: string
  unit_price: number
  total: number
  source: "db" | "calculated" | "ai"
  confidence: number
}

export interface DivisionResult {
  division_code: string
  division_name: string
  items: DivisionItem[]
  subtotal: number
  warnings: string[]
  metadata: {
    item_count: number
    avg_confidence: number
    sources: Record<string, number>
  }
}

// Configuration des divisions MasterFormat avec leurs spécialités
export const DIVISION_CONFIG: Record<string, {
  name: string
  keywords: string[]
  priceCategories: string[]
  checklistTypes: string[]
}> = {
  "01": {
    name: "Conditions générales",
    keywords: ["permis", "assurance", "supervision", "mobilisation"],
    priceCategories: ["general", "admin"],
    checklistTypes: ["general_conditions"]
  },
  "02": {
    name: "Conditions existantes",
    keywords: ["démolition", "protection", "décontamination"],
    priceCategories: ["demolition"],
    checklistTypes: ["demolition", "hazmat"]
  },
  "03": {
    name: "Béton",
    keywords: ["béton", "coffrage", "armature", "fondation"],
    priceCategories: ["concrete", "foundation"],
    checklistTypes: ["concrete", "foundation"]
  },
  "04": {
    name: "Maçonnerie",
    keywords: ["brique", "bloc", "pierre", "mortier"],
    priceCategories: ["masonry"],
    checklistTypes: ["masonry"]
  },
  "05": {
    name: "Métaux",
    keywords: ["acier", "structure", "escalier métal", "rampe"],
    priceCategories: ["steel", "metal"],
    checklistTypes: ["structural_steel"]
  },
  "06": {
    name: "Bois et plastiques",
    keywords: ["charpente", "ossature", "contreplaqué", "moulure"],
    priceCategories: ["wood", "lumber", "framing"],
    checklistTypes: ["framing", "finish_carpentry"]
  },
  "07": {
    name: "Protection thermique et humidité",
    keywords: ["isolation", "membrane", "toiture", "étanchéité"],
    priceCategories: ["insulation", "roofing", "waterproofing"],
    checklistTypes: ["insulation", "roofing"]
  },
  "08": {
    name: "Ouvertures",
    keywords: ["porte", "fenêtre", "vitrage", "quincaillerie"],
    priceCategories: ["doors", "windows", "hardware"],
    checklistTypes: ["doors_windows"]
  },
  "09": {
    name: "Finitions",
    keywords: ["gypse", "peinture", "céramique", "plancher"],
    priceCategories: ["drywall", "paint", "tile", "flooring"],
    checklistTypes: ["drywall", "painting", "tile", "flooring"]
  },
  "10": {
    name: "Spécialités",
    keywords: ["accessoire", "signalisation", "casier"],
    priceCategories: ["specialties"],
    checklistTypes: ["specialties"]
  },
  "22": {
    name: "Plomberie",
    keywords: ["plomberie", "tuyauterie", "robinet", "toilette", "lavabo"],
    priceCategories: ["plumbing"],
    checklistTypes: ["plumbing", "fixtures"]
  },
  "23": {
    name: "CVAC",
    keywords: ["chauffage", "ventilation", "climatisation", "conduit"],
    priceCategories: ["hvac"],
    checklistTypes: ["hvac"]
  },
  "26": {
    name: "Électricité",
    keywords: ["électrique", "câblage", "panneau", "prise", "luminaire"],
    priceCategories: ["electrical"],
    checklistTypes: ["electrical", "lighting"]
  },
  "31": {
    name: "Terrassement",
    keywords: ["excavation", "remblai", "drainage"],
    priceCategories: ["excavation", "sitework"],
    checklistTypes: ["sitework"]
  },
  "32": {
    name: "Aménagement extérieur",
    keywords: ["pavage", "clôture", "aménagement paysager"],
    priceCategories: ["paving", "landscaping"],
    checklistTypes: ["exterior"]
  }
}

/**
 * Agent de division - génère les items pour une division MasterFormat
 */
export async function generateDivisionItems(context: DivisionContext): Promise<DivisionResult> {
  const config = DIVISION_CONFIG[context.divisionCode]
  if (!config) {
    return {
      division_code: context.divisionCode,
      division_name: `Division ${context.divisionCode}`,
      items: [],
      subtotal: 0,
      warnings: [`Division ${context.divisionCode} non configurée`],
      metadata: { item_count: 0, avg_confidence: 0, sources: {} }
    }
  }

  const items: DivisionItem[] = []
  const warnings: string[] = []
  const sources: Record<string, number> = { db: 0, calculated: 0, ai: 0 }

  // 1. Charger les seuils pour cette division
  const { data: thresholds } = await supabase
    .from("division_thresholds")
    .select("*")
    .eq("division_code", context.divisionCode)
    .single()

  const minItems = thresholds?.[`min_items_${context.complexity}`] || 1
  const maxItems = thresholds?.[`max_items_${context.complexity}`] || 50

  // 2. Chercher les prix dans la base de données
  for (const category of config.priceCategories) {
    const { data: prices } = await supabase
      .from("construction_prices")
      .select("*")
      .ilike("category", `%${category}%`)
      .limit(20)

    if (prices) {
      for (const price of prices) {
        // Vérifier si pertinent pour les pièces du projet
        const isRelevant = context.pieces.some(piece => 
          config.keywords.some(kw => 
            piece.toLowerCase().includes(kw) || 
            price.description?.toLowerCase().includes(kw)
          )
        )

        if (isRelevant || prices.length < 5) {
          const quantity = calculateQuantity(price, context)
          if (quantity > 0) {
            items.push({
              code: `${context.divisionCode}-${String(items.length + 1).padStart(3, "0")}`,
              description: price.description || price.item_name,
              quantity,
              unit: price.unit || "unité",
              unit_price: price.price_per_unit || price.unit_price || 0,
              total: quantity * (price.price_per_unit || price.unit_price || 0),
              source: "db",
              confidence: 0.9
            })
            sources.db++
          }
        }
      }
    }
  }

  // 3. Charger les checklists pour items supplémentaires
  for (const checklistType of config.checklistTypes) {
    const { data: checklists } = await supabase
      .from("assembly_checklists")
      .select("*")
      .ilike("assembly_type", `%${checklistType}%`)
      .limit(10)

    if (checklists) {
      for (const checklist of checklists) {
        // Éviter les doublons
        const exists = items.some(item => 
          item.description.toLowerCase().includes(checklist.item_description?.toLowerCase() || "")
        )

        if (!exists && checklist.item_description) {
          const quantity = 1 // Par défaut pour checklist
          const unitPrice = checklist.estimated_cost || 50

          items.push({
            code: `${context.divisionCode}-${String(items.length + 1).padStart(3, "0")}`,
            description: checklist.item_description,
            quantity,
            unit: "forfait",
            unit_price: unitPrice,
            total: quantity * unitPrice,
            source: "db",
            confidence: 0.7
          })
          sources.db++
        }
      }
    }
  }

  // 4. Calculer items basés sur les surfaces (géométrie)
  const geometryItems = await calculateGeometryBasedItems(context, config)
  for (const geoItem of geometryItems) {
    const exists = items.some(item => 
      item.description.toLowerCase() === geoItem.description.toLowerCase()
    )
    if (!exists) {
      items.push(geoItem)
      sources.calculated++
    }
  }

  // 5. Validation des seuils
  if (items.length < minItems) {
    warnings.push(`Division ${context.divisionCode}: ${items.length} items < minimum ${minItems}`)
  }
  if (items.length > maxItems) {
    warnings.push(`Division ${context.divisionCode}: ${items.length} items > maximum ${maxItems}`)
    // Tronquer aux items les plus importants
    items.sort((a, b) => b.total - a.total)
    items.splice(maxItems)
  }

  // 6. Calculer le sous-total et les métadonnées
  const subtotal = items.reduce((sum, item) => sum + item.total, 0)
  const avgConfidence = items.length > 0 
    ? items.reduce((sum, item) => sum + item.confidence, 0) / items.length 
    : 0

  // 7. Mettre à jour le workflow
  await supabase
    .from("soumission_workflow")
    .update({
      [`division_${context.divisionCode}_status`]: "completed",
      [`division_${context.divisionCode}_items`]: items.length,
      updated_at: new Date().toISOString()
    })
    .eq("id", context.workflowId)

  return {
    division_code: context.divisionCode,
    division_name: config.name,
    items,
    subtotal,
    warnings,
    metadata: {
      item_count: items.length,
      avg_confidence: avgConfidence,
      sources
    }
  }
}

/**
 * Calcule la quantité basée sur le contexte du projet
 */
function calculateQuantity(price: any, context: DivisionContext): number {
  const unit = (price.unit || "").toLowerCase()
  
  // Calculer selon l'unité
  if (unit.includes("pi²") || unit.includes("sf") || unit.includes("m²")) {
    // Surface totale
    const totalSurface = Object.values(context.surfaces).reduce((sum, s) => sum + s, 0)
    return Math.ceil(totalSurface * 1.1) // +10% pour pertes
  }
  
  if (unit.includes("pi.lin") || unit.includes("lf") || unit.includes("ml")) {
    // Périmètre estimé
    const totalSurface = Object.values(context.surfaces).reduce((sum, s) => sum + s, 0)
    return Math.ceil(Math.sqrt(totalSurface) * 4)
  }
  
  if (unit.includes("unité") || unit.includes("ea") || unit.includes("pce")) {
    // Par pièce
    return context.pieces.length
  }
  
  // Par défaut: 1 par pièce concernée
  return Math.max(1, context.pieces.length)
}

/**
 * Calcule les items basés sur la géométrie (formules)
 */
async function calculateGeometryBasedItems(
  context: DivisionContext, 
  config: typeof DIVISION_CONFIG[string]
): Promise<DivisionItem[]> {
  const items: DivisionItem[] = []
  
  // Charger les formules de géométrie
  const { data: formulas } = await supabase
    .from("geometry_formulas")
    .select("*")
    .in("category", config.priceCategories)
    .limit(10)

  if (!formulas) return items

  for (const formula of formulas) {
    try {
      // Variables disponibles
      const vars: Record<string, number> = {
        surface_totale: Object.values(context.surfaces).reduce((sum, s) => sum + s, 0),
        nb_pieces: context.pieces.length,
        ...context.surfaces
      }

      // Évaluer la formule (simple)
      let quantity = 0
      const expr = formula.formula || ""
      
      if (expr.includes("surface_totale")) {
        quantity = vars.surface_totale * (formula.multiplier || 1)
      } else if (expr.includes("nb_pieces")) {
        quantity = vars.nb_pieces * (formula.multiplier || 1)
      }

      if (quantity > 0) {
        // Chercher le prix unitaire
        const { data: priceData } = await supabase
          .from("construction_prices")
          .select("price_per_unit, unit")
          .ilike("item_name", `%${formula.item_name}%`)
          .limit(1)
          .single()

        const unitPrice = priceData?.price_per_unit || formula.default_price || 10

        items.push({
          code: `${context.divisionCode}-GEO-${String(items.length + 1).padStart(2, "0")}`,
          description: formula.description || formula.item_name,
          quantity: Math.ceil(quantity),
          unit: priceData?.unit || formula.unit || "unité",
          unit_price: unitPrice,
          total: Math.ceil(quantity) * unitPrice,
          source: "calculated",
          confidence: 0.8
        })
      }
    } catch (err) {
      // Ignorer les erreurs de formule
    }
  }

  return items
}

/**
 * Génère toutes les divisions pour un projet
 */
export async function generateAllDivisions(
  workflowId: string,
  projectContext: {
    projectType: string
    complexity: "simple" | "standard" | "complex"
    pieces: string[]
    surfaces: Record<string, number>
    constraints: string[]
    selectedDivisions: string[]
  }
): Promise<DivisionResult[]> {
  const results: DivisionResult[] = []

  for (const divisionCode of projectContext.selectedDivisions) {
    const result = await generateDivisionItems({
      workflowId,
      divisionCode,
      divisionName: DIVISION_CONFIG[divisionCode]?.name || `Division ${divisionCode}`,
      projectType: projectContext.projectType,
      complexity: projectContext.complexity,
      pieces: projectContext.pieces,
      surfaces: projectContext.surfaces,
      constraints: projectContext.constraints
    })
    results.push(result)
  }

  return results
}
