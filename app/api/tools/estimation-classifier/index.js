/**
 * Module d'intégration du classificateur d'estimation pour agent OpenAI
 * Gestion A.F. Construction inc.
 *
 * Usage:
 *    1. Importer TOOL_DEFINITION pour l'ajouter aux tools de l'agent
 *    2. Appeler handleToolCall() quand l'agent invoque le tool
 */

// ============================================================================
// DÉFINITION DU TOOL POUR OPENAI
// ============================================================================

export const TOOL_DEFINITION = {
  type: "function",
  function: {
    name: "classify_estimation_type",
    description: `Détermine le type d'estimation (A à D) et la marge d'imprévus appropriée pour un projet de construction.

Types d'estimation:
- Type A (3-5%): Estimation définitive - plans complets, specs finales, soumissions fermes
- Type B (5-10%): Estimation détaillée - plans avancés, visite complète, choix finalisés  
- Type C (10-15%): Estimation préliminaire - plans préliminaires, plusieurs inconnues
- Type D (15-25%): Ordre de grandeur - information minimale, budget approximatif

UTILISER CE TOOL:
- AVANT de générer toute soumission ou estimation
- Pour calibrer les marges de risque selon les informations disponibles
- Pour identifier les facteurs de risque et recommandations`,
    parameters: {
      type: "object",
      properties: {
        project_description: {
          type: "string",
          description: "Description du projet (ex: rénovation salle de bain, agrandissement garage)"
        },
        plan_detail_level: {
          type: "string",
          enum: ["aucun", "croquis_client", "plans_preliminaires", "plans_complets", "plans_architecture_ingenierie"],
          description: "Niveau de détail des plans. aucun=verbal, croquis_client=main levée, plans_preliminaires=non finaux, plans_complets=exécution, plans_architecture_ingenierie=signés professionnels"
        },
        specifications_available: {
          type: "array",
          items: {
            type: "string",
            enum: ["aucune", "finitions_choisies", "devis_descriptif", "cahier_charges", "specifications_techniques"]
          },
          description: "Spécifications disponibles"
        },
        site_access: {
          type: "string",
          enum: ["aucun", "photos_client", "visite_rapide", "visite_complete", "visite_avec_ouvertures"],
          description: "Accès au site. aucun=jamais vu, photos_client=photos, visite_rapide=<30min, visite_complete=inspection, visite_avec_ouvertures=ouvertures exploratoires"
        },
        technical_complexity: {
          type: "string",
          enum: ["simple", "standard", "complexe", "tres_complexe"],
          description: "Complexité technique. simple=courant, standard=réno typique, complexe=structure/mécanique, tres_complexe=défis majeurs"
        },
        existing_conditions_known: {
          type: "boolean",
          description: "Conditions existantes (structure, mécanique cachée) connues/vérifiées?"
        },
        client_decisions_finalized: {
          type: "boolean",
          description: "Client a finalisé ses choix (finitions, équipements, layout)?"
        },
        similar_project_experience: {
          type: "boolean",
          description: "Expérience récente sur projet similaire avec coûts réels de référence?"
        },
        subcontractor_quotes: {
          type: "string",
          enum: ["aucune", "estimations_verbales", "soumissions_preliminaires", "soumissions_fermes"],
          description: "Niveau de confirmation des prix sous-traitants"
        },
        project_value_estimate: {
          type: "number",
          description: "Valeur estimée du projet en $ (optionnel)"
        },
        deadline_pressure: {
          type: "boolean",
          description: "Pression de délai limitant le temps d'analyse?"
        }
      },
      required: [
        "project_description",
        "plan_detail_level",
        "site_access",
        "technical_complexity",
        "existing_conditions_known",
        "client_decisions_finalized"
      ]
    }
  }
};

// ============================================================================
// LOGIQUE DE CLASSIFICATION
// ============================================================================

const PLAN_DETAIL_POINTS = {
  aucun: 0,
  croquis_client: 5,
  plans_preliminaires: 15,
  plans_complets: 25,
  plans_architecture_ingenierie: 30
};

