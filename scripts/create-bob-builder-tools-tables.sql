-- Migration: Create tables for Bob Builder anti-hallucination tools
-- Date: 2026-03-15

-- =====================================================
-- TABLE: construction_prices
-- Prix de matériaux et services construction Québec
-- =====================================================
CREATE TABLE IF NOT EXISTS construction_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_code VARCHAR(20),                          -- Code MasterFormat (ex: "06 11 00")
  description TEXT NOT NULL,
  category VARCHAR(20) CHECK (category IN ('material', 'labor', 'rental', 'subcontract')),
  unit VARCHAR(20),                               -- pi², pi.li, m³, unité, etc.
  price DECIMAL(10,2),
  market_min DECIMAL(10,2),
  market_max DECIMAL(10,2),
  source VARCHAR(100),                            -- Source du prix
  region VARCHAR(50) DEFAULT 'quebec',
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_construction_prices_code ON construction_prices(item_code);
CREATE INDEX IF NOT EXISTS idx_construction_prices_category ON construction_prices(category);
CREATE INDEX IF NOT EXISTS idx_construction_prices_description ON construction_prices USING gin(to_tsvector('french', description));

-- =====================================================
-- TABLE: assembly_checklists
-- Checklists obligatoires par type d'assemblage
-- =====================================================
CREATE TABLE IF NOT EXISTS assembly_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_type VARCHAR(100) NOT NULL UNIQUE,      -- "mur_exterieur_2x6", "toiture_fermes", etc.
  assembly_name VARCHAR(200),                       -- Nom lisible
  complexity VARCHAR(20) DEFAULT 'moyen' CHECK (complexity IN ('simple', 'moyen', 'complexe')),
  minimum_lines INTEGER DEFAULT 5,
  required_items JSONB NOT NULL,                    -- Structure: [{category, items[], mandatory}]
  validation_questions JSONB,                       -- Questions à poser si info manquante
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TABLE: ccq_rates
-- Taux horaires CCQ officiels par métier
-- =====================================================
CREATE TABLE IF NOT EXISTS ccq_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade VARCHAR(100) NOT NULL,                      -- "charpentier-menuisier", "electricien", etc.
  trade_code VARCHAR(20),                           -- Code CCQ
  region VARCHAR(50) DEFAULT 'montreal',
  hourly_rate DECIMAL(10,2) NOT NULL,
  includes JSONB DEFAULT '["salaire", "avantages sociaux", "vacances"]'::jsonb,
  effective_date DATE,
  expiry_date DATE,
  source VARCHAR(100) DEFAULT 'CCQ_2025',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(trade, region)
);

-- =====================================================
-- TABLE: market_price_ranges
-- Fourchettes de prix marché pour validation
-- =====================================================
CREATE TABLE IF NOT EXISTS market_price_ranges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type VARCHAR(100) NOT NULL,                  -- Type générique (béton, bois, isolation, etc.)
  unit VARCHAR(20) NOT NULL,
  min_price DECIMAL(10,2) NOT NULL,
  max_price DECIMAL(10,2) NOT NULL,
  includes_labor BOOLEAN DEFAULT FALSE,
  region VARCHAR(50) DEFAULT 'quebec',
  year INTEGER DEFAULT 2025,
  source VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(item_type, unit, includes_labor, region, year)
);

