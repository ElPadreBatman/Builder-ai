/**
 * Exemple d'intégration dans un agent OpenAI de soumissions.
 *
 * npm install openai @supabase/supabase-js axios
 */

import OpenAI from 'openai';
import { PriceLookup }                    from './index.js';
import { getOpenAITools, handleToolCall } from './openai-tools.js';

// ── Config ─────────────────────────────────────────────────────────────────

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const lookup = new PriceLookup({
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_KEY,
  serpApiKey:  process.env.SERPAPI_KEY,
  cacheDays:   7,
});

// ── Agent ──────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Tu es un assistant spécialisé en soumissions de construction au Québec.

Quand un client décrit un projet, tu:
1. Identifies les matériaux nécessaires (utilise les clés exactes du catalogue)
2. Appelles generate_quote avec la liste complète et la localisation
3. Présentes la soumission de façon claire avec le total et les fournisseurs locaux

Règles:
- Toujours demander la localisation si non fournie
- Utiliser les prix les plus bas trouvés
- Mentionner le fournisseur et son prix pour chaque matériau
- Indiquer si certains prix n'ont pas été trouvés`;

export async function chat(userMessage, conversationHistory = []) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ];

  // Boucle agent : continue tant que l'IA appelle des tools
  while (true) {
    const response = await openai.chat.completions.create({
      model:       'gpt-4o',
      messages,
      tools:       getOpenAITools(),
      tool_choice: 'auto',
    });

    const choice = response.choices[0];
    messages.push(choice.message);

    // Aucun tool appelé → réponse finale
    if (choice.finish_reason !== 'tool_calls') {
      return {
        reply:   choice.message.content,
        history: messages,
      };
    }

    // Exécuter les tool calls en parallèle
    const toolResults = await Promise.all(
      choice.message.tool_calls.map(async (tc) => {
        const result = await handleToolCall(tc, lookup);
        return {
          role:         'tool',
          tool_call_id: tc.id,
          content:      result,
        };
      })
    );

    messages.push(...toolResults);
    // La boucle continue → l'IA traite les résultats et génère la réponse
  }
}

// ── Test rapide ────────────────────────────────────────────────────────────

const { reply } = await chat(
  "J'ai besoin d'une soumission pour construire un garage 20x24 à Mascouche"
);
console.log(reply);