const SPEC_POINTS = {
  aucune: 0,
  finitions_choisies: 5,
  devis_descriptif: 8,
  cahier_charges: 12,
  specifications_techniques: 15
};

const SITE_ACCESS_POINTS = {
  aucun: 0,
  photos_client: 5,
  visite_rapide: 10,
  visite_complete: 17,
  visite_avec_ouvertures: 20
};

const SUBCONTRACTOR_POINTS = {
  aucune: 0,
  estimations_verbales: 3,
  soumissions_preliminaires: 6,
  soumissions_fermes: 10
};

const COMPLEXITY_ADJUSTMENT = {
  simple: 0,
  standard: -5,
  complexe: -10,
  tres_complexe: -15
};

const ESTIMATION_TYPES = {
  A: {
    name: "Estimation définitive",
    min_score: 80,
    contingency_range: [0.03, 0.05],
    precision: "±5-10%"
  },
  B: {
    name: "Estimation détaillée",
    min_score: 60,
    contingency_range: [0.05, 0.10],
    precision: "±10-15%"
  },
  C: {
    name: "Estimation préliminaire",
    min_score: 40,
    contingency_range: [0.10, 0.15],
    precision: "±15-25%"
  },
  D: {
    name: "Ordre de grandeur",
    min_score: 0,
    contingency_range: [0.15, 0.25],
    precision: "±25-40%"
  }
};

/**
 * Classifie le type d'estimation et détermine la marge d'imprévus.
 */
