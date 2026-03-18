-- Add preferred_language column to profiles table
-- Supports: fr (French), en (English), es (Spanish)
-- Default: fr (French)

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'fr';

-- Add constraint to ensure only valid language codes
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_preferred_language_check;

ALTER TABLE profiles
ADD CONSTRAINT profiles_preferred_language_check 
CHECK (preferred_language IN ('fr', 'en', 'es'));

-- Update existing profiles that have NULL language to French
UPDATE profiles 
SET preferred_language = 'fr' 
WHERE preferred_language IS NULL;
