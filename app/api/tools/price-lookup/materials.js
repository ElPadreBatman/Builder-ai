/**
 * Catalogue complet des matériaux de construction québécois.
 * Synchronisé avec config.py côté Python.
 */

export const MATERIALS = {
  // ── BOIS D'OEUVRE ──────────────────────────────────────────────────────────
  lumber_2x4x8:   { label: '2x4x8 épinette',      category: 'lumber',     unit: 'pièce',   keyword: '2x4x8 épinette prix' },
  lumber_2x4x10:  { label: '2x4x10 épinette',     category: 'lumber',     unit: 'pièce',   keyword: '2x4x10 épinette prix' },
  lumber_2x4x12:  { label: '2x4x12 épinette',     category: 'lumber',     unit: 'pièce',   keyword: '2x4x12 épinette prix' },
  lumber_2x4x16:  { label: '2x4x16 épinette',     category: 'lumber',     unit: 'pièce',   keyword: '2x4x16 épinette prix' },
  lumber_2x6x8:   { label: '2x6x8 épinette',      category: 'lumber',     unit: 'pièce',   keyword: '2x6x8 épinette prix' },
  lumber_2x6x10:  { label: '2x6x10 épinette',     category: 'lumber',     unit: 'pièce',   keyword: '2x6x10 épinette prix' },
  lumber_2x6x12:  { label: '2x6x12 épinette',     category: 'lumber',     unit: 'pièce',   keyword: '2x6x12 épinette prix' },
  lumber_2x6x16:  { label: '2x6x16 épinette',     category: 'lumber',     unit: 'pièce',   keyword: '2x6x16 épinette prix' },
  lumber_2x8x12:  { label: '2x8x12 épinette',     category: 'lumber',     unit: 'pièce',   keyword: '2x8x12 épinette prix' },
  lumber_2x8x16:  { label: '2x8x16 épinette',     category: 'lumber',     unit: 'pièce',   keyword: '2x8x16 épinette prix' },
  lumber_2x10x12: { label: '2x10x12 épinette',    category: 'lumber',     unit: 'pièce',   keyword: '2x10x12 épinette prix' },
  lumber_2x10x16: { label: '2x10x16 épinette',    category: 'lumber',     unit: 'pièce',   keyword: '2x10x16 épinette prix' },
  lumber_2x12x12: { label: '2x12x12 épinette',    category: 'lumber',     unit: 'pièce',   keyword: '2x12x12 épinette prix' },
  lumber_2x12x16: { label: '2x12x16 épinette',    category: 'lumber',     unit: 'pièce',   keyword: '2x12x16 épinette prix' },

  // ── CONTREPLAQUÉ ───────────────────────────────────────────────────────────
  plywood_3_8_4x8:  { label: 'Contreplaqué 3/8 4x8',  category: 'plywood',    unit: 'feuille', keyword: 'contreplaqué 3/8 4x8 prix' },
  plywood_1_2_4x8:  { label: 'Contreplaqué 1/2 4x8',  category: 'plywood',    unit: 'feuille', keyword: 'contreplaqué 1/2 4x8 prix' },
  plywood_5_8_4x8:  { label: 'Contreplaqué 5/8 4x8',  category: 'plywood',    unit: 'feuille', keyword: 'contreplaqué 5/8 4x8 prix' },
  plywood_3_4_4x8:  { label: 'Contreplaqué 3/4 4x8',  category: 'plywood',    unit: 'feuille', keyword: 'contreplaqué 3/4 4x8 prix' },

  // ── OSB ────────────────────────────────────────────────────────────────────
  osb_7_16_4x8:   { label: 'OSB 7/16 4x8',    category: 'osb',        unit: 'feuille', keyword: 'OSB 7/16 4x8 prix' },
  osb_7_16_4x9:   { label: 'OSB 7/16 4x9',    category: 'osb',        unit: 'feuille', keyword: 'OSB 7/16 4x9 prix' },
  osb_15_32_4x8:  { label: 'OSB 15/32 4x8',   category: 'osb',        unit: 'feuille', keyword: 'OSB 15/32 4x8 prix' },
  osb_19_32_4x8:  { label: 'OSB 19/32 4x8',   category: 'osb',        unit: 'feuille', keyword: 'OSB 19/32 4x8 prix' },
  osb_23_32_4x8:  { label: 'OSB 23/32 4x8',   category: 'osb',        unit: 'feuille', keyword: 'OSB 23/32 4x8 prix' },

  // ── GYPSE ──────────────────────────────────────────────────────────────────
  drywall_1_2_4x8:    { label: 'Gypse 1/2 4x8',            category: 'drywall',    unit: 'feuille', keyword: 'gypse 1/2 4x8 prix' },
  drywall_1_2_4x12:   { label: 'Gypse 1/2 4x12',           category: 'drywall',    unit: 'feuille', keyword: 'gypse 1/2 4x12 prix' },
  drywall_5_8_4x8:    { label: 'Gypse 5/8 4x8',            category: 'drywall',    unit: 'feuille', keyword: 'gypse 5/8 4x8 prix' },
  drywall_5_8_4x12:   { label: 'Gypse 5/8 4x12',           category: 'drywall',    unit: 'feuille', keyword: 'gypse 5/8 4x12 prix' },
  drywall_fw_5_8_4x8: { label: 'Gypse coupe-feu 5/8 4x8',  category: 'drywall',    unit: 'feuille', keyword: 'gypse type X 5/8 4x8 prix' },

  // ── ISOLANT XPS ────────────────────────────────────────────────────────────
  xps_1_4x8:    { label: 'XPS 1" 4x8',    category: 'insulation', unit: 'feuille', keyword: 'polystyrène XPS 1 pouce 4x8 prix' },
  xps_1_5_4x8:  { label: 'XPS 1.5" 4x8', category: 'insulation', unit: 'feuille', keyword: 'polystyrène XPS 1.5 pouce 4x8 prix' },
  xps_2_4x8:    { label: 'XPS 2" 4x8',   category: 'insulation', unit: 'feuille', keyword: 'polystyrène XPS 2 pouces 4x8 prix' },
  xps_3_4x8:    { label: 'XPS 3" 4x8',   category: 'insulation', unit: 'feuille', keyword: 'polystyrène XPS 3 pouces 4x8 prix' },

  // ── LAINE DE VERRE ─────────────────────────────────────────────────────────
  fiberglass_r12: { label: 'Laine de verre R-12', category: 'insulation', unit: 'paquet',  keyword: 'laine de verre R-12 isolation prix' },
  fiberglass_r20: { label: 'Laine de verre R-20', category: 'insulation', unit: 'paquet',  keyword: 'laine de verre R-20 isolation prix' },
  fiberglass_r28: { label: 'Laine de verre R-28', category: 'insulation', unit: 'paquet',  keyword: 'laine de verre R-28 isolation prix' },

  // ── BARDEAUX ───────────────────────────────────────────────────────────────
  shingles_3tab:  { label: 'Bardeaux 3 onglets',       category: 'roofing',    unit: 'paquet',  keyword: 'bardeau asphalte 3 onglets prix' },
  shingles_arch:  { label: 'Bardeaux architecturaux',  category: 'roofing',    unit: 'paquet',  keyword: 'bardeau architectural asphalte prix' },

  // ── DRAINAGE ───────────────────────────────────────────────────────────────
  drain_4_45m:  { label: 'Drain 4" 45m perforé',  category: 'drainage',   unit: 'rouleau', keyword: 'drain 4 pouces 45m perforé prix' },
  drain_4_75m:  { label: 'Drain 4" 75m perforé',  category: 'drainage',   unit: 'rouleau', keyword: 'drain 4 pouces 75m perforé prix' },

  // ── ACIER ──────────────────────────────────────────────────────────────────
  rebar_10mm_20:  { label: "Fer armature 10mm 20'", category: 'steel',      unit: 'barre',   keyword: 'armature fer 10mm 20 pieds prix' },
  rebar_15mm_20:  { label: "Fer armature 15mm 20'", category: 'steel',      unit: 'barre',   keyword: 'armature fer 15mm 20 pieds prix' },

  // ── PARE-VAPEUR ────────────────────────────────────────────────────────────
  vapour_barrier_6mil: { label: 'Pare-vapeur 6 mil', category: 'barrier',   unit: 'rouleau', keyword: 'pare-vapeur polyéthylène 6 mil prix' },
};

/** Retourne les matériaux d'une catégorie */
export function getMaterialsByCategory(category) {
  return Object.entries(MATERIALS)
    .filter(([, m]) => m.category === category)
    .map(([key, m]) => ({ key, ...m }));
}

/** Résout une clé ou un label approximatif → matériau */
export function resolveMaterial(keyOrLabel) {
  // Correspondance exacte par clé
  if (MATERIALS[keyOrLabel]) return { key: keyOrLabel, ...MATERIALS[keyOrLabel] };

  // Correspondance approximative par label (insensible à la casse)
  const lower = keyOrLabel.toLowerCase();
  for (const [key, m] of Object.entries(MATERIALS)) {
    if (m.label.toLowerCase().includes(lower) || lower.includes(key)) {
      return { key, ...m };
    }
  }
  return null;
}

export const CATEGORIES = [...new Set(Object.values(MATERIALS).map(m => m.category))];