export function classifyEstimationType({
  project_description,
  plan_detail_level,
  site_access,
  technical_complexity,
  existing_conditions_known,
  client_decisions_finalized,
  specifications_available = [],
  similar_project_experience = false,
  subcontractor_quotes = "aucune",
  project_value_estimate = null,
  deadline_pressure = false
}) {
  const risk_factors = [];
  const recommendations = [];

  // === Calcul du score ===

  const plans_score = PLAN_DETAIL_POINTS[plan_detail_level] || 0;
  if (plans_score === 0) {
    risk_factors.push("Aucun plan disponible - estimation basée sur description verbale");
    recommendations.push("Obtenir au minimum des croquis ou plans préliminaires");
  }

  let specs_score = 0;
  if (specifications_available && specifications_available.length > 0) {
    specs_score = Math.max(...specifications_available.map(spec => SPEC_POINTS[spec] || 0));
  }
  if (specs_score === 0) {
    risk_factors.push("Aucune spécification formelle");
    recommendations.push("Documenter les choix de finitions et équipements");
  }

  const site_score = SITE_ACCESS_POINTS[site_access] || 0;
  if (site_score <= 5) {
    risk_factors.push("Accès limité au site - conditions existantes incertaines");
    recommendations.push("Effectuer une visite complète du site avant soumission ferme");
  }

  const conditions_score = existing_conditions_known ? 10 : 0;
  if (!existing_conditions_known) {
    risk_factors.push("Conditions existantes non vérifiées (structure, mécanique cachée)");
  }

  const decisions_score = client_decisions_finalized ? 10 : 0;
  if (!client_decisions_finalized) {
    risk_factors.push("Choix client non finalisés - risque de changements");
    recommendations.push("Confirmer tous les choix de finitions avant soumission");
  }

  const experience_score = similar_project_experience ? 5 : 0;

  const subcontractor_score = SUBCONTRACTOR_POINTS[subcontractor_quotes] || 0;
  if (subcontractor_score < 6) {
    risk_factors.push("Aucune soumission sous-traitant confirmée");
    recommendations.push("Obtenir soumissions fermes des sous-traitants majeurs");
  }

  const complexity_adj = COMPLEXITY_ADJUSTMENT[technical_complexity] || 0;
  if (complexity_adj < -5) {
    risk_factors.push(`Complexité technique élevée (${technical_complexity})`);
  }

  const deadline_adj = deadline_pressure ? -5 : 0;
  if (deadline_pressure) {
    risk_factors.push("Pression de délai - temps d'analyse limité");
  }

  // === Score total ===

  const breakdown = {
    plans_documentation: plans_score,
    specifications: specs_score,
    site_knowledge: site_score,
    existing_conditions: conditions_score,
    client_decisions: decisions_score,
    experience: experience_score,
    subcontractor_quotes: subcontractor_score,
    complexity_adjustment: complexity_adj,
    deadline_adjustment: deadline_adj
  };

  const raw_score = plans_score + specs_score + site_score + conditions_score +
    decisions_score + experience_score + subcontractor_score;
  const final_score = Math.max(0, Math.min(100, raw_score + complexity_adj + deadline_adj));

  // === Type d'estimation ===

  let est_type;
  if (final_score >= 80) {
    est_type = "A";
  } else if (final_score >= 60) {
    est_type = "B";
  } else if (final_score >= 40) {
    est_type = "C";
  } else {
    est_type = "D";
  }

  const type_info = ESTIMATION_TYPES[est_type];
  const [min_rate, max_rate] = type_info.contingency_range;

  // Position dans la fourchette
  let position;
  if (est_type === "A") {
    position = (final_score - 80) / 20;
  } else if (est_type === "B") {
    position = (final_score - 60) / 20;
  } else if (est_type === "C") {
    position = (final_score - 40) / 20;
  } else {
    position = final_score / 40;
  }

  let contingency_rate = max_rate - (position * (max_rate - min_rate));

  // Ajustement gros projets
  if (project_value_estimate && project_value_estimate > 100000) {
    contingency_rate = Math.min(contingency_rate + 0.02, max_rate);
    risk_factors.push(`Projet de grande valeur (${project_value_estimate.toLocaleString('fr-CA')}$) - marge conservatrice`);
  }

  contingency_rate = Math.round(contingency_rate * 100) / 100;

  // === Justification ===

  const justification_parts = [`Type ${est_type} attribué (score: ${final_score}/100).`];

  if (plans_score >= 25) {
    justification_parts.push("Plans complets disponibles.");
  } else if (plans_score >= 15) {
    justification_parts.push("Plans préliminaires seulement.");
  } else {
    justification_parts.push("Documentation limitée.");
  }

  if (site_score >= 17) {
    justification_parts.push("Visite complète effectuée.");
  } else if (site_score > 0) {
    justification_parts.push("Accès au site limité.");
  }

  if (!existing_conditions_known) {
    justification_parts.push("Conditions existantes non vérifiées.");
  }

  if (!client_decisions_finalized) {
    justification_parts.push("Choix client non finalisés.");
  }

  return {
    estimation_type: est_type,
    estimation_type_name: type_info.name,
    contingency_rate,
    contingency_rate_display: `${Math.round(contingency_rate * 100)}%`,
    precision_range: type_info.precision,
    confidence_score: final_score,
    confidence_breakdown: breakdown,
    risk_factors: risk_factors.length > 0 ? risk_factors : ["Aucun facteur de risque majeur identifié"],
    recommendations: recommendations.length > 0 ? recommendations : ["Projet bien documenté - procéder à l'estimation"],
    justification: justification_parts.join(" ")
  };
}

// ============================================================================
// HANDLER POUR L'AGENT
// ============================================================================

/**
 * Handler à appeler quand l'agent invoque classify_estimation_type.
 * @param {object} toolCall - L'objet tool_call de OpenAI
 * @returns {string} JSON string du résultat
 */
export function handleToolCall(toolCall) {
  const args = typeof toolCall.function.arguments === 'string'
    ? JSON.parse(toolCall.function.arguments)
    : toolCall.function.arguments;

  const result = classifyEstimationType(args);
  return JSON.stringify(result, null, 2);
}

/**
 * Retourne la définition du tool pour OpenAI
 */
export function getOpenAITools() {
  return [TOOL_DEFINITION];
}