-- =====================================================
-- TABLE: geometry_formulas
-- Formules de calcul géométrique par type d'élément
-- =====================================================
CREATE TABLE IF NOT EXISTS geometry_formulas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type VARCHAR(100) NOT NULL UNIQUE,           -- "mur", "toiture", "dalle", etc.
  formula TEXT NOT NULL,                            -- Description de la formule
  calculation_method TEXT NOT NULL,                 -- Code/expression de calcul
  default_waste_factor DECIMAL(4,2) DEFAULT 1.05,   -- Facteur de perte par défaut
  tolerance_percent INTEGER DEFAULT 10,              -- Tolérance en % pour validation
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- INSERT: Données initiales CCQ 2025
-- =====================================================
INSERT INTO ccq_rates (trade, trade_code, region, hourly_rate, effective_date, source) VALUES
  ('charpentier-menuisier', 'CM', 'montreal', 47.50, '2025-05-01', 'CCQ_2025'),
  ('charpentier-menuisier', 'CM', 'quebec', 46.80, '2025-05-01', 'CCQ_2025'),
  ('electricien', 'EL', 'montreal', 52.30, '2025-05-01', 'CCQ_2025'),
  ('electricien', 'EL', 'quebec', 51.50, '2025-05-01', 'CCQ_2025'),
  ('plombier', 'PL', 'montreal', 51.80, '2025-05-01', 'CCQ_2025'),
  ('plombier', 'PL', 'quebec', 51.00, '2025-05-01', 'CCQ_2025'),
  ('ferblantier', 'FB', 'montreal', 49.20, '2025-05-01', 'CCQ_2025'),
  ('calorifugeur', 'CA', 'montreal', 48.50, '2025-05-01', 'CCQ_2025'),
  ('peintre', 'PE', 'montreal', 43.80, '2025-05-01', 'CCQ_2025'),
  ('poseur-revetements-souples', 'RS', 'montreal', 44.20, '2025-05-01', 'CCQ_2025'),
  ('briqueteur-maçon', 'BM', 'montreal', 48.90, '2025-05-01', 'CCQ_2025'),
  ('platrier', 'PL', 'montreal', 46.50, '2025-05-01', 'CCQ_2025'),
  ('couvreur', 'CV', 'montreal', 47.80, '2025-05-01', 'CCQ_2025'),
  ('manoeuvre', 'MA', 'montreal', 35.50, '2025-05-01', 'CCQ_2025'),
  ('operateur-equipement-lourd', 'OE', 'montreal', 49.50, '2025-05-01', 'CCQ_2025'),
  ('soudeur', 'SO', 'montreal', 50.20, '2025-05-01', 'CCQ_2025'),
  ('vitrier', 'VI', 'montreal', 46.80, '2025-05-01', 'CCQ_2025'),
  ('poseur-systemes-interieurs', 'SI', 'montreal', 45.90, '2025-05-01', 'CCQ_2025')
ON CONFLICT (trade, region) DO UPDATE SET
  hourly_rate = EXCLUDED.hourly_rate,
  effective_date = EXCLUDED.effective_date;

