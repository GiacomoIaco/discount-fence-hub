# Working with Claude Code on Specific Features

## Overview
This guide explains how to efficiently work with Claude Code when focusing on a specific feature, minimizing context and keeping work isolated.

## The Problem
As the application grows, each feature becomes a substantial subsystem. When working on a specific feature (like BOM Calculator), Claude Code needs to load the entire codebase context, which:
- Slows down responses
- Increases token usage
- Makes it harder to focus
- Risks unintended changes to other features

## The Solution: Feature-Focused Development

### 1. Use Specific Prompts to Set Context

When starting work on a feature, begin with a focused prompt:

```
"I want to work exclusively on the BOM Calculator feature located in
src/features/bom_calculator/. Please read the README.md and FEATURE_MANIFEST.json
first to understand the feature boundaries. Only make changes within this folder
unless absolutely necessary for integration."
```

### 2. Reference Feature Documentation First

Each feature has:
- **README.md**: Human-readable overview, architecture, development guide
- **FEATURE_MANIFEST.json**: Machine-readable dependencies and metadata
- **index.ts**: Public API showing what's exported

Have Claude Code read these first:
```
"Please read src/features/bom_calculator/README.md and FEATURE_MANIFEST.json
to understand the feature scope before we begin."
```

### 3. Limit File Searches to Feature Scope

When searching for code, constrain to the feature folder:

**Good:**
```
"Search for 'calculatePosts' in src/features/bom_calculator/"
```

**Bad:**
```
"Search for 'calculatePosts' everywhere"  # Might find unrelated code
```

### 4. Specify Integration Points Explicitly

If you need to touch code outside the feature:

```
"The BOM Calculator needs to integrate with the auth system. According to
FEATURE_MANIFEST.json, it uses src/lib/auth.ts. Please review that file's
current API and show me how to use it, but DO NOT modify it unless we
explicitly discuss the change."
```

### 5. Use Feature Branches

Create feature-specific branches:

```bash
git checkout -b feature/bom-calculator-improvements
```

This isolates your work and makes it easier to review changes that affect only one feature.

### 6. Request Feature-Scoped Summaries

When asking for overviews:

```
"Please provide a summary of the BOM Calculator feature by reading only files in
src/features/bom_calculator/ and its README.md. Do not analyze other features."
```

## Best Practices by Task Type

### Adding New Functionality

1. **Start with feature docs**:
   ```
   "I want to add PDF export to BOM Calculator. Please read the README's
   'Future Enhancements' section and tell me where this should be implemented
   based on the current architecture."
   ```

2. **Keep changes contained**:
   - New components go in `components/`
   - New hooks go in `hooks/`
   - New services go in `services/`
   - Update README.md with new functionality

### Debugging Issues

1. **Provide feature context**:
   ```
   "There's a bug in the BOM Calculator where labor codes aren't loading correctly.
   Based on the architecture in README.md, this should be in hooks/useBOMData.ts.
   Please investigate only files in src/features/bom_calculator/."
   ```

2. **Check integration points if needed**:
   ```
   "The bug might be related to database access. FEATURE_MANIFEST.json shows we
   depend on src/lib/supabase.ts. Please check if that API has changed."
   ```

### Refactoring

1. **Set clear boundaries**:
   ```
   "I want to refactor the FenceCalculator service to improve performance.
   Only modify files in src/features/bom_calculator/services/. Do not change
   any external dependencies or public API (index.ts)."
   ```

2. **Update documentation**:
   ```
   "After refactoring, please update the README.md to reflect any architectural
   changes."
   ```

## Example Workflow: Adding a New Feature

### Step 1: Create Feature Structure

```
"Please create a new feature called 'inventory-manager' following the
FEATURE_TEMPLATE in src/features/FEATURE_TEMPLATE/. It should:
1. Track inventory levels for materials
2. Generate reorder alerts
3. Integrate with the materials table from BOM Calculator
Only create the folder structure and documentation first."
```

### Step 2: Define Public API

