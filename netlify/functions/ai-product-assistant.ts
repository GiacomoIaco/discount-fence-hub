import type { Handler } from '@netlify/functions';

// Complete Product Type Configuration Context for Claude
const PRODUCT_TYPE_CONTEXT = `
## BOM Calculator V2 - Product Type Configuration System

You are an AI assistant helping Operations Managers configure fence product types in the Discount Fence Hub calculator. You understand the complete data model and can help with ANY configuration task.

### Data Model Overview

**Product Types** (e.g., wood_vertical, wood_horizontal, iron, chain_link, vinyl, aluminum)
├── **Styles** (variations like standard, good_neighbor, board_on_board)
│   └── formula_adjustments: JSON overrides (e.g., {"post_spacing": 7.71, "picket_multiplier": 1.11})
├── **Variables** (user inputs for SKU builder)
│   └── variable_code, variable_type (integer/decimal/select), default_value, allowed_values
├── **Components** (assigned from master list)
│   └── display_order determines formula execution sequence
├── **Formulas** (one per component, optionally per style)
│   └── formula expression, plain_english description, rounding_level
└── **Labor** (labor codes per component)

### Formula Syntax

**Project Inputs:**
- [Quantity] - Fence length in feet
- [Lines] - Number of fence lines (1-5)
- [Gates] - Number of gates (0-3)
- [height] - Fence height in feet

**SKU Variables (depend on product type):**
- [post_spacing] - Distance between posts (default: 8)
- [rail_count] - Rails per section (2, 3, or 4)
- [board_count] - Boards high (horizontal)
- [panel_width] - Panel width in feet (iron/aluminum)

**Material Attributes:**
- [component.attribute] notation, e.g., [picket.width_inches]

**Calculated Values (from previous formulas):**
- [component_code_qty] suffix, e.g., [post_qty], [picket_qty]

**Functions:**
- ROUNDUP(), ROUNDDOWN(), ROUND(), MAX(), MIN(), IF()

### Common Component Types
- post, picket, rail, cap, trim, rot_board, nailer
- board (horizontal), vertical_trim
- panel (iron/aluminum), bracket, iron_post_cap
- nails_picket, nails_frame, screws
- concrete_sand, concrete_portland, concrete_quickrock
- steel_post (for special posts)

### Common Formulas by Component

**Posts:** ROUNDUP([Quantity]/[post_spacing])+1+ROUNDUP(MAX([Lines]-2,0)/2)
**Pickets (standard):** [Quantity]*12/[picket.width_inches]*1.025
**Pickets (good neighbor):** [Quantity]*12/[picket.width_inches]*1.025*1.11
**Rails:** ROUNDUP([Quantity]/[post_spacing])*[rail_count]
**Caps:** ROUNDUP([Quantity]/[cap.length_feet])
**Nails:** ([picket_qty]*[rail_count]*2)/[nails_picket.qty_per_unit]
**Concrete:** [post_qty]*1.5

### Style Adjustments Examples

**Good Neighbor (finished both sides):**
{"post_spacing": 7.71, "picket_multiplier": 1.11}

**Board on Board (overlapping):**
{"picket_multiplier": 2, "overlap_factor": 0.5}

### Your Capabilities

1. **Generate formulas** from plain English descriptions
2. **Explain formulas** in plain English
3. **Suggest variables** needed for a product type
4. **Suggest components** typically used for a product type
5. **Suggest style adjustments** based on style description
6. **Create complete product type configurations** including all sub-entities
7. **Validate configurations** for consistency and completeness
`;

interface ProductContext {
  currentTab: 'types' | 'styles' | 'variables' | 'components' | 'formulas' | 'labor' | 'knowledge';
  selectedProductType?: {
    id: string;
    code: string;
    name: string;
  };
  selectedStyle?: {
    id: string;
    code: string;
    name: string;
  };
  existingStyles?: Array<{ code: string; name: string }>;
  existingVariables?: Array<{ code: string; name: string; type: string }>;
  existingComponents?: Array<{ code: string; name: string; is_assigned: boolean }>;
  existingFormulas?: Array<{ component_code: string; style_code?: string; has_formula: boolean }>;
  // Product knowledge for AI context
  knowledge?: {
    overview?: string;
    components_guide?: string;
    formula_logic?: string;
    style_differences?: string;
    installation_notes?: string;
  };
}

