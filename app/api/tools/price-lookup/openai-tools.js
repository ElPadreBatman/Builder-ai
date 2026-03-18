import { MATERIALS, CATEGORIES } from './materials.js';

/**
 * Définitions des tools OpenAI pour l'agent de soumissions.
 *
 * Usage avec OpenAI SDK :
 *   import { getOpenAITools, handleToolCall } from './openai-tools.js';
 *
 *   const response = await openai.chat.completions.create({
 *     model: 'gpt-4o',
 *     messages,
 *     tools: getOpenAITools(),
 *   });
 *
 *   if (response.choices[0].finish_reason === 'tool_calls') {
 *     const result = await handleToolCall(response, lookup);
 *   }
 */

export function getOpenAITools() {
  const materialKeys = Object.keys(MATERIALS);
  const categoryList = CATEGORIES.join(', ');

  return [
    {
      type: 'function',
      function: {
        name: 'get_material_prices',
        description: `Retourne les prix actuels des matériaux de construction pour une localisation donnée.
Utilise un cache Supabase (7 jours) et scrape en parallèle les prix manquants via Google Shopping.
Catégories disponibles: ${categoryList}.`,
        parameters: {
          type: 'object',
          properties: {
            materials: {
              type: 'array',
              items: { type: 'string', enum: materialKeys },
              description: 'Liste des clés de matériaux à rechercher (ex: ["lumber_2x4x8", "osb_7_16_4x8"])',
            },
            location: {
              type: 'string',
              description: 'Localisation du projet (ex: "Mascouche, Quebec, Canada")',
            },
          },
          required: ['materials', 'location'],
        },
      },
    },

    {
      type: 'function',
      function: {
        name: 'generate_quote',
        description: `Génère une soumission complète avec prix pour une liste de matériaux et quantités.
Retourne le coût total estimé, les meilleurs prix par fournisseur local, et les alternatives.`,
        parameters: {
          type: 'object',
          properties: {
            materials: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  key:      { type: 'string', description: 'Clé du matériau (ex: lumber_2x4x8)' },
                  quantity: { type: 'number', description: 'Quantité nécessaire' },
                },
                required: ['key', 'quantity'],
              },
              description: 'Liste des matériaux avec quantités',
            },
            location: {
              type: 'string',
              description: 'Localisation du chantier (ex: "Mascouche, Quebec, Canada")',
            },
            project_name: {
              type: 'string',
              description: 'Nom du projet (ex: "Garage 20x24")',
            },
          },
          required: ['materials', 'location'],
        },
      },
    },

    {
      type: 'function',
      function: {
        name: 'list_materials_by_category',
        description: 'Liste tous les matériaux disponibles dans une catégorie donnée.',
        parameters: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              enum: CATEGORIES,
              description: `Catégorie de matériaux (${categoryList})`,
            },
          },
          required: ['category'],
        },
      },
    },
  ];
}

/**
 * Exécute un tool call OpenAI et retourne le résultat.
 *
 * @param {Object}      toolCall  - L'objet tool_call d'OpenAI
 * @param {PriceLookup} lookup    - Instance PriceLookup configurée
 * @returns {string}              - Résultat JSON stringifié
 */
export async function handleToolCall(toolCall, lookup) {
  const { name, arguments: argsStr } = toolCall.function;
  const args = JSON.parse(argsStr);

  switch (name) {

    case 'get_material_prices': {
      const { results, stats } = await lookup.getPrices({
        materials: args.materials,
        location:  args.location,
      });
      return JSON.stringify({
        location: args.location,
        prices: results.map(r => ({
          key:        r.material_key,
          label:      r.label,
          unit:       r.unit,
          best_price: r.best_price?.price ?? null,
          supplier:   r.best_price?.supplier ?? null,
          link:       r.best_price?.supplier_link ?? null,
          found:      r.found,
        })),
        stats,
      });
    }

    case 'generate_quote': {
      const quantities = {};
      for (const { key, quantity } of args.materials) {
        quantities[key] = quantity;
      }
      const quote = await lookup.getPricesForQuote({
        materials: args.materials.map(m => m.key),
        location:  args.location,
        quantities,
      });
      return JSON.stringify({
        project:        args.project_name || 'Projet',
        ...quote,
      });
    }

    case 'list_materials_by_category': {
      const { getMaterialsByCategory } = await import('./materials.js');
      const mats = getMaterialsByCategory(args.category);
      return JSON.stringify({
        category: args.category,
        materials: mats.map(m => ({ key: m.key, label: m.label, unit: m.unit })),
      });
    }

    default:
      throw new Error(`Tool inconnu: ${name}`);
  }
}
