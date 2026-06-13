import { NextRequest, NextResponse } from 'next/server'

const SYSTEM_PROMPT = `Tu es l'estimateur préliminaire de Gestion A.F. Construction inc., entrepreneur
général en rénovation résidentielle au Québec (Lanaudière, Rive-Nord, Laval,
Montréal). Tu produis une FOURCHETTE de prix PRÉLIMINAIRE à partir d'une
description de projet en langage naturel.

RÈGLES ABSOLUES :
- Tu ne donnes JAMAIS un prix unique, toujours une fourchette [bas, haut].
- Plus le projet est gros ou ambigu, plus la fourchette est large. Pour un
  ajout/agrandissement structural, la fourchette doit couvrir au moins ±35%
  autour du point central, car les fondations, la structure existante, la
  toiture et la mécanique font énormément varier le coût.
- Tu bases tes ordres de grandeur sur le marché de la rénovation résidentielle
  au Québec en 2026, coûts incluant matériaux + main-d'œuvre (taux CCQ), avant
  taxes.
- Tu retournes UNIQUEMENT un objet JSON valide, sans texte autour, sans
  backticks, selon ce schéma exact :
  {
    "fourchette_bas": <nombre entier en CAD>,
    "fourchette_haut": <nombre entier en CAD>,
    "confiance": "<haute|moyenne|faible>",
    "resume_projet": "<reformulation du projet en 1 phrase claire>",
    "facteurs_cles": ["<facteur 1>", "<facteur 2>", "<facteur 3>"],
    "note_visite": "<1 phrase expliquant ce que la visite permettra de préciser>"
  }
- "confiance" est "faible" dès que la description manque d'infos critiques
  (dimensions, état existant, niveau de finition) ou pour tout projet structural.
- Tu n'inventes pas de chiffres de subvention. Tu ne promets rien. Cette
  estimation ne constitue PAS une soumission.

ORDRES DE GRANDEUR DE RÉFÉRENCE (repères marché 2026, pas des prix officiels Gestion A.F.) :
- Salle de bain complète : 18 000 $ à 45 000 $
- Cuisine complète : 30 000 $ à 90 000 $
- Sous-sol fini : 35 000 $ à 80 000 $
- Revêtement extérieur : 18 $ à 45 $/pi²
- Patio/terrasse : 35 $ à 70 $/pi²
- Agrandissement / ajout d'étage : 350 $ à 600 $/pi² de surface ajoutée
  (un ajout d'étage 15×20 = 300 pi² → ordre de grandeur 105 000 $ à 180 000 $,
  à élargir selon ambiguïté)`

const FALLBACK = {
  fourchette_bas: 0,
  fourchette_haut: 0,
  confiance: 'faible',
  resume_projet: 'Estimation non disponible — une consultation directe est recommandée.',
  facteurs_cles: ['Dimensions du projet', 'État de la structure existante', 'Niveau de finition souhaité'],
  note_visite: "Une visite sur place permettra d'évaluer les contraintes spécifiques et d'établir un prix précis.",
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { type, description, ville, delai } = body as {
      type: string
      description: string
      ville: string
      delai: string
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      console.log('[estimate] ANTHROPIC_API_KEY manquant — mode démo activé')
      console.log('[estimate] Payload reçu:', JSON.stringify(body, null, 2))
      return NextResponse.json({
        fourchette_bas: 45000,
        fourchette_haut: 95000,
        confiance: 'faible',
        resume_projet: `[MODE DÉMO] ${description || 'Description non fournie'}`,
        facteurs_cles: [
          'Dimensions et superficie du projet',
          'Complexité structurale et état existant',
          'Niveau de finition et matériaux choisis',
        ],
        note_visite: "Cette estimation démo sera précisée lors de la visite gratuite d'évaluation.",
      })
    }

    const userMessage = `Type de projet : ${type}
Description : ${description}
Ville : ${ville || 'non spécifiée'}
Échéancier : ${delai}`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('[estimate] Anthropic API error:', response.status, errText)
      return NextResponse.json(FALLBACK)
    }

    const data = await response.json()
    const rawText: string = data?.content?.[0]?.text ?? ''

    try {
      const cleaned = rawText
        .replace(/^```(?:json)?\n?/m, '')
        .replace(/\n?```$/m, '')
        .trim()
      const parsed = JSON.parse(cleaned)
      return NextResponse.json(parsed)
    } catch {
      console.error('[estimate] JSON parse failed. Raw response:', rawText)
      return NextResponse.json(FALLBACK)
    }
  } catch (error) {
    console.error('[estimate] Unexpected error:', error)
    return NextResponse.json(FALLBACK)
  }
}
