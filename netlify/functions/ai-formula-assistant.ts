import type { Handler } from '@netlify/functions';
import { AI_MODELS } from './lib/ai-models';

// Formula system context for Claude
const FORMULA_CONTEXT = `
## BOM Calculator V2 - Formula System

You are helping users write formulas for a fence materials calculator. The formulas calculate quantities of components (posts, pickets, rails, concrete, nails, etc.) based on project inputs.

### Available Variables

**Project Inputs (always available):**
- [Quantity] - Total fence length in feet
- [Lines] - Number of fence lines (1-5)
- [Gates] - Number of gates (0-3)
- [height] - Fence height in feet

**SKU Variables (depend on product type):**
- [post_spacing] - Distance between posts in feet (default: 8)
- [rail_count] - Number of rails per section (2, 3, or 4)
- [board_count] - Number of boards high (for horizontal)
- [panel_width] - Iron panel width in feet (default: 6)
- [rails_per_panel] - Rails per iron panel (default: 3)

**Material Attributes (component.attribute notation):**
- [picket.width_inches] - Picket width in inches
- [board.width_inches] - Board width in inches
- [board.length_feet] - Board length in feet
- [cap.length_feet] - Cap rail length
- [nails_picket.qty_per_unit] - Nails per container (e.g., 300)

**Calculated Values (from other formulas, _qty suffix):**
- [post_qty] - Number of posts calculated
- [picket_qty] - Number of pickets calculated
- [rail_qty] - Number of rails calculated
- [panel_qty] - Number of panels calculated

### Functions

- ROUNDUP(value) - Round up to nearest integer
- ROUNDDOWN(value) - Round down to nearest integer
- ROUND(value) - Round to nearest integer
- MAX(a, b) - Maximum of two values
- MIN(a, b) - Minimum of two values
- IF(condition, true_value, false_value) - Conditional (simplified)

### Formula Examples

**Posts (wood fence):**
ROUNDUP([Quantity]/[post_spacing])+1+ROUNDUP(MAX([Lines]-2,0)/2)
English: Number of sections (length / spacing) + 1 end post + extra posts for multiple fence lines

**Pickets (standard style):**
[Quantity]*12/[picket.width_inches]*1.025
English: Fence length in inches / picket width * 2.5% waste factor

**Pickets (good neighbor - finished both sides):**
[Quantity]*12/[picket.width_inches]*1.025*1.11
English: Same as standard but 11% more for alternating boards

**Rails:**
ROUNDUP([Quantity]/[post_spacing])*[rail_count]
English: Number of sections * rails per section

**Picket Nails (project-level, from nail container):**
([picket_qty]*[rail_count]*2)/[nails_picket.qty_per_unit]
English: Pickets * rails * 2 nails per attachment / nails per box

**Boards (horizontal fence):**
ROUNDUP([height]*12/[board.width_inches])*ROUNDUP([Quantity]/[board.length_feet])
English: Rows high * boards per row

**Iron Panels:**
ROUNDUP([Quantity]/[panel_width])
English: Fence length / panel width rounded up

**Concrete (bags per post):**
[post_qty]*1.5
English: 1.5 bags of concrete per post

### Important Rules

1. All measurements must be in consistent units (convert as needed)
2. Always account for end posts (usually +1)
3. Include waste factors where appropriate (2.5-5% typical)
4. Use ROUNDUP for quantities that must be whole units
5. Reference calculated values with _qty suffix (post_qty, not post_count)
6. Material attributes use dot notation: [component.attribute]
`;

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('Anthropic API key not configured');
    }

    const {
      action,
      description,
      formula,
      componentType,
      productType,
      availableVariables
    } = JSON.parse(event.body || '{}');

    let prompt = '';

    if (action === 'generate') {
      // Generate formula from plain English description
      prompt = `${FORMULA_CONTEXT}

**Task**: Generate a formula from this plain English description.

**Product Type**: ${productType || 'wood fence'}
**Component**: ${componentType || 'unknown'}
**Available Variables**: ${availableVariables?.join(', ') || 'standard project inputs'}

**User's Description**:
"${description}"

Generate the formula and explain your reasoning. Respond with JSON:
{
  "formula": "THE_FORMULA_HERE",
  "plain_english": "Clear explanation of what the formula calculates",
  "variables_used": ["list", "of", "variables", "used"],
  "notes": "Any assumptions made or things the user should verify"
}`;

    } else if (action === 'explain') {
      // Explain existing formula in plain English
      prompt = `${FORMULA_CONTEXT}

**Task**: Explain this formula in plain English.

**Product Type**: ${productType || 'wood fence'}
**Component**: ${componentType || 'unknown'}
**Formula**: ${formula}

Explain what this formula calculates and how it works. Respond with JSON:
{
  "plain_english": "Clear explanation of what the formula calculates and the logic",
  "variables_used": ["list", "of", "variables", "in", "formula"],
  "step_by_step": "Break down the calculation step by step"
}`;

    } else if (action === 'validate') {
      // Validate formula syntax
      prompt = `${FORMULA_CONTEXT}

**Task**: Validate this formula for syntax errors and logical issues.

**Product Type**: ${productType || 'wood fence'}
**Component**: ${componentType || 'unknown'}
**Formula**: ${formula}

Check for:
1. Syntax errors (unmatched brackets, invalid operators)
2. Unknown variables (not in the available list)
3. Logical issues (division by zero risk, unit mismatches)
4. Best practices (appropriate rounding, waste factors)

Respond with JSON:
{
  "valid": true/false,
  "errors": ["list of errors if any"],
  "warnings": ["list of warnings/suggestions"],
  "suggested_fix": "corrected formula if there are errors, or null"
}`;

    } else if (action === 'suggest_variables') {
      // Suggest variables for a product type
      prompt = `${FORMULA_CONTEXT}

**Task**: Suggest input variables needed for a new product type.

**Product Type Description**: "${description}"

Based on this product type, suggest what input variables would be needed for the BOM calculator. Respond with JSON:
{
  "variables": [
    {
      "code": "variable_code",
      "label": "Human readable label",
      "type": "integer|decimal|select",
      "default_value": "default",
      "allowed_values": ["for select type only"],
      "unit": "ft|in|etc",
      "description": "What this variable controls"
    }
  ],
  "suggested_components": ["list", "of", "component", "types", "likely", "needed"]
}`;

    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid action. Use: generate, explain, validate, or suggest_variables' })
      };
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: AI_MODELS.claude,
        max_tokens: 2048,
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
    console.error('AI Formula Assistant error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'AI assistance failed'
      }),
    };
  }
};
