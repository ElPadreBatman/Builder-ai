-- Add subscription fields to profiles table
-- These fields track the user's subscription status with Stripe

-- Add Stripe customer ID
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Add subscription status (active, canceled, past_due, trialing, etc.)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trialing';

-- Add subscription ID from Stripe
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

-- Add subscription end date
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMP WITH TIME ZONE;

-- Add trial end date
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trial_end_date TIMESTAMP WITH TIME ZONE;

-- Add subscription type (free, base, pro)
-- Note: subscription_type column may already exist, so we use IF NOT EXISTS
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'subscription_type'
    ) THEN
        ALTER TABLE profiles ADD COLUMN subscription_type TEXT DEFAULT 'free';
    END IF;
END $$;

-- Add monthly usage tracking
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS soumissions_this_month INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS usage_reset_date TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create index for subscription queries
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id ON profiles(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_status ON profiles(subscription_status);

-- Create a table to track usage history
CREATE TABLE IF NOT EXISTS subscription_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    month_year TEXT NOT NULL, -- Format: "2026-03"
    soumissions_count INTEGER DEFAULT 0,
    projects_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, month_year)
);

-- Enable RLS on subscription_usage
ALTER TABLE subscription_usage ENABLE ROW LEVEL SECURITY;

-- Users can view and update their own usage
CREATE POLICY "users_select_own_usage" ON subscription_usage
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_usage" ON subscription_usage
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_usage" ON subscription_usage
    FOR UPDATE USING (auth.uid() = user_id);

-- Set trial end date for existing users (7 days from now)
UPDATE profiles 
SET trial_end_date = NOW() + INTERVAL '7 days'
WHERE trial_end_date IS NULL AND subscription_status = 'trialing';
