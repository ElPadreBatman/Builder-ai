import { PriceCache }     from './cache.js';
import { ParallelScraper } from './scraper.js';
import { MATERIALS, resolveMaterial } from './materials.js';

/**
 * PriceLookup — Module principal.
 *
 * Cache-first : vérifie Supabase avant d'appeler SerpAPI.
 * Les matériaux manquants sont scrapés en parallèle (batch de 5).
 *
 * Usage :
 *   import { PriceLookup } from '@prix-materiaux/price-lookup';
 *
 *   const lookup = new PriceLookup({
 *     supabaseUrl: process.env.SUPABASE_URL,
 *     supabaseKey: process.env.SUPABASE_KEY,
 *     serpApiKey:  process.env.SERPAPI_KEY,
 *   });
 *
 *   const prices = await lookup.getPrices({
 *     materials: ['lumber_2x4x8', 'osb_7_16_4x8'],
 *     location:  'Mascouche, Quebec, Canada',
 *   });
 */
export class PriceLookup {
  constructor({
    supabaseUrl,
    supabaseKey,
    serpApiKey,
    cacheDays   = 7,
    timeoutMs   = 15000,
  }) {
    if (!supabaseUrl || !supabaseKey) throw new Error('supabaseUrl et supabaseKey requis');
    if (!serpApiKey) throw new Error('serpApiKey requis');

    this.cache   = new PriceCache(supabaseUrl, supabaseKey, cacheDays);
    this.scraper = new ParallelScraper(serpApiKey, timeoutMs);
  }

  /**
   * Retourne les prix pour une liste de matériaux + localisation.
   * Scrape automatiquement les matériaux absents du cache.
   *
   * @param {string[]} materials  Clés ou labels de matériaux
   * @param {string}   location   Ex: "Mascouche, Quebec, Canada"
   * @returns {PriceLookupResult}
   */
  async getPrices({ materials, location }) {
    const startTime = Date.now();

    // 1. Résoudre les matériaux (clé ou label approximatif)
    const resolved = materials.map(m => {
      const mat = typeof m === 'string' ? resolveMaterial(m) : m;
      if (!mat) throw new Error(`Matériau introuvable : "${m}"`);
      return mat;
    });

    const allKeys = resolved.map(m => m.key);

    // 2. Vérifier le cache Supabase
    const { hits, missingKeys } = await this.cache.check(allKeys, location);

    // 3. Scraper les matériaux manquants en parallèle
    let freshHits = new Map();
    if (missingKeys.length > 0) {
      const missingMaterials = resolved.filter(m => missingKeys.includes(m.key));
      const scraped = await this.scraper.scrapeAll(missingMaterials, location);
      freshHits = await this.cache.save(scraped, location);
    }

    // 4. Fusionner cache + nouvelles données
    const allHits = new Map([...hits, ...freshHits]);

    // 5. Construire le résultat final
    const results = resolved.map(mat => {
      const rows = allHits.get(mat.key) || [];
      const sorted = rows.sort((a, b) => a.price - b.price);

      return {
        material_key:  mat.key,
        label:         mat.label,
        category:      mat.category,
        unit:          mat.unit,
        from_cache:    hits.has(mat.key),
        found:         sorted.length > 0,
        best_price:    sorted[0] || null,
        suppliers:     sorted,
        supplier_count: sorted.length,
      };
    });

    return {
      location,
      results,
      stats: {
        total:        resolved.length,
        from_cache:   resolved.length - missingKeys.length,
        scraped_now:  missingKeys.length,
        elapsed_ms:   Date.now() - startTime,
      },
    };
  }

  /**
   * Version simplifiée pour l'agent OpenAI.
   * Retourne un résumé textuel + le meilleur prix par matériau.
   */
  async getPricesForQuote({ materials, location, quantities = {} }) {
    const { results, stats } = await this.getPrices({ materials, location });

    const lineItems = results.map(r => ({
      material_key:  r.material_key,
      label:         r.label,
      unit:          r.unit,
      quantity:      quantities[r.material_key] || 1,
      unit_price:    r.best_price?.price || null,
      supplier:      r.best_price?.supplier || null,
      supplier_link: r.best_price?.link || null,
      subtotal:      r.best_price
        ? r.best_price.price * (quantities[r.material_key] || 1)
        : null,
      alternatives:  r.suppliers.slice(1, 4).map(s => ({
        supplier: s.supplier,
        price:    s.price,
      })),
    }));

    const total = lineItems.reduce((sum, l) => sum + (l.subtotal || 0), 0);
    const missing = lineItems.filter(l => l.unit_price === null).map(l => l.label);

    return {
      location,
      line_items: lineItems,
      total_estimate: Math.round(total * 100) / 100,
      currency: 'CAD',
      missing_prices: missing,
      stats,
    };
  }
}

// Re-exports utiles
export { MATERIALS, resolveMaterial } from './materials.js';
export { getOpenAITools, handleToolCall } from './openai-tools.js';
