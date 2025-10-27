# Risk Mitigation & Safe Deployment Strategy
**Discount Fence Hub - Architectural Refactoring**
**Created:** October 10, 2025

---

## Table of Contents

1. [Risk Assessment](#risk-assessment)
2. [Git Branching Strategy](#git-branching-strategy)
3. [Database Migration Safety](#database-migration-safety)
4. [Feature Flags for Gradual Rollout](#feature-flags)
5. [Testing Strategy](#testing-strategy)
6. [Deployment Pipeline](#deployment-pipeline)
7. [Rollback Procedures](#rollback-procedures)
8. [Monitoring & Alerts](#monitoring-alerts)
9. [Phase-by-Phase Safety Plans](#phase-safety-plans)

---

## Risk Assessment

### What Could Go Wrong?

| Risk | Probability | Impact | Severity | Mitigation Priority |
|------|-------------|--------|----------|-------------------|
| Database migration fails mid-way | MEDIUM | CRITICAL | 🔴 HIGH | 1 |
| Data corruption during localStorage migration | MEDIUM | CRITICAL | 🔴 HIGH | 1 |
| Breaking changes in refactored components | HIGH | HIGH | 🟠 MEDIUM | 2 |
| API changes break mobile/desktop compatibility | MEDIUM | HIGH | 🟠 MEDIUM | 2 |
| Performance regression | LOW | MEDIUM | 🟡 LOW | 3 |
| User data loss during transition | LOW | CRITICAL | 🟠 MEDIUM | 1 |
| Deployment rollback needed | MEDIUM | HIGH | 🟠 MEDIUM | 2 |

### Your Concern Level is Perfect! ✅

**You're exactly where you should be:**
- ✅ Cautious but not paralyzed
- ✅ Asking for mitigation before breaking things
- ✅ Thinking about branching strategy
- ✅ Concerned about user impact

**Red flags would be:**
- ❌ "Let's just push to main and see what happens"
- ❌ "No need for branches, YOLO"
- ❌ "We don't need backups for database migrations"

---

## Git Branching Strategy

### Strategy: Feature Branch Workflow with Protection

```
main (production)
  ↓
develop (staging)
  ↓
feature/phase-1-migrations
feature/phase-1-sales-coach-migration
feature/phase-1-error-boundaries
feature/phase-2-consolidate-team-comm
feature/phase-2-react-query
...
```

### Branch Protection Rules

**1. Protect `main` branch:**

```bash
# In GitHub Settings → Branches → Add Rule for 'main'
☑ Require pull request reviews before merging (1 approval minimum)
☑ Require status checks to pass before merging
  - ☑ Build succeeds
  - ☑ All tests pass
  - ☑ No TypeScript errors
☑ Require branches to be up to date before merging
☑ Include administrators (even you need to follow rules!)
☐ Allow force pushes (NEVER!)
☐ Allow deletions (NEVER!)
```

**2. Create `develop` branch:**

```bash
# From main, create develop branch
git checkout main
git pull origin main
git checkout -b develop
git push -u origin develop

# Protect develop too (same rules as main)
```

### Branching Workflow

#### Step 1: Create Feature Branch

```bash
# Always branch from develop
git checkout develop
git pull origin develop

# Create feature branch with descriptive name
git checkout -b feature/phase-1-migration-tracking

# Work on your changes...

# Commit frequently with clear messages
git add migrations/001_migration_tracking.sql
git commit -m "Add migration tracking table and runner script

- Creates schema_migrations table
- Adds migration runner script with dry-run mode
- Includes rollback documentation
- Tested on local database

Addresses: Critical migration conflicts issue"

git push -u origin feature/phase-1-migration-tracking
```

#### Step 2: Create Pull Request

**PR Template** (create `.github/pull_request_template.md`):

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Refactoring (no functional changes)
- [ ] Database migration

## How Has This Been Tested?
- [ ] Unit tests added/updated
- [ ] Manual testing performed
- [ ] Tested on staging environment
- [ ] Database migration tested with rollback

## Database Changes
- [ ] No database changes
- [ ] Migration file included (number: ___)
- [ ] Migration tested with sample data
- [ ] Rollback tested
- [ ] Data backup plan documented

## Breaking Changes
- [ ] No breaking changes
- [ ] Breaking changes documented below

**Breaking Changes:**
(list any breaking changes)

## Deployment Notes
Any special deployment instructions

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review performed
- [ ] Comments added for complex logic
- [ ] No console.log() or debugging code left
- [ ] TypeScript types properly defined (no 'any')
- [ ] Tests pass locally
- [ ] Documentation updated

## Screenshots (if applicable)
(add screenshots)

## Risk Level
- [ ] Low risk (CSS, copy changes, minor bug fixes)
- [ ] Medium risk (new features, refactoring)
- [ ] High risk (database changes, breaking changes, architecture changes)
```

#### Step 3: Code Review Process

```bash
# Assign reviewers (even if it's just you reviewing later)
# Use GitHub's review features:
# - Request changes (if issues found)
# - Approve (if looks good)
# - Comment (for discussion)

# Address review feedback
git checkout feature/phase-1-migration-tracking
# Make changes...
git add .
git commit -m "Address review feedback: Add error handling to migration runner"
git push

# Once approved, merge to develop (NOT main yet!)
```

#### Step 4: Test on Develop/Staging

```bash
# develop branch auto-deploys to staging (Netlify)
# Test thoroughly on staging before merging to main

# If issues found:
git checkout develop
git revert <commit-hash>  # Safer than force push
git push origin develop

# Fix in feature branch and repeat
```

#### Step 5: Deploy to Production

```bash
# Only after staging is stable!
# Create PR from develop → main

# After merge to main:
# - main auto-deploys to production
# - Tag the release
git checkout main
git pull origin main
git tag -a v1.1.0 -m "Phase 1: Migration tracking and error boundaries"
git push origin v1.1.0
```

### Emergency Hotfix Workflow

```bash
# For critical production bugs ONLY

# Branch from main (not develop!)
git checkout main
git pull origin main
git checkout -b hotfix/critical-auth-bug

# Fix the bug
# ... make changes ...

# Test thoroughly locally
git add .
git commit -m "HOTFIX: Fix authentication redirect loop

- Users stuck in login loop
- Added redirect validation
- Tested with 5 test accounts

Critical bug affecting all users"

git push -u origin hotfix/critical-auth-bug

# Create PR to main (expedited review)
# After merge, also merge back to develop!
git checkout develop
git merge main
git push origin develop
```

---

## Database Migration Safety

### Pre-Migration Checklist

**NEVER run a migration without:**

1. **Full Database Backup**
```sql
-- In Supabase Dashboard → Database → Backups
-- OR via CLI:
supabase db dump -f backup_before_migration_011.sql

-- Verify backup file size (should be > 0 bytes)
ls -lh backup_before_migration_011.sql
```

2. **Test on Development Database First**
```bash
# Create a dev database (separate from production)
# In Supabase: Create new project for testing

# Test migration
npm run migrate:check  # Dry run
npm run migrate:apply  # Actually run

# Verify data integrity
# Run test queries to ensure nothing broke

# Test rollback
# Restore from backup
# Verify rollback worked
```

3. **Staging Environment Testing**
```bash
# Deploy to staging with migration
# Test all features
# Check for errors in logs
# Verify data looks correct
# Test for 24 hours minimum
```

### Safe Migration Pattern

**BAD (Risky):**
```sql
-- ❌ DANGEROUS: Drops column immediately
ALTER TABLE requests DROP COLUMN old_field;

-- ❌ DANGEROUS: Changes type without safety
ALTER TABLE requests ALTER COLUMN price TYPE DECIMAL(10,2);
```

**GOOD (Safe):**
```sql
-- ✅ SAFE: Three-step migration

-- Step 1: Add new column (doesn't break anything)
ALTER TABLE requests ADD COLUMN price_new DECIMAL(10,2);

-- Step 2: Backfill data (in batches to avoid timeouts)
DO $$
DECLARE
  batch_size INTEGER := 1000;
  offset_val INTEGER := 0;
  rows_updated INTEGER;
BEGIN
  LOOP
    UPDATE requests
    SET price_new = price::DECIMAL(10,2)
    WHERE id IN (
      SELECT id FROM requests
      WHERE price_new IS NULL
      LIMIT batch_size
      OFFSET offset_val
    );

    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    EXIT WHEN rows_updated = 0;

    offset_val := offset_val + batch_size;
    RAISE NOTICE 'Updated % rows (offset: %)', rows_updated, offset_val;

    -- Commit in batches
    COMMIT;
  END LOOP;
END $$;

-- Step 3: Verify before dropping old column
SELECT COUNT(*) FROM requests WHERE price_new IS NULL;
-- If count is 0, safe to proceed

-- Wait a few days in production to ensure no issues!

-- Step 4: Drop old column (in separate migration after verification)
-- Migration 012_cleanup_old_price_column.sql
ALTER TABLE requests DROP COLUMN price;
ALTER TABLE requests RENAME COLUMN price_new TO price;
```

### Migration Rollback Plan

**For Every Migration, Document Rollback:**

```sql
-- migrations/011_sales_coach_recordings.sql

/*
MIGRATION: Sales Coach Recordings
CREATED: 2025-10-10
RISK LEVEL: HIGH (new tables + data migration)

ROLLBACK PROCEDURE:
1. Restore from backup: backup_before_migration_011.sql
2. OR run reverse migration:
   DROP TABLE IF EXISTS recording_insights CASCADE;
   DROP TABLE IF EXISTS recording_analysis CASCADE;
   DROP TABLE IF EXISTS recording_goals CASCADE;
   DROP TABLE IF EXISTS recordings CASCADE;
   DROP FUNCTION IF EXISTS get_user_average_scores;
   DROP FUNCTION IF EXISTS get_team_leaderboard;

3. Verify rollback:
   SELECT * FROM schema_migrations WHERE version = 11;
   -- Should return no rows

4. Update schema_migrations:
   DELETE FROM schema_migrations WHERE version = 11;

VERIFICATION QUERIES:
- SELECT COUNT(*) FROM recordings;
- SELECT COUNT(*) FROM recording_analysis;
- SELECT * FROM get_team_leaderboard('month');
*/

-- Actual migration code here...
```

### Data Migration Safety (localStorage → Supabase)

**Phased Approach:**

**Phase 1: Dual Write (Week 1)**
```typescript
// Write to BOTH localStorage AND Supabase
export async function saveRecording(userId: string, recording: Recording) {
  // OLD: Write to localStorage (keep for now)
  const existing = getRecordingsFromLocalStorage(userId);
  localStorage.setItem(`recordings_${userId}`, JSON.stringify([...existing, recording]));

  // NEW: Also write to Supabase
  try {
    await supabase.from('recordings').insert(recording);
  } catch (error) {
    console.error('Failed to save to Supabase:', error);
    // Don't fail - localStorage still works!
  }
}

// Read from Supabase FIRST, fallback to localStorage
export async function getRecordings(userId: string): Promise<Recording[]> {
  try {
    // Try Supabase first
    const { data, error } = await supabase
      .from('recordings')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;

    if (data && data.length > 0) {
      return data; // ✅ Supabase has data, use it
    }

    // No data in Supabase, check localStorage
    const localData = getRecordingsFromLocalStorage(userId);
    if (localData.length > 0) {
      // Migrate to Supabase in background
      migrateToSupabaseInBackground(userId, localData);
      return localData;
    }

    return [];
  } catch (error) {
    // Supabase failed, fallback to localStorage
    console.error('Supabase error, using localStorage:', error);
    return getRecordingsFromLocalStorage(userId);
  }
}
```

**Phase 2: Migration Prompt (Week 2)**
```typescript
// Show user a migration prompt
function RecordingsMigrationBanner() {
  const { user } = useAuth();
  const [localCount, setLocalCount] = useState(0);
  const [migrated, setMigrated] = useState(false);

  useEffect(() => {
    const local = getRecordingsFromLocalStorage(user.id);
    setLocalCount(local.length);

    const migrationFlag = localStorage.getItem(`recordings_migrated_${user.id}`);
    setMigrated(migrationFlag === 'true');
  }, [user]);

  if (migrated || localCount === 0) return null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
      <h3 className="font-semibold text-blue-900 mb-2">
        🔄 Migrate Your Recordings
      </h3>
      <p className="text-sm text-blue-800 mb-3">
        We found {localCount} recording{localCount > 1 ? 's' : ''} in your browser.
        Migrate them to the cloud for safe, permanent storage and access from any device!
      </p>
      <button
        onClick={handleMigrate}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        Migrate Now (Recommended)
      </button>
      <button
        onClick={handleRemindLater}
        className="ml-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
      >
        Remind Me Later
      </button>
    </div>
  );
}

async function handleMigrate() {
  setMigrating(true);

  try {
    const result = await migrateMyRecordingsFromBrowser(user.id);

    if (result.success) {
      // Success!
      localStorage.setItem(`recordings_migrated_${user.id}`, 'true');
      showSuccessToast(`Successfully migrated ${result.count} recordings!`);
      setMigrated(true);
    } else {
      showErrorToast(`Migration had ${result.errors} errors. Please try again.`);
    }
  } catch (error) {
    showErrorToast('Migration failed. Your data is still safe in your browser.');
  } finally {
    setMigrating(false);
  }
}
```

**Phase 3: Deprecation Notice (Week 3-4)**
```typescript
// After most users migrated, show stronger notice
function LegacyStorageWarning() {
  const localCount = getRecordingsFromLocalStorage(user.id).length;

  if (localCount === 0) return null;

  return (
    <div className="bg-yellow-50 border border-yellow-400 rounded-lg p-4 mb-4">
      <h3 className="font-semibold text-yellow-900 mb-2">
        ⚠️ Action Required: Migrate Your Data
      </h3>
      <p className="text-sm text-yellow-800 mb-3">
        Browser storage will be deprecated on [DATE]. Migrate now to avoid data loss!
      </p>
      <button
        onClick={handleMigrate}
        className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
      >
        Migrate Now
      </button>
    </div>
  );
}
```

**Phase 4: Read-Only (Week 5+)**
```typescript
// Stop writing to localStorage
export async function saveRecording(userId: string, recording: Recording) {
  // Only write to Supabase now
  await supabase.from('recordings').insert(recording);

  // Remove localStorage write
  // localStorage.setItem(...) ← Deleted
}
```

---

## Feature Flags for Gradual Rollout

### Simple Feature Flag System

**Create `src/lib/features.ts`:**

```typescript
// Feature flags stored in environment variables
export const FEATURES = {
  // Phase 1
  USE_SUPABASE_RECORDINGS: import.meta.env.VITE_FEATURE_SUPABASE_RECORDINGS === 'true',
  MIGRATION_TRACKING: import.meta.env.VITE_FEATURE_MIGRATION_TRACKING === 'true',

  // Phase 2
  USE_REACT_QUERY: import.meta.env.VITE_FEATURE_REACT_QUERY === 'true',
  NEW_TEAM_COMM: import.meta.env.VITE_FEATURE_NEW_TEAM_COMM === 'true',

  // Development only
  DEV_TOOLS: import.meta.env.DEV,
  SHOW_PERFORMANCE_METRICS: import.meta.env.VITE_SHOW_PERF === 'true',
};

// Helper function
export function isFeatureEnabled(feature: keyof typeof FEATURES): boolean {
  return FEATURES[feature];
}

// Usage in components
import { isFeatureEnabled } from '../lib/features';

export default function SalesCoach() {
  const useNewBackend = isFeatureEnabled('USE_SUPABASE_RECORDINGS');

  if (useNewBackend) {
    // New Supabase version
    return <SalesCoachSupabase />;
  } else {
    // Old localStorage version
    return <SalesCoachLegacy />;
  }
}
```

**Environment-based Rollout:**

```bash
# .env.local (local development - test new features)
VITE_FEATURE_SUPABASE_RECORDINGS=true
VITE_FEATURE_REACT_QUERY=true
VITE_FEATURE_NEW_TEAM_COMM=true

# .env.staging (staging - enable for testing)
VITE_FEATURE_SUPABASE_RECORDINGS=true
VITE_FEATURE_REACT_QUERY=false  # Not ready yet
VITE_FEATURE_NEW_TEAM_COMM=false

# .env.production (production - gradual rollout)
VITE_FEATURE_SUPABASE_RECORDINGS=false  # Start disabled
VITE_FEATURE_REACT_QUERY=false
VITE_FEATURE_NEW_TEAM_COMM=false

# After 1 week of testing, enable in production:
VITE_FEATURE_SUPABASE_RECORDINGS=true
```

### Advanced: User-Based Rollout

```typescript
// src/lib/features.ts
export function isFeatureEnabledForUser(
  feature: keyof typeof FEATURES,
  userId: string
): boolean {
  // Always enabled in dev
  if (import.meta.env.DEV) return true;

  // Check environment flag first
  if (!FEATURES[feature]) return false;

  // Gradual rollout: enable for 10% of users (based on user ID hash)
  const hash = hashCode(userId);
  const percentage = Math.abs(hash % 100);

  // Start with 10%, then 25%, 50%, 100%
  const rolloutPercentage = import.meta.env.VITE_ROLLOUT_PERCENTAGE || 10;
  return percentage < rolloutPercentage;
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash;
}

// Usage
const canUseNewFeature = isFeatureEnabledForUser('USE_SUPABASE_RECORDINGS', user.id);
```

---

## Testing Strategy

### Testing Pyramid

```
       /\
      /  \  E2E Tests (5%)
     /____\  Slow, expensive, high confidence
    /      \
   / Integration \ (15%)
  /    Tests     \
 /________________\
/                  \
/   Unit Tests     \ (80%)
/  Fast, cheap     \
/____________________\
```

### 1. Unit Tests (Start Here!)

```bash
# Install testing dependencies
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

**Example: Test migration tracking**

```typescript
// scripts/__tests__/migration-runner.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { loadMigrations, getAppliedMigrations } from '../run-migrations';

describe('Migration Runner', () => {
  beforeEach(() => {
    // Setup test database
  });

  it('should load migration files in correct order', async () => {
    const migrations = await loadMigrations();

    expect(migrations).toHaveLength(13);
    expect(migrations[0].version).toBe(1);
    expect(migrations[12].version).toBe(13);
  });

  it('should detect already applied migrations', async () => {
    const applied = await getAppliedMigrations();

    expect(applied.has(1)).toBe(true);
    expect(applied.has(999)).toBe(false);
  });

  it('should skip applied migrations', async () => {
    // Test logic
  });

  it('should rollback on failure', async () => {
    // Test rollback behavior
  });
});
```

**Example: Test localStorage → Supabase migration**

```typescript
// src/lib/__tests__/recordings-migration.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { migrateMyRecordingsFromBrowser } from '../recordings';

describe('Recordings Migration', () => {
  beforeEach(() => {
    // Clear localStorage
    localStorage.clear();

    // Mock Supabase
    vi.mock('../supabase', () => ({
      supabase: {
        from: vi.fn(() => ({
          insert: vi.fn(() => ({ select: vi.fn(), single: vi.fn() }))
        }))
      }
    }));
  });

  it('should migrate recordings from localStorage to Supabase', async () => {
    // Setup localStorage data
    const mockRecordings = [
      { id: '1', title: 'Test Recording', duration: 120 },
      { id: '2', title: 'Another Recording', duration: 180 }
    ];
    localStorage.setItem('recordings_user123', JSON.stringify(mockRecordings));

    // Run migration
    const result = await migrateMyRecordingsFromBrowser('user123');

    // Verify
    expect(result.success).toBe(true);
    expect(result.count).toBe(2);
    expect(result.errors).toBe(0);
  });

  it('should handle migration errors gracefully', async () => {
    // Mock Supabase to fail
    // Test error handling
  });

  it('should not lose data on partial failure', async () => {
    // Test rollback behavior
  });
});
```

### 2. Integration Tests

```typescript
// src/__tests__/integration/requests-flow.test.ts
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../App';

describe('Request Creation Flow', () => {
  it('should create a request end-to-end', async () => {
    render(<App />);

    // Login
    await userEvent.click(screen.getByText('Login'));
    await userEvent.type(screen.getByLabelText('Email'), 'test@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.click(screen.getByText('Sign In'));

    // Navigate to requests
    await waitFor(() => screen.getByText('My Requests'));
    await userEvent.click(screen.getByText('My Requests'));

    // Create new request
    await userEvent.click(screen.getByText('New Request'));
    await userEvent.click(screen.getByText('Pricing'));

    // Fill form
    await userEvent.type(screen.getByLabelText('Title'), 'Test Request');
    await userEvent.type(screen.getByLabelText('Customer Name'), 'John Doe');
    await userEvent.click(screen.getByText('Submit'));

    // Verify request created
    await waitFor(() => {
      expect(screen.getByText('Test Request')).toBeInTheDocument();
    });
  });
});
```

### 3. E2E Tests (Playwright)

```bash
npm install -D @playwright/test
npx playwright install
```

```typescript
// e2e/critical-flows.spec.ts
import { test, expect } from '@playwright/test';

test('user can create and view requests', async ({ page }) => {
  // Login
  await page.goto('http://localhost:5173');
  await page.click('text=Login');
  await page.fill('input[type="email"]', 'test@example.com');
  await page.fill('input[type="password"]', 'password123');
  await page.click('button:has-text("Sign In")');

  // Wait for dashboard
  await page.waitForSelector('text=My Requests');

  // Create request
  await page.click('text=New Request');
  await page.click('text=Pricing');
  await page.fill('input[name="title"]', 'Test Request E2E');
  await page.fill('input[name="customerName"]', 'John Doe');
  await page.click('button:has-text("Submit")');

  // Verify in list
  await expect(page.locator('text=Test Request E2E')).toBeVisible();

  // Take screenshot for visual comparison
  await page.screenshot({ path: 'test-results/request-created.png' });
});

test('migration banner appears for users with localStorage data', async ({ page }) => {
  // Add localStorage data
  await page.goto('http://localhost:5173');
  await page.evaluate(() => {
    localStorage.setItem('recordings_test-user', JSON.stringify([
      { id: '1', title: 'Test Recording' }
    ]));
  });

  // Login
  await page.click('text=Login');
  // ... login flow ...

  // Navigate to Sales Coach
  await page.click('text=AI Sales Coach');

  // Verify migration banner appears
  await expect(page.locator('text=Migrate Your Recordings')).toBeVisible();

  // Click migrate
  await page.click('button:has-text("Migrate Now")');

  // Verify success message
  await expect(page.locator('text=Successfully migrated')).toBeVisible();
});
```

### Test Before Every Deploy

```json
// package.json
{
  "scripts": {
    "test": "vitest",
    "test:unit": "vitest run",
    "test:integration": "vitest run --config vitest.integration.config.ts",
    "test:e2e": "playwright test",
    "test:all": "npm run test:unit && npm run test:integration && npm run test:e2e",
    "predeploy": "npm run test:all && npm run build"
  }
}
```

---

## Deployment Pipeline

### Automated CI/CD with GitHub Actions

**Create `.github/workflows/ci.yml`:**

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Run type check
        run: npm run type-check

      - name: Run unit tests
        run: npm run test:unit

      - name: Run integration tests
        run: npm run test:integration

      - name: Build
        run: npm run build

      - name: Upload build artifacts
        uses: actions/upload-artifact@v3
        with:
          name: dist
          path: dist/

  e2e-test:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/

  deploy-staging:
    needs: [test, e2e-test]
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Deploy to Netlify (Staging)
        uses: netlify/actions/cli@master
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_STAGING_SITE_ID }}
        with:
          args: deploy --prod

  deploy-production:
    needs: [test, e2e-test]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://your-app.com
    steps:
      - uses: actions/checkout@v3

      - name: Deploy to Netlify (Production)
        uses: netlify/actions/cli@master
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_PRODUCTION_SITE_ID }}
        with:
          args: deploy --prod

      - name: Create GitHub Release
        if: startsWith(github.ref, 'refs/tags/')
        uses: actions/create-release@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: ${{ github.ref }}
          release_name: Release ${{ github.ref }}
          draft: false
          prerelease: false
```

### Manual Deployment Checklist

**Before Each Production Deployment:**

```markdown
## Pre-Deployment Checklist

### Database
- [ ] Database backup created and verified
- [ ] Migration tested on staging
- [ ] Rollback procedure documented
- [ ] Migration dry-run successful

### Code
- [ ] All tests passing (unit, integration, E2E)
- [ ] No TypeScript errors
- [ ] No console.log or debug code
- [ ] Build successful
- [ ] Bundle size checked (not significantly larger)

### Testing
- [ ] Feature tested on staging for 24+ hours
- [ ] No errors in staging logs
- [ ] Performance acceptable
- [ ] Mobile tested
- [ ] Desktop tested

### Communication
- [ ] Team notified of deployment
- [ ] Users notified if breaking changes
- [ ] Deployment time scheduled (low traffic)
- [ ] On-call engineer identified

### Monitoring
- [ ] Sentry/error tracking ready
- [ ] Analytics tracking verified
- [ ] Performance monitoring active
- [ ] Database monitoring active

### Rollback Plan
- [ ] Previous version tagged in git
- [ ] Rollback procedure documented
- [ ] Database backup accessible
- [ ] Estimated rollback time: ___ minutes
```

---

## Rollback Procedures

### Application Rollback (Fast)

**Scenario:** New deployment has bugs

```bash
# Method 1: Netlify Dashboard (60 seconds)
# 1. Go to Netlify Dashboard
# 2. Click "Deploys"
# 3. Find previous working deployment
# 4. Click "Publish deploy"
# DONE! Instant rollback.

# Method 2: Git Revert (5 minutes)
git checkout main
git revert HEAD  # Revert last commit
git push origin main
# Netlify auto-deploys previous version

# Method 3: Redeploy Previous Tag (3 minutes)
git checkout v1.0.9  # Previous working version
git tag -d v1.1.0    # Remove bad tag
git push origin :refs/tags/v1.1.0
git tag v1.1.0       # Re-tag this version
git push origin v1.1.0
```

### Database Rollback (Slower, More Careful)

**Scenario:** Migration caused issues

```bash
# Step 1: Assess Impact (5 minutes)
# - How many users affected?
# - Is data corrupted or just inaccessible?
# - Can we fix forward or must rollback?

# Step 2: Stop Further Damage (2 minutes)
# - Rollback application to previous version
# - This stops using new schema

# Step 3: Database Rollback (15-30 minutes)

# Option A: Run Reverse Migration (if available)
supabase db reset --db-url $DATABASE_URL < migrations/011_rollback.sql

# Option B: Restore from Backup (longer but safer)
# 1. Create snapshot of current (broken) state
supabase db dump -f broken_state_backup.sql

# 2. Restore from pre-migration backup
supabase db reset --db-url $DATABASE_URL < backup_before_migration_011.sql

# 3. Verify restoration
psql $DATABASE_URL -c "SELECT COUNT(*) FROM requests;"
# Should match pre-migration count

# Step 4: Update Migration Tracking
psql $DATABASE_URL -c "DELETE FROM schema_migrations WHERE version = 11;"

# Step 5: Verify Application Works
# Test critical flows
```

### Partial Rollback (Feature Flag)

**Scenario:** New feature has bugs but rest is fine

```bash
# Fastest option: Disable feature flag
# No deployment needed!

# Update .env.production
VITE_FEATURE_SUPABASE_RECORDINGS=false

# Restart deployment
netlify env:set VITE_FEATURE_SUPABASE_RECORDINGS false
netlify deploy --prod

# Users immediately revert to old behavior
# Fix bug in feature branch
# Re-enable when fixed
```

---

## Monitoring & Alerts

### Error Tracking with Sentry

```bash
npm install @sentry/react @sentry/tracing
```

```typescript
// src/main.tsx
import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE, // 'development' | 'production'
  integrations: [new BrowserTracing()],
  tracesSampleRate: 1.0,

  beforeSend(event, hint) {
    // Don't send dev errors
    if (import.meta.env.DEV) return null;

    // Filter out known issues
    if (event.exception?.values?.[0]?.value?.includes('ResizeObserver')) {
      return null; // Ignore ResizeObserver errors
    }

    return event;
  }
});
```

### Performance Monitoring

```typescript
// src/lib/monitoring.ts
export function trackPerformance(metricName: string, value: number) {
  // Send to analytics
  if (window.gtag) {
    window.gtag('event', 'timing_complete', {
      name: metricName,
      value: Math.round(value),
      event_category: 'Performance'
    });
  }

  // Log slow operations
  if (value > 1000) {
    console.warn(`Slow operation: ${metricName} took ${value}ms`);
  }
}

// Usage
const start = performance.now();
await getRequests();
trackPerformance('requests_load_time', performance.now() - start);
```

### Database Monitoring

```sql
-- Create monitoring view
CREATE VIEW monitoring_slow_queries AS
SELECT
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
WHERE mean_time > 100  -- Queries averaging >100ms
ORDER BY mean_time DESC
LIMIT 20;

-- Check table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check connection count
SELECT
  count(*),
  state
FROM pg_stat_activity
GROUP BY state;
```

### Alerts Setup

```yaml
# .github/workflows/alerts.yml
name: Production Alerts

on:
  schedule:
    - cron: '*/5 * * * *'  # Every 5 minutes

jobs:
  check-health:
    runs-on: ubuntu-latest
    steps:
      - name: Check site availability
        run: |
          response=$(curl -s -o /dev/null -w "%{http_code}" https://your-app.com)
          if [ $response -ne 200 ]; then
            echo "Site down! Status: $response"
            # Send alert (Slack, email, etc.)
            exit 1
          fi

      - name: Check error rate (Sentry)
        run: |
          # Query Sentry API for error rate
          # Alert if > threshold
```

---

## Phase-by-Phase Safety Plans

### Phase 1: Migration Tracking & Sales Coach

#### Week 1: Migration Tracking

**Risk:** Low (new system, doesn't affect existing)

**Safety Plan:**
1. ✅ Create feature branch: `feature/phase-1-migration-tracking`
2. ✅ Develop & test locally
3. ✅ Test on dev database (separate from production)
4. ✅ Create PR to develop
5. ✅ Deploy to staging
6. ✅ Test for 2 days on staging
7. ✅ Merge to main only if stable
8. ✅ Monitor for 24 hours after production deploy

**Rollback:** Easy - just revert commit, no data changes

#### Week 2-3: Sales Coach Migration

**Risk:** HIGH (data migration)

**Safety Plan:**

**Day 1-2: Preparation**
- Create full database backup
- Document rollback procedure
- Test migration on copy of production data
- Create dual-write system

**Day 3-5: Staging Testing**
```bash
git checkout -b feature/phase-1-sales-coach-migration

# Implement dual-write system
# Deploy to staging
# Test thoroughly:
# - Create recording → check both localStorage and Supabase
# - Read recordings → verify fallback works
# - Migration tool → test with sample data
```

**Day 6-7: Canary Deploy**
```bash
# Enable for 10% of users
VITE_FEATURE_SUPABASE_RECORDINGS=true
VITE_ROLLOUT_PERCENTAGE=10

# Monitor:
# - Error rates
# - User feedback
# - Performance metrics
```

**Day 8-10: Gradual Rollout**
```bash
# Increase to 25%, then 50%, then 100%
# Each step: wait 24 hours, monitor
```

**Rollback Plan:**
- Disable feature flag (instant)
- OR deploy previous version (5 minutes)
- Data in localStorage unaffected
- Supabase data preserved for retry

### Phase 2: TeamCommunication Consolidation

**Risk:** MEDIUM (refactoring existing feature)

**Safety Plan:**

**Week 1: Preparation**
```bash
git checkout -b feature/phase-2-consolidate-team-comm

# DON'T delete old files yet!
# Create new unified component alongside old ones
# Use feature flag to toggle
```

**Week 2: Parallel Implementation**
```typescript
// Keep both versions
import TeamCommunicationLegacy from './components/team/TeamCommunication';
import TeamCommunicationNew from './features/team-communication';

export default function TeamCommunicationWrapper() {
  const useNew = isFeatureEnabled('NEW_TEAM_COMM');

  if (useNew) {
    return <TeamCommunicationNew />;
  }

  return <TeamCommunicationLegacy />;
}
```

**Week 3: Testing**
- Deploy to staging with NEW_TEAM_COMM=true
- Test all features:
  - [ ] Create conversation
  - [ ] Send message
  - [ ] Receive message (realtime)
  - [ ] Message history
  - [ ] Unread counts
  - [ ] Mobile view
  - [ ] Desktop view
- Compare screenshots old vs new
- Check for regressions

**Week 4: Gradual Rollout**
```bash
# Day 1: 10% of users
VITE_FEATURE_NEW_TEAM_COMM=true
VITE_ROLLOUT_PERCENTAGE=10

# Day 3: 25%
VITE_ROLLOUT_PERCENTAGE=25

# Day 5: 50%
VITE_ROLLOUT_PERCENTAGE=50

# Day 7: 100%
VITE_ROLLOUT_PERCENTAGE=100

# Day 10: Remove old code
# Only after 100% rollout is stable for 3+ days
git rm src/components/team/TeamCommunication*.tsx
```

**Rollback:**
- Set VITE_FEATURE_NEW_TEAM_COMM=false
- Old code still available
- No data loss (same database tables)

### Phase 3: React Query

**Risk:** MEDIUM-HIGH (changes data fetching pattern)

**Safety Plan:**

**Incremental Migration:**
```typescript
// Don't migrate everything at once!
// Start with one feature:

// Week 1: Migrate requests only
const { data } = useMyRequests(); // Uses React Query

// Weeks 2-3: Migrate messages, teams, etc.
// Week 4: Remove old hooks
```

**Testing:**
```typescript
// Test both paths in parallel
describe('Requests with React Query', () => {
  it('should fetch same data as old method', async () => {
    const oldData = await getMyRequestsOld();
    const { data: newData } = await useMyRequests();

    expect(newData).toEqual(oldData);
  });
});
```

---

## Summary: Is Your Concern Level Appropriate?

### ✅ YES! You're Being Appropriately Cautious

**Your concern is:**
- **Healthy** - Production systems deserve respect
- **Professional** - This is how senior engineers think
- **Necessary** - Prevents disaster scenarios

**Red flags would be:**
- "Let's ship it and see what happens"
- "We don't need branches"
- "Testing is optional"
- "Backups slow us down"

### Your Risk Mitigation Checklist

✅ **Git Strategy:** Feature branches + PR reviews + protected main
✅ **Database Safety:** Backups + dry runs + rollback plans
✅ **Gradual Rollout:** Feature flags + canary deploys + monitoring
✅ **Testing:** Unit + Integration + E2E tests
✅ **Monitoring:** Error tracking + performance metrics + alerts
✅ **Rollback Plans:** Multiple rollback strategies documented

### Recommended Approach

**For Each Phase:**

1. **Branch** → Create feature branch from develop
2. **Develop** → Write code + tests
3. **Test Locally** → All tests pass
4. **PR to Develop** → Code review
5. **Deploy to Staging** → Test thoroughly (24+ hours)
6. **Canary Deploy** → 10% of users
7. **Monitor** → Watch errors, performance
8. **Gradual Rollout** → 25% → 50% → 100%
9. **Stabilize** → Wait 3+ days at 100%
10. **Cleanup** → Remove old code, feature flags

**Timeline:**
- Phase 1: 2-3 weeks (includes safety buffer)
- Phase 2: 3-4 weeks (includes testing)
- Phase 3: 4-5 weeks (includes migration time)

**Total: 10-12 weeks** (vs 10 weeks without safety measures)

The extra 2 weeks is **insurance** against disasters. Worth it!

---

## Final Recommendation

**Start with Phase 1, Week 1: Migration Tracking**

This is:
- ✅ Low risk (new feature, not changing existing)
- ✅ High value (prevents future migration conflicts)
- ✅ Good practice run for git workflow
- ✅ Builds confidence for bigger changes

**Create your first feature branch today:**

```bash
git checkout develop
git pull origin develop
git checkout -b feature/phase-1-migration-tracking
# Start coding!
```

You're ready. Your caution is a strength, not a weakness! 🚀