```
"Now create the index.ts public API for the inventory-manager feature.
It should export:
- Main component: InventoryManager
- Types: InventoryItem, ReorderAlert
Keep all implementation details private."
```

### Step 3: Implement Incrementally

```
"Let's implement the inventory tracking functionality. Working only in
src/features/inventory_manager/, create:
1. types.ts with InventoryItem interface
2. hooks/useInventory.ts for data fetching
3. InventoryManager.tsx main component

Use the BOM Calculator's useBOMData.ts as a reference for the hook pattern,
but don't modify any BOM Calculator files."
```

## Handling Cross-Feature Dependencies

Sometimes features need to share code. Here's the priority order:

### Option 1: Keep It Separate (Preferred)
Duplicate small amounts of code rather than create complex dependencies.

### Option 2: Shared Utilities
For commonly used utilities, create:
```
src/utils/
  ├── formatters.ts      # Date, currency formatting
  ├── validators.ts      # Input validation
  └── calculations.ts    # Math helpers
```

### Option 3: Shared Components
For UI components used across features:
```
src/components/
  ├── Button.tsx
  ├── Modal.tsx
  └── DataTable.tsx
```

### Option 4: Feature Dependencies (Last Resort)
If one feature absolutely needs another:
1. Import only through the public API (index.ts)
2. Document in FEATURE_MANIFEST.json
3. Consider if features should be merged

Example:
```typescript
// ✅ Good - using public API
import { type ProjectDetails } from '@/features/bom_calculator';

// ❌ Bad - reaching into internals
import { useBOMData } from '@/features/bom_calculator/hooks/useBOMData';
```

## Tips for Claude Code Efficiency

### 1. Be Explicit About Scope

**Bad:**
```
"Fix the calculation bug"  # Which feature? Which calculation?
```

**Good:**
```
"Fix the post calculation bug in BOM Calculator's FenceCalculator.ts at line 435"
```

### 2. Reference Feature Docs

**Bad:**
```
"How does this feature work?"  # Requires analyzing all code
```

**Good:**
```
"Explain the BOM Calculator feature using its README.md"
```

### 3. Request Focused File Reads

**Bad:**
```
"Read all the BOM Calculator code"  # Lots of context
```

**Good:**
```
"Read only BOMCalculator.tsx and the README.md to understand the main component"
```

### 4. Use Grep with Feature Path

**Bad:**
```
"Find where BusinessUnit is used"  # Might be everywhere
```

**Good:**
```
"Grep for 'BusinessUnit' in src/features/bom_calculator/ only"
```

## Commit Messages for Feature Work

Use prefixes to make it clear which feature changed:

```
feat(bom-calculator): Add PDF export functionality
fix(bom-calculator): Fix labor code selection for steel posts
refactor(bom-calculator): Extract calculation logic to service
docs(bom-calculator): Update README with new export feature
```

## Testing Feature Isolation

To verify a feature is well-isolated:

1. **Check imports**: All imports should be from within feature or documented dependencies
2. **Check exports**: Only public API should be exported via index.ts
3. **Check database**: Migrations should be self-contained
4. **Check tests**: Should not require mocking other features

## When to Break Feature Boundaries

It's OK to touch code outside a feature when:
1. **Fixing a bug** in shared code that affects your feature
2. **Updating a shared type** that your feature uses
3. **Adding a route** to the main App.tsx router
4. **Updating documentation** at the project level

Always call out these changes explicitly:
```
"I need to update the main App.tsx to add the new BOM Calculator route.
This is the only file outside src/features/bom_calculator/ that will change."
```

## Summary

**DO:**
- ✅ Start with feature README.md and FEATURE_MANIFEST.json
- ✅ Limit file operations to feature folder
- ✅ Use specific, scoped prompts
- ✅ Import from public APIs (index.ts) only
- ✅ Document external dependencies
- ✅ Update feature docs after changes

**DON'T:**
- ❌ Ask broad questions that require analyzing entire codebase
- ❌ Import from internal files of other features
- ❌ Modify shared code without explicit discussion
- ❌ Skip documentation updates
- ❌ Leave features without README and manifest
