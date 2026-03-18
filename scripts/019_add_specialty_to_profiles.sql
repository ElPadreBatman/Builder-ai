-- Migration: Ajouter le champ specialty aux profiles
-- Permet d'ajuster les questions et soumissions selon le métier

-- Ajouter la colonne specialty
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS specialty text DEFAULT 'general';

-- Ajouter un commentaire pour documenter les valeurs possibles
COMMENT ON COLUMN profiles.specialty IS 'Spécialité du contracteur: general, plombier, electricien, menuisier, peintre, couvreur, maconnerie, hvac, paysagiste, demolition, excavation, beton, isolation, fenestration, autre';

-- Créer un index pour faciliter les recherches par spécialité
CREATE INDEX IF NOT EXISTS idx_profiles_specialty ON profiles(specialty);

-- Mettre à jour les profils existants pour s'assurer qu'ils ont une spécialité
UPDATE profiles 
SET specialty = 'general' 
WHERE specialty IS NULL;

-- Vérifier la migration
SELECT email, specialty FROM profiles LIMIT 5;
