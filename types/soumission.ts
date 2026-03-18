// types/soumission.ts
// Structure flexible pour les soumissions de construction

export interface Soumission {
  // Métadonnées
  id?: string
  conversation_id?: string
  created_at?: string
  
  // Informations projet
  projet: {
    nom: string
    adresse?: string
    client?: string
    categorie: 'A' | 'B' | 'C' | 'D'
    duree_jours: number
    distance_km?: number
    date_soumission?: string
    validite_jours?: number
  }
  
  // Phases dynamiques (peut avoir 1, 5, ou 10 phases)
  phases: Phase[]
  
  // Paramètres de calcul
  parametres: {
    taux_imprevu: number      // 0.05 à 0.25 selon catégorie
    taux_fg: number           // généralement 0.10
    taux_tps: number          // 0.05
    taux_tvq: number          // 0.09975
    inclure_deplacement: boolean
    shop_adresse?: string
    temps_deplacement_par_jour?: number  // heures
  }
  
  // Taux horaires CCQ (optionnel, utilise défauts si absent)
  taux_horaires?: {
    charpentier?: number
    cimentier?: number
    platrier?: number
    peintre?: number
    plombier?: number
    electricien?: number
    carreleur?: number
    operateur?: number
    [key: string]: number | undefined
  }
  
  // Inclusions/Exclusions (listes flexibles)
  inclusions?: string[]
  exclusions?: string[]
  
  // Hypothèses (liste flexible)
  hypotheses?: Hypothese[]
  
  // Notes additionnelles
  notes?: string
}

export interface Phase {
  code: string              // "PH-0", "PH-1", etc.
  nom: string               // "Salle de bain", "Cuisine", etc.
  description?: string
  duree_jours?: number
  divisions: Division[]
}

export interface Division {
  code: string              // "01", "02", "06", etc.
  nom: string               // "Exigences générales", etc.
  items: Item[]
  task_lists?: TaskList[]   // Groupes de tâches (optionnel)
}

export interface TaskList {
  id: string                // UUID unique
  name: string              // "Charpente", "Autres", etc.
  color?: string            // Couleur optionnelle pour l'affichage
  order: number             // Ordre d'affichage
  collapsed?: boolean       // État replié/déplié
}

export interface Item {
  id?: string               // UUID unique pour le drag & drop
  code?: string             // Code MasterFormat "06 11 00" (optionnel)
  description: string
  type: 'MO' | 'Mat.' | 'Loc.' | 'ST' | 'Équip.' | string
  quantite: number
  unite: string
  prix_unitaire: number
  notes?: string
  est_estimation?: boolean  // si c'est une estimation
  task_list_id?: string     // Référence à la liste de tâches parente
  order?: number            // Ordre dans la liste
}

export interface Hypothese {
  element: string
  valeur: string
  unite?: string
  source: string            // "CCQ", "Client", "⚠️ Estimation", etc.
  notes?: string
}

// Taux horaires CCQ par défaut (2024-2025)
export const TAUX_HORAIRES_DEFAUT = {
  charpentier: 86.00,
  cimentier: 86.00,
  platrier: 82.50,
  peintre: 75.00,
  plombier: 100.00,
  electricien: 104.00,
  carreleur: 100.75,
  operateur: 95.00,
}

// Taux d'imprévus par catégorie
export const TAUX_IMPREVUS_PAR_CATEGORIE = {
  'A': 0.05,  // Projet très bien défini
  'B': 0.10,  // Projet bien défini
  'C': 0.15,  // Projet partiellement défini
  'D': 0.20,  // Projet peu défini / estimation budgétaire
}

// Noms des divisions MasterFormat
export const DIVISIONS_MASTERFORMAT: Record<string, string> = {
  '01': 'Exigences générales',
  '02': 'Travaux préparatoires',
  '03': 'Béton',
  '04': 'Maçonnerie',
  '05': 'Métaux',
  '06': 'Bois et plastiques',
  '07': 'Protection thermique et humidité',
  '08': 'Portes et fenêtres',
  '09': 'Finitions',
  '10': 'Spécialités',
  '11': 'Équipement',
  '12': 'Ameublement',
  '21': 'Protection incendie',
  '22': 'Plomberie',
  '23': 'CVCA',
  '26': 'Électricité',
  '27': 'Communications',
  '31': 'Terrassement',
  '32': 'Aménagement extérieur',
  '33': 'Services publics',
}

// Fonction utilitaire pour calculer les totaux
export function calculerTotauxSoumission(soumission: Soumission) {
  let totalCD = 0
  let totalMO = 0
  let totalMat = 0
  
  const phaseDetails: Array<{
    code: string
    nom: string
    cd: number
    mo: number
    mat: number
  }> = []
  
  for (const phase of soumission.phases || []) {
    let phaseCD = 0
    let phaseMO = 0
    let phaseMat = 0
    
    for (const division of phase.divisions || []) {
      for (const item of division.items || []) {
        const total = (item.quantite || 0) * (item.prix_unitaire || 0)
        phaseCD += total
        
        if (item.type === 'MO') {
          phaseMO += total
        } else {
          phaseMat += total
        }
      }
    }
    
    phaseDetails.push({
      code: phase.code,
      nom: phase.nom,
      cd: phaseCD,
      mo: phaseMO,
      mat: phaseMat,
    })
    
    totalCD += phaseCD
    totalMO += phaseMO
    totalMat += phaseMat
  }
  
  // Safe access to parametres with defaults
  const params = soumission.parametres || {
    taux_fg: 0.10,
    taux_imprevu: 0.18,
    taux_tps: 0.05,
    taux_tvq: 0.09975,
  }
  
  const fg = totalCD * (params.taux_fg ?? 0.10)
  const imprevus = totalCD * (params.taux_imprevu ?? 0.18)
  const totalHT = totalCD + fg + imprevus
  const tps = totalHT * (params.taux_tps ?? 0.05)
  const tvq = totalHT * (params.taux_tvq ?? 0.09975)
  const totalTTC = totalHT + tps + tvq
  
  return {
    phaseDetails,
    totalCD,
    totalMO,
    totalMat,
    fg,
    imprevus,
    totalHT,
    tps,
    tvq,
    totalTTC,
  }
}
