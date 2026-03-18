const SERP_URL = 'https://serpapi.com/search';
const BATCH_SIZE = 5; // requêtes simultanées max (évite le rate limiting)

/**
 * Scraper parallèle SerpAPI.
 * Traite les matériaux par batch de BATCH_SIZE simultanément.
 * Utilise fetch natif (Node.js 18+) au lieu d'axios
 */
export class ParallelScraper {
  constructor(serpApiKey, timeoutMs = 15000) {
    this.serpApiKey = serpApiKey;
    this.timeoutMs  = timeoutMs;
  }

  /**
   * Scrape plusieurs matériaux en parallèle (par batch).
   * @param {Array}  materials  [{key, keyword, label, ...}]
   * @param {string} location   ex: "Mascouche, Quebec, Canada"
   * @returns {Array} [{material, results: [], error?}]
   */
  async scrapeAll(materials, location) {
    const allResults = [];

    for (let i = 0; i < materials.length; i += BATCH_SIZE) {
      const batch = materials.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.allSettled(
        batch.map(m => this._scrapeOne(m, location))
      );

      for (let j = 0; j < batchResults.length; j++) {
        const r = batchResults[j];
        if (r.status === 'fulfilled') {
          allResults.push(r.value);
        } else {
          // Erreur sur ce matériau — on continue quand même
          allResults.push({
            material: batch[j],
            results:  [],
            error:    r.reason?.message || 'Erreur inconnue',
          });
        }
      }
    }

    return allResults;
  }

  async _scrapeOne(material, location) {
    const params = new URLSearchParams({
      engine:   'google_shopping',
      q:        material.keyword,
      gl:       'ca',
      hl:       'fr',
      location,
      num:      '20',
      api_key:  this.serpApiKey,
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${SERP_URL}?${params.toString()}`, {
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`SerpAPI HTTP error: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(`SerpAPI: ${data.error}`);
      }

      return {
        material,
        results: data.shopping_results || [],
      };
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error(`SerpAPI timeout after ${this.timeoutMs}ms`);
      }
      throw err;
    }
  }
}
