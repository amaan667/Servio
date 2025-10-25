-- Update your subscription from Standard to Premium
-- Your Stripe portal shows Standard (£249), but you said you have Premium

-- First, check current subscription
SELECT 
  o.id,
  o.owner_user_id,
  o.subscription_tier,
  o.subscription_status,
  o.stripe_subscription_id,
  u.email
FROM organizations o
LEFT JOIN auth.users u ON u.id = o.owner_user_id
WHERE u.email = 'amaantanveer667@gmail.com';

-- Update to Premium tier
UPDATE organizations
SET 
  subscription_tier = 'premium',
  updated_at = NOW()
WHERE owner_user_id IN (
  SELECT id FROM auth.users WHERE email = 'amaantanveer667@gmail.com'
);

-- Verify the update
SELECT 
  o.id,
  o.owner_user_id,
  o.subscription_tier,
  o.subscription_status,
  o.stripe_subscription_id,
  u.email
FROM organizations o
LEFT JOIN auth.users u ON u.id = o.owner_user_id
WHERE u.email = 'amaantanveer667@gmail.com';

-- Note: You'll also need to update in Stripe dashboard:
-- 1. Go to Stripe Dashboard → Customers
-- 2. Find customer: amaantanveer667@gmail.com
-- 3. Click on their subscription
-- 4. Click "Update subscription"
-- 5. Change from Standard (£249) to Premium (£449)
-- 6. Save changes

-- The code pricing structure:
-- Basic: £99/month
-- Standard: £249/month  
-- Premium: £449/month (unlimited everything)

