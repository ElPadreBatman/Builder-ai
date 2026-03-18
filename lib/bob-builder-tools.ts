/**
 * Bob Builder Anti-Hallucination Tools
 * 
 * Ces tools OpenAI forcent l'agent LLM à utiliser des données validées
 * plutôt que d'inventer des prix ou informations.
 * 
 * Usage: Inclure `bobBuilderTools` dans l'appel OpenAI avec `tools: bobBuilderTools`
 */

export const bobBuilderTools = [
  {
    type: "function" as const,
    function: {
      name: "get_price",
      description: "OBLIGATOIRE avant d'inclure tout prix. Recupere le prix d'un item de la base de donnees. Si non trouve (found: false), le modele DOIT marquer l'item comme estimation.",
      parameters: {
        type: "object",
        properties: {
          description: {
            type: "string",
            description: "Description de l'item recherche (ex: 'Montants 2x6 8 pieds')"
          },
          item_code: {
            type: "string",
            description: "Code MasterFormat optionnel (ex: '06 11 00')"
          },
          unit: {
            type: "string",
            description: "Unite de mesure (pi², pi.li, m³, unite, etc.)"
          },
          category: {
            type: "string",
            enum: ["material", "labor", "rental", "subcontract"],
            description: "Categorie de l'item"
          }
        },
        required: ["description"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "get_checklist",
      description: "OBLIGATOIRE AVANT de generer chaque division. Recupere la checklist des items obligatoires pour un type d'assemblage. Le modele DOIT inclure TOUS les items retournes.",
      parameters: {
        type: "object",
        properties: {
          assembly_type: {
            type: "string",
            description: "Type d'assemblage (ex: mur_exterieur_2x6, toiture_fermes, dalle_monolithique, fondation_semelle, plancher_solives)"
          },
          project_complexity: {
            type: "string",
            enum: ["simple", "moyen", "complexe"],
            description: "Niveau de complexite du projet"
          }
        },
        required: ["assembly_type"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "validate_price",
      description: "Valide qu'un prix est dans la fourchette marche Quebec 2025-2026. Appeler apres get_price si le prix vient d'une estimation ou n'a pas ete trouve.",
      parameters: {
        type: "object",
        properties: {
          item_type: {
            type: "string",
            description: "Type d'item (beton, bois_2x6, isolation, osb, gypse, etc.)"
          },
          unit_price: {
            type: "number",
            description: "Prix unitaire a valider"
          },
          unit: {
            type: "string",
            description: "Unite de mesure"
          },
          includes_labor: {
            type: "boolean",
            description: "Est-ce que le prix inclut la main-d'oeuvre?"
          }
        },
        required: ["item_type", "unit_price", "unit"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "validate_geometry",
      description: "Valide une quantite calculee contre les dimensions du projet pour eviter les erreurs geometriques. Utiliser pour valider les superficies de murs, toiture, dalle, etc.",
      parameters: {
        type: "object",
        properties: {
          item_type: {
            type: "string",
            description: "Type d'element (mur, toiture, dalle, plancher, cloison, plafond, perimetre, fondation)"
          },
          calculated_quantity: {
            type: "number",
            description: "Quantite calculee a valider"
          },
          unit: {
            type: "string",
            description: "Unite de mesure (pi², pi.li, m³, etc.)"
          },
          project_dimensions: {
            type: "object",
            properties: {
              length_ft: { type: "number", description: "Longueur en pieds" },
              width_ft: { type: "number", description: "Largeur en pieds" },
              height_ft: { type: "number", description: "Hauteur en pieds" },
              perimeter_ft: { type: "number", description: "Perimetre en pieds" },
              area_sqft: { type: "number", description: "Superficie en pieds carres" }
            },
            description: "Dimensions du projet"
          },
          waste_factor: {
            type: "number",
            description: "Facteur de perte (ex: 1.05 pour 5% de perte)"
          }
        },
        required: ["item_type", "calculated_quantity", "unit", "project_dimensions"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "get_labor_rate",
      description: "OBLIGATOIRE pour obtenir les taux horaires CCQ officiels. NE JAMAIS inventer un taux horaire. Si le metier n'est pas trouve, demander clarification.",
      parameters: {
        type: "object",
        properties: {
          trade: {
            type: "string",
            description: "Metier CCQ (charpentier-menuisier, electricien, plombier, peintre, manoeuvre, couvreur, briqueteur-macon, soudeur, etc.)"
          },
          region: {
            type: "string",
            description: "Region (montreal, quebec). Par defaut: montreal"
          }
        },
        required: ["trade"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "generate_division",
      description: "Genere le tableau Markdown d'une division complete apres avoir collecte tous les items via les autres tools. Valide automatiquement contre la checklist.",
      parameters: {
        type: "object",
        properties: {
          division_code: {
            type: "string",
            description: "Code de division MasterFormat (ex: '03 00 00', '06 00 00')"
          },
          division_name: {
            type: "string",
            description: "Nom de la division (ex: 'Beton', 'Bois et plastiques')"
          },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                code: { type: "string", description: "Code item" },
                description: { type: "string", description: "Description de l'item" },
                type: { type: "string", enum: ["Mat.", "MO", "Loc.", "ST"], description: "Type (Materiel, Main-d'oeuvre, Location, Sous-traitance)" },
                unit: { type: "string", description: "Unite" },
                quantity: { type: "number", description: "Quantite" },
                unit_price: { type: "number", description: "Prix unitaire" },
                price_source: { type: "string", enum: ["database", "estimation"], description: "Source du prix" }
              },
              required: ["code", "description", "type", "unit", "quantity", "unit_price", "price_source"]
            },
            description: "Liste des items de la division"
          }
        },
        required: ["division_code", "division_name", "items"]
      }
    }
  }
]

/**
 * System prompt pour Bob Builder avec les regles anti-hallucination
 */
export const bobBuilderSystemPrompt = `Tu es Bob Builder, un estimateur construction RBQ experimente pour le Quebec.

## REGLES ABSOLUES - ANTI-HALLUCINATION

1. **PRIX** : Tu DOIS appeler \`get_price\` AVANT d'inclure tout prix dans la soumission.
   - Si \`found: false\`, marquer l'item avec "* Estimation"
   - NE JAMAIS inventer un prix sans appeler le tool

2. **CHECKLIST** : Tu DOIS appeler \`get_checklist\` AVANT de generer chaque division.
   - Inclure TOUS les items retournes comme obligatoires
   - Si des items manquent, les ajouter a la division

3. **VALIDATION PRIX** : Appeler \`validate_price\` pour tout prix estime.
   - Si correction_needed: true, utiliser suggested_price
   - Mentionner la correction dans la soumission

4. **VALIDATION GEOMETRIE** : Appeler \`validate_geometry\` pour valider les quantites.
   - Si ecart > tolerance, corriger la quantite
   - Utiliser expected_quantity comme reference

5. **TAUX MAIN-D'OEUVRE** : Tu DOIS appeler \`get_labor_rate\` pour obtenir les taux CCQ.
   - NE JAMAIS inventer un taux horaire
   - Si metier non trouve, demander clarification

6. **SI INFO MANQUANTE** : Poser une question claire au client.
   - NE JAMAIS supposer ou inventer des dimensions
   - NE JAMAIS deviner le type de finition ou materiaux

## FORMAT SORTIE
- Tableaux Markdown 7 colonnes : Code | Description | Type | Unite | Qte | Prix un. | Total
- Sous-total apres chaque division
- Marquer clairement: "* Prix estime - non disponible en base de donnees"
- Recapitulatif avec frais generaux et imprevus

## WORKFLOW POUR CHAQUE DIVISION
1. Appeler get_checklist pour obtenir les items obligatoires
2. Pour chaque item: appeler get_price
3. Si prix non trouve: appeler validate_price avec estimation
4. Appeler validate_geometry pour les quantites
5. Appeler generate_division pour creer le tableau final
`

/**
 * Execute un tool Bob Builder via l'API
 */
export async function executeBobBuilderTool(
  toolName: string,
  args: Record<string, unknown>,
  baseUrl: string = ""
): Promise<unknown> {
  const response = await fetch(`${baseUrl}/api/tools/${toolName.replace(/_/g, "-")}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  })

  if (!response.ok) {
    throw new Error(`Tool ${toolName} failed: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Mapping des noms de tools vers les endpoints
 */
export const toolEndpointMap: Record<string, string> = {
  get_price: "/api/tools/get-price",
  get_checklist: "/api/tools/get-checklist",
  validate_price: "/api/tools/validate-price",
  validate_geometry: "/api/tools/validate-geometry",
  get_labor_rate: "/api/tools/get-labor-rate",
  generate_division: "/api/tools/generate-division",
}
