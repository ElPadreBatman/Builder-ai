-- Extend invitations table for seller tracking and plan pre-selection
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS seller_id UUID REFERENCES auth.users(id);
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS selected_plan TEXT DEFAULT 'base';
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS billing_cycle TEXT DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly'));
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS client_phone TEXT;
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'link', 'self_service'));

-- Add seller role to profiles
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'director', 'employee', 'seller'));

-- Create sellers table for tracking commissions
CREATE TABLE IF NOT EXISTS sellers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  commission_rate DECIMAL(5,2) DEFAULT 10.00,
  total_sales INTEGER DEFAULT 0,
  total_commission DECIMAL(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create sales tracking table
CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  invitation_id UUID REFERENCES invitations(id),
  client_user_id UUID REFERENCES auth.users(id),
  plan_sold TEXT NOT NULL,
  billing_cycle TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  commission_amount DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

-- RLS for sellers (admins can view all, sellers can view their own)
CREATE POLICY "Admins can view all sellers"
  ON sellers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Sellers can view their own record"
  ON sellers FOR SELECT
  USING (user_id = auth.uid());

-- RLS for sales
CREATE POLICY "Admins can view all sales"
  ON sales FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Sellers can view their own sales"
  ON sales FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sellers
      WHERE sellers.id = sales.seller_id
      AND sellers.user_id = auth.uid()
    )
  );

-- Allow public to read valid invitation by token (for signup page)
CREATE POLICY "Anyone can read invitation by token"
  ON invitations FOR SELECT
  USING (
    expires_at > NOW()
    AND accepted_at IS NULL
  );

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_invitations_seller_id ON invitations(seller_id);
CREATE INDEX IF NOT EXISTS idx_sellers_user_id ON sellers(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_seller_id ON sales(seller_id);