-- =====================================================
-- INSERT: Checklists d'assemblages courants
-- =====================================================
INSERT INTO assembly_checklists (assembly_type, assembly_name, complexity, minimum_lines, required_items, validation_questions) VALUES
  (
    'mur_exterieur_2x6',
    'Mur extérieur ossature 2x6',
    'moyen',
    12,
    '[
      {"category": "Ossature", "items": ["Montants 2x6", "Lisses basses", "Lisses hautes", "Linteaux"], "mandatory": true},
      {"category": "Revêtement extérieur", "items": ["Panneau OSB ou contreplaqué", "Pare-air/pare-vapeur"], "mandatory": true},
      {"category": "Isolation", "items": ["Isolant laine ou mousse"], "mandatory": true},
      {"category": "Fixations", "items": ["Clous", "Vis structurales"], "mandatory": true},
      {"category": "Connecteurs", "items": ["Équerres", "Ancrages"], "mandatory": true},
      {"category": "Main-d''oeuvre", "items": ["Installation ossature", "Pose revêtement"], "mandatory": true}
    ]'::jsonb,
    '["Quelle est la hauteur des murs?", "Y a-t-il des ouvertures (portes, fenêtres)?", "Quel type de revêtement extérieur final?"]'::jsonb
  ),
  (
    'toiture_fermes',
    'Toiture avec fermes de toit',
    'moyen',
    10,
    '[
      {"category": "Structure", "items": ["Fermes de toit", "Contreventement"], "mandatory": true},
      {"category": "Revêtement", "items": ["Panneau de toit (OSB/contreplaqué)", "Sous-couche/membrane"], "mandatory": true},
      {"category": "Couverture", "items": ["Bardeaux ou tôle"], "mandatory": true},
      {"category": "Fixations", "items": ["Clous à toiture", "Connecteurs fermes"], "mandatory": true},
      {"category": "Accessoires", "items": ["Fascia", "Soffite", "Gouttières"], "mandatory": false},
      {"category": "Main-d''oeuvre", "items": ["Installation fermes", "Pose couverture"], "mandatory": true}
    ]'::jsonb,
    '["Quelle est la portée des fermes?", "Quel type de couverture (bardeaux, tôle)?", "Y a-t-il des puits de lumière?"]'::jsonb
  ),
  (
    'dalle_monolithique',
    'Dalle de béton monolithique',
    'moyen',
    8,
    '[
      {"category": "Préparation", "items": ["Excavation", "Gravier/pierre concassée", "Membrane poly"], "mandatory": true},
      {"category": "Coffrage", "items": ["Formes périmètre", "Piquets"], "mandatory": true},
      {"category": "Armature", "items": ["Treillis ou barres d''armature", "Chaises"], "mandatory": true},
      {"category": "Béton", "items": ["Béton (m³)", "Pompage si requis"], "mandatory": true},
      {"category": "Finition", "items": ["Finition mécanique", "Cure"], "mandatory": true},
      {"category": "Main-d''oeuvre", "items": ["Coffrage", "Coulée et finition"], "mandatory": true}
    ]'::jsonb,
    '["Quelle est l''épaisseur de la dalle?", "Y a-t-il des planchers chauffants?", "Quel type de finition (lisse, brossé)?"]'::jsonb
  ),
  (
    'fondation_semelle',
    'Fondation avec semelle',
    'complexe',
    15,
    '[
      {"category": "Excavation", "items": ["Excavation", "Remblayage"], "mandatory": true},
      {"category": "Semelles", "items": ["Coffrage semelles", "Béton semelles", "Armature semelles"], "mandatory": true},
      {"category": "Murs", "items": ["Coffrage murs", "Béton murs", "Armature murs"], "mandatory": true},
      {"category": "Imperméabilisation", "items": ["Membrane fondation", "Drain français"], "mandatory": true},
      {"category": "Isolation", "items": ["Isolant rigide"], "mandatory": false},
      {"category": "Main-d''oeuvre", "items": ["Coffrage", "Coulée béton", "Décoffrage"], "mandatory": true}
    ]'::jsonb,
    '["Quelle est la profondeur de la fondation?", "Y a-t-il un sous-sol?", "Quel type de sol (roc, argile, sable)?"]'::jsonb
  ),
  (
    'plancher_solives',
    'Plancher avec solives',
    'simple',
    8,
    '[
      {"category": "Structure", "items": ["Solives", "Poutre principale", "Poteaux"], "mandatory": true},
      {"category": "Revêtement", "items": ["Sous-plancher (OSB/contreplaqué)"], "mandatory": true},
      {"category": "Fixations", "items": ["Clous", "Étriers à solives"], "mandatory": true},
      {"category": "Accessoires", "items": ["Croix de Saint-André", "Bloqueurs"], "mandatory": true},
      {"category": "Main-d''oeuvre", "items": ["Installation solives", "Pose sous-plancher"], "mandatory": true}
    ]'::jsonb,
    '["Quelle est la portée des solives?", "Quel espacement (16 ou 24 pouces)?"]'::jsonb
  )
ON CONFLICT (assembly_type) DO UPDATE SET
  required_items = EXCLUDED.required_items,
  validation_questions = EXCLUDED.validation_questions,
  updated_at = NOW();

