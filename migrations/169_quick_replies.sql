-- ============================================================================
-- MESSAGE CENTER PHASE 3 - QUICK REPLIES (Schema update + Default data)
-- ============================================================================

-- Add missing columns to existing table
ALTER TABLE mc_quick_replies ADD COLUMN IF NOT EXISTS use_count INTEGER DEFAULT 0;
ALTER TABLE mc_quick_replies ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Make shortcut unique if not already
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mc_quick_replies_shortcut_key'
  ) THEN
    ALTER TABLE mc_quick_replies ADD CONSTRAINT mc_quick_replies_shortcut_key UNIQUE (shortcut);
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Ignore if constraint already exists or can't be added
  NULL;
END $$;

-- Create indexes if not exist
CREATE INDEX IF NOT EXISTS idx_mc_quick_replies_shortcut ON mc_quick_replies(shortcut);
CREATE INDEX IF NOT EXISTS idx_mc_quick_replies_category ON mc_quick_replies(category);

-- ============================================================================
-- DEFAULT TEMPLATES (using 'title' column as per existing schema)
-- ============================================================================

INSERT INTO mc_quick_replies (title, shortcut, body, category, is_global) VALUES

-- Greetings
('Greeting', '/hi',
'Hi {{client_name}}, this is {{user_name}} from Discount Fence USA. How can I help you today?',
'greeting', true),

-- On My Way / Running Late
('On My Way', '/omw',
'Hi {{client_name}}, I''m on my way to {{property_address}}. I should arrive in approximately {{eta_minutes}} minutes.',
'field', true),

('Running Late', '/late',
'Hi {{client_name}}, I wanted to let you know I''m running about {{delay_minutes}} minutes behind schedule. I apologize for the inconvenience and will be there as soon as possible.',
'field', true),

('Arrived', '/here',
'Hi {{client_name}}, I''ve arrived at {{property_address}}. I''m ready to get started!',
'field', true),

-- Quotes
('Quote Follow-Up', '/quote',
'Hi {{client_name}}, I wanted to follow up on the fence quote I sent for {{property_address}}. Do you have any questions or would you like to move forward?',
'sales', true),

('Quote Ready', '/quoteready',
'Hi {{client_name}}, your fence quote for {{property_address}} is ready! You can view it here: {{quote_link}}. Let me know if you have any questions.',
'sales', true),

-- Scheduling
('Booking Confirmation', '/booked',
'Great news {{client_name}}! Your fence installation at {{property_address}} is scheduled for {{scheduled_date}}. We''ll see you then!',
'scheduling', true),

('Reschedule Request', '/reschedule',
'Hi {{client_name}}, we need to reschedule your appointment at {{property_address}}. What dates work best for you this week?',
'scheduling', true),

-- Job Complete
('Job Complete', '/done',
'Hi {{client_name}}, we''ve completed the fence installation at {{property_address}}. Please take a look and let us know if you have any questions!',
'completion', true),

-- Payment
('Payment Reminder', '/pay',
'Hi {{client_name}}, this is a friendly reminder that your invoice for {{property_address}} is ready. You can pay online here: {{invoice_link}}. Thank you!',
'payment', true),

('Payment Received', '/thanks',
'Hi {{client_name}}, we''ve received your payment. Thank you for choosing Discount Fence USA! We appreciate your business.',
'payment', true)

ON CONFLICT (shortcut) DO NOTHING;

-- ============================================================================
-- HELPER FUNCTION FOR USE COUNT
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_quick_reply_use_count(reply_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE mc_quick_replies
  SET use_count = use_count + 1, updated_at = NOW()
  WHERE id = reply_id;
END;
$$ LANGUAGE plpgsql;
