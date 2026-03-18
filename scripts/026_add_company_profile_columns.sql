-- Add company-specific columns to profiles table
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS rbq_number text,
  ADD COLUMN IF NOT EXISTS company_logo_url text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS province text DEFAULT 'QC',
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'Canada';

-- Backfill company_name from existing company field where possible
UPDATE profiles
SET company_name = company
WHERE company_name IS NULL AND company IS NOT NULL;