-- =====================================================
-- INSERT: Fourchettes de prix marché 2025-2026
-- =====================================================
INSERT INTO market_price_ranges (item_type, unit, min_price, max_price, includes_labor, region, year, source) VALUES
  -- Bois d'oeuvre
  ('bois_2x4', 'pi.li', 0.80, 1.50, false, 'quebec', 2025, 'Marché QC'),
  ('bois_2x6', 'pi.li', 1.20, 2.20, false, 'quebec', 2025, 'Marché QC'),
  ('bois_2x8', 'pi.li', 1.80, 3.00, false, 'quebec', 2025, 'Marché QC'),
  ('bois_2x10', 'pi.li', 2.50, 4.00, false, 'quebec', 2025, 'Marché QC'),
  ('bois_2x12', 'pi.li', 3.50, 5.50, false, 'quebec', 2025, 'Marché QC'),
  
  -- Panneaux
  ('osb_7_16', 'feuille', 25.00, 45.00, false, 'quebec', 2025, 'Marché QC'),
  ('contreplaque_1_2', 'feuille', 45.00, 75.00, false, 'quebec', 2025, 'Marché QC'),
  ('contreplaque_3_4', 'feuille', 55.00, 90.00, false, 'quebec', 2025, 'Marché QC'),
  ('gypse_1_2', 'feuille', 12.00, 20.00, false, 'quebec', 2025, 'Marché QC'),
  ('gypse_5_8', 'feuille', 15.00, 25.00, false, 'quebec', 2025, 'Marché QC'),
  
  -- Béton
  ('beton_standard', 'm³', 180.00, 280.00, false, 'quebec', 2025, 'Marché QC'),
  ('beton_pompage', 'm³', 25.00, 50.00, false, 'quebec', 2025, 'Marché QC'),
  
  -- Isolation
  ('isolant_r20', 'pi²', 1.20, 2.50, false, 'quebec', 2025, 'Marché QC'),
  ('isolant_r24', 'pi²', 1.50, 3.00, false, 'quebec', 2025, 'Marché QC'),
  ('isolant_rigide_2po', 'pi²', 2.00, 4.00, false, 'quebec', 2025, 'Marché QC'),
  ('mousse_uree', 'pi²', 2.50, 5.00, true, 'quebec', 2025, 'Marché QC'),
  
  -- Toiture
  ('bardeaux_asphalte', 'paquet', 35.00, 60.00, false, 'quebec', 2025, 'Marché QC'),
  ('membrane_toiture', 'rouleau', 80.00, 150.00, false, 'quebec', 2025, 'Marché QC'),
  ('tole_acier', 'pi²', 3.00, 7.00, false, 'quebec', 2025, 'Marché QC'),
  
  -- Fixations
  ('clous_construction', 'lb', 3.00, 6.00, false, 'quebec', 2025, 'Marché QC'),
  ('vis_construction', 'lb', 8.00, 15.00, false, 'quebec', 2025, 'Marché QC')
ON CONFLICT (item_type, unit, includes_labor, region, year) DO UPDATE SET
  min_price = EXCLUDED.min_price,
  max_price = EXCLUDED.max_price;

-- =====================================================
-- INSERT: Formules géométriques
-- =====================================================
INSERT INTO geometry_formulas (item_type, formula, calculation_method, default_waste_factor, tolerance_percent) VALUES
  ('mur', 'périmètre × hauteur', 'perimeter_ft * height_ft', 1.05, 10),
  ('toiture', 'longueur × largeur × facteur pente', 'length_ft * width_ft * 1.15', 1.10, 15),
  ('dalle', 'longueur × largeur', 'length_ft * width_ft', 1.02, 5),
  ('plancher', 'longueur × largeur', 'length_ft * width_ft', 1.05, 10),
  ('cloison', 'longueur × hauteur', 'length_ft * height_ft', 1.05, 10),
  ('plafond', 'longueur × largeur', 'length_ft * width_ft', 1.05, 10)
ON CONFLICT (item_type) DO UPDATE SET
  formula = EXCLUDED.formula,
  calculation_method = EXCLUDED.calculation_method;

-- =====================================================
-- RLS Policies
-- =====================================================
ALTER TABLE construction_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE assembly_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE ccq_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_price_ranges ENABLE ROW LEVEL SECURITY;
ALTER TABLE geometry_formulas ENABLE ROW LEVEL SECURITY;

-- Policies pour lecture publique (ces données sont des références)
CREATE POLICY "Anyone can read construction_prices" ON construction_prices FOR SELECT USING (true);
CREATE POLICY "Anyone can read assembly_checklists" ON assembly_checklists FOR SELECT USING (true);
CREATE POLICY "Anyone can read ccq_rates" ON ccq_rates FOR SELECT USING (true);
CREATE POLICY "Anyone can read market_price_ranges" ON market_price_ranges FOR SELECT USING (true);
CREATE POLICY "Anyone can read geometry_formulas" ON geometry_formulas FOR SELECT USING (true);

-- Policies pour écriture (admins seulement via service role)
