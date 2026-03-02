-- Update Giacomo's role from admin to owner
UPDATE user_roles
SET role_key = 'owner'
WHERE user_id IN (
  SELECT id FROM auth.users
  WHERE email IN ('giacomo@discountfenceusa.com', 'giacomoiacoangeli@gmail.com')
)
AND role_key = 'admin';
