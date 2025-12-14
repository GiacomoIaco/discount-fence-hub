-- Product Type Knowledge: Stores descriptive knowledge for AI context and reference
-- This captures institutional knowledge about each product type

-- Create product_type_knowledge table
CREATE TABLE IF NOT EXISTS product_type_knowledge (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_type_id UUID NOT NULL REFERENCES product_types_v2(id) ON DELETE CASCADE,

  -- Structured knowledge sections (markdown format)
  overview TEXT, -- General description of the product type
  components_guide TEXT, -- What components are typically used and why
  formula_logic TEXT, -- How formulas should be calculated, rules of thumb
  style_differences TEXT, -- How different styles affect calculations
  installation_notes TEXT, -- Field installation considerations that affect materials

  -- AI interaction history
  ai_history JSONB DEFAULT '[]'::jsonb, -- Array of {timestamp, action, notes}

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_ai_update TIMESTAMPTZ,

  -- One knowledge record per product type
  UNIQUE(product_type_id)
);

-- Enable RLS
ALTER TABLE product_type_knowledge ENABLE ROW LEVEL SECURITY;

-- RLS policies (same as product_types_v2)
CREATE POLICY "product_type_knowledge_select" ON product_type_knowledge
  FOR SELECT USING (true);

CREATE POLICY "product_type_knowledge_insert" ON product_type_knowledge
  FOR INSERT WITH CHECK (true);

CREATE POLICY "product_type_knowledge_update" ON product_type_knowledge
  FOR UPDATE USING (true);

CREATE POLICY "product_type_knowledge_delete" ON product_type_knowledge
  FOR DELETE USING (true);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_product_type_knowledge_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER product_type_knowledge_updated
  BEFORE UPDATE ON product_type_knowledge
  FOR EACH ROW
  EXECUTE FUNCTION update_product_type_knowledge_timestamp();

-- Create index for fast lookup
CREATE INDEX idx_product_type_knowledge_type_id ON product_type_knowledge(product_type_id);

-- Insert starter knowledge for existing product types
INSERT INTO product_type_knowledge (product_type_id, overview, components_guide, formula_logic, style_differences)
SELECT
  id as product_type_id,
  CASE code
    WHEN 'wood_dog_ear' THEN 'Wood dog ear fences feature pickets with a decorative pointed top cut at 45-degree angles. This is the most common residential wood fence style.'
    WHEN 'wood_flat_top' THEN 'Wood flat top fences have pickets cut straight across the top for a clean, modern look.'
    WHEN 'wood_horizontal' THEN 'Horizontal wood fences have boards running horizontally between posts, creating a modern aesthetic popular in contemporary designs.'
    WHEN 'iron' THEN 'Iron/ornamental fences use pre-fabricated panels that attach between posts. Common for decorative and security applications.'
    WHEN 'chain_link' THEN 'Chain link fences use woven wire mesh attached to a framework of posts and rails. Cost-effective for large areas.'
    WHEN 'vinyl' THEN 'Vinyl fences use PVC panels and posts for a maintenance-free alternative to wood.'
    ELSE 'Product type description pending.'
  END as overview,
  NULL as components_guide,
  NULL as formula_logic,
  NULL as style_differences
FROM product_types_v2
ON CONFLICT (product_type_id) DO NOTHING;

COMMENT ON TABLE product_type_knowledge IS 'Stores descriptive knowledge about product types for AI context and team reference';
COMMENT ON COLUMN product_type_knowledge.overview IS 'General description of what this product type is';
COMMENT ON COLUMN product_type_knowledge.components_guide IS 'Guide to components used and their purposes';
COMMENT ON COLUMN product_type_knowledge.formula_logic IS 'Rules and logic for calculating material quantities';
COMMENT ON COLUMN product_type_knowledge.style_differences IS 'How different styles affect the calculations';
COMMENT ON COLUMN product_type_knowledge.installation_notes IS 'Field notes that affect material calculations';
COMMENT ON COLUMN product_type_knowledge.ai_history IS 'Log of AI interactions and changes';
