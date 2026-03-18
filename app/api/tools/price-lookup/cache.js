import { createClient } from '@supabase/supabase-js';

/**
 * Gestion du cache Supabase pour les prix de matériaux.
 * Vérifie si les prix existent déjà et sont suffisamment récents.
 */
export class PriceCache {
  constructor(supabaseUrl, supabaseKey, cacheDays = 7) {
    this.supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    this.cacheDays = cacheDays;
  }

  /**
   * Retourne les prix en cache pour une liste de matériaux + localisation.
   * @param {string[]} materialKeys
   * @param {string}   location  ex: "Mascouche, Quebec, Canada"
   * @returns {Object} { hits: Map<key, rows[]>, missingKeys: string[] }
   */
  async check(materialKeys, location) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.cacheDays);

    const city = this._extractCity(location);

    const { data, error } = await this.supabase
      .from('price_searches')
      .select('material_key, supplier, product_title, price, price_raw, link, thumbnail, location, scraped_at')
      .in('material_key', materialKeys)
      .ilike('location', `%${city}%`)
      .not('price', 'is', null)
      .gte('scraped_at', cutoff.toISOString())
      .order('price', { ascending: true });

    if (error) throw new Error(`Cache check failed: ${error.message}`);

    // Grouper par material_key
    const hits = new Map();
    for (const row of (data || [])) {
      if (!hits.has(row.material_key)) hits.set(row.material_key, []);
      hits.get(row.material_key).push(row);
    }

    const missingKeys = materialKeys.filter(k => !hits.has(k));

    return { hits, missingKeys };
  }

  /**
   * Sauvegarde les résultats SerpAPI dans Supabase.
   * @param {Array} scrapedResults  [{material, results: serpapi_items[]}]
   * @param {string} location
   * @returns {Map<key, rows[]>} données sauvegardées groupées par key
   */
  async save(scrapedResults, location) {
    const now = new Date().toISOString();
    const rows = [];

    for (const { material, results } of scrapedResults) {
      for (let i = 0; i < results.length; i++) {
        const item = results[i];
        const price = item.extracted_price
          ? parseFloat(item.extracted_price)
          : this._parsePrice(item.price);

        if (price === null) continue;

        rows.push({
          keyword:       material.keyword,
          material_key:  material.key,
          supplier:      item.source || 'inconnu',
          product_title: item.title || '',
          price,
          price_raw:     item.price || '',
          currency:      'CAD',
          link:          item.link || '',
          thumbnail:     item.thumbnail || '',
          rating:        item.rating ? parseFloat(item.rating) : null,
          reviews:       item.reviews ? parseInt(item.reviews) : 0,
          position:      i + 1,
          search_type:   'shopping',
          location,
          scraped_at:    now,
        });
      }
    }

    if (rows.length === 0) return new Map();

    const { error } = await this.supabase
      .from('price_searches')
      .insert(rows);

    if (error) throw new Error(`Cache save failed: ${error.message}`);

    // Retourner sous forme de Map groupée
    const saved = new Map();
    for (const row of rows) {
      if (!saved.has(row.material_key)) saved.set(row.material_key, []);
      saved.get(row.material_key).push(row);
    }
    return saved;
  }

  _extractCity(location) {
    return location.split(',')[0].trim();
  }

  _parsePrice(priceStr) {
    if (!priceStr) return null;
    const match = priceStr.replace(/\s/g, '').match(/[\d]+[.,]?\d*/);
    if (!match) return null;
    return parseFloat(match[0].replace(',', '.'));
  }
}