interface ActionPlan {
  action: string;
  entity: string;
  data: Record<string, any>;
  description: string;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('Anthropic API key not configured');
    }

    const { request, context } = JSON.parse(event.body || '{}') as {
      request: string;
      context: ProductContext;
    };

    if (!request?.trim()) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Request is required' })
      };
    }

    // Build context summary for Claude
    const contextSummary = buildContextSummary(context);

    const prompt = `${PRODUCT_TYPE_CONTEXT}

### Current Context
${contextSummary}

### User Request
"${request}"

### Instructions

Analyze the user's request and determine what actions are needed. You can:
1. Answer questions about product configuration
2. Generate a single item (formula, style, variable, etc.)
3. Generate a multi-step action plan for complex requests

**Response Format (JSON):**

For questions/explanations:
{
  "type": "response",
  "message": "Your helpful explanation here",
  "suggestions": ["optional", "follow-up", "suggestions"]
}

For single-item generation (formula, style adjustment, etc.):
{
  "type": "single",
  "entity": "formula|style|variable|component_assignment",
  "data": { /* the generated data */ },
  "explanation": "What this does and why"
}

For multi-step actions (creating product type, bulk operations):
{
  "type": "plan",
  "summary": "Brief description of what will be created",
  "steps": [
    {
      "action": "create|update|assign",
      "entity": "product_type|style|variable|component|formula|labor",
      "data": { /* entity-specific data */ },
      "description": "What this step does"
    }
  ],
  "notes": "Any important notes or assumptions"
}

**Entity Data Structures:**

product_type: { code, name, default_post_spacing }
style: { code, name, formula_adjustments: {} }
variable: { variable_code, variable_name, variable_type, default_value, allowed_values?, unit? }
component: { component_code } (for assignment)
formula: { component_code, style_code?, formula, plain_english, rounding_level }
labor: { labor_code, labor_group, condition_formula?, action? }
  - labor_code: The labor SKU (e.g., "W03", "M06")
  - labor_group: Group code - "set_post", "nail_up", or "other_labor"
  - condition_formula: Optional condition like "height <= 6" or "style == 'good_neighbor'"
  - action: "add" (default) or "remove"

Respond with valid JSON only.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Claude API request failed');
    }

    const data = await response.json();
    const content = data.content[0].text;

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse Claude response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      statusCode: 200,
      body: JSON.stringify(parsed),
    };
  } catch (error) {
    console.error('AI Product Assistant error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'AI assistance failed'
      }),
    };
  }
};

function buildContextSummary(context: ProductContext): string {
  const lines: string[] = [];

  lines.push(`**Current Tab:** ${context.currentTab}`);

  if (context.selectedProductType) {
    lines.push(`**Selected Product Type:** ${context.selectedProductType.name} (${context.selectedProductType.code})`);
  } else {
    lines.push('**Selected Product Type:** None');
  }

  if (context.selectedStyle) {
    lines.push(`**Selected Style:** ${context.selectedStyle.name} (${context.selectedStyle.code})`);
  }

  if (context.existingStyles?.length) {
    lines.push(`**Existing Styles:** ${context.existingStyles.map(s => s.code).join(', ')}`);
  }

  if (context.existingVariables?.length) {
    lines.push(`**Existing Variables:** ${context.existingVariables.map(v => `${v.code} (${v.type})`).join(', ')}`);
  }

  if (context.existingComponents?.length) {
    const assigned = context.existingComponents.filter(c => c.is_assigned);
    const unassigned = context.existingComponents.filter(c => !c.is_assigned);
    if (assigned.length) {
      lines.push(`**Assigned Components:** ${assigned.map(c => c.code).join(', ')}`);
    }
    if (unassigned.length) {
      lines.push(`**Available (unassigned) Components:** ${unassigned.slice(0, 10).map(c => c.code).join(', ')}${unassigned.length > 10 ? '...' : ''}`);
    }
  }

  if (context.existingFormulas?.length) {
    const withFormulas = context.existingFormulas.filter(f => f.has_formula);
    const withoutFormulas = context.existingFormulas.filter(f => !f.has_formula);
    if (withFormulas.length) {
      lines.push(`**Components with Formulas:** ${withFormulas.map(f => f.component_code).join(', ')}`);
    }
    if (withoutFormulas.length) {
      lines.push(`**Components Missing Formulas:** ${withoutFormulas.map(f => f.component_code).join(', ')}`);
    }
  }

  // Add product knowledge if available
  if (context.knowledge) {
    lines.push('\n### Product Knowledge (use this for context)');
    if (context.knowledge.overview) {
      lines.push(`**Overview:** ${context.knowledge.overview}`);
    }
    if (context.knowledge.components_guide) {
      lines.push(`**Components Guide:** ${context.knowledge.components_guide}`);
    }
    if (context.knowledge.formula_logic) {
      lines.push(`**Formula Logic:** ${context.knowledge.formula_logic}`);
    }
    if (context.knowledge.style_differences) {
      lines.push(`**Style Differences:** ${context.knowledge.style_differences}`);
    }
    if (context.knowledge.installation_notes) {
      lines.push(`**Installation Notes:** ${context.knowledge.installation_notes}`);
    }
  }

  return lines.join('\n');
}
