# Residential Division Analytics - REVISED PLAN (Simplified)

## Data Sources (3 Files)

| File | Purpose | Records |
|------|---------|---------|
| **Quotes** | PRIMARY - Opportunities, conversion, values | 10,469 |
| **Jobs** | Scheduled/Closed dates, actual revenue, crew | 4,124 |
| **Requests** | Assessment date only (for speed-to-quote) | 10,299 |

---

## Key Metrics Overview

| Metric | Value |
|--------|-------|
| Total Opportunities | 7,759 (normalized) |
| Won | 2,754 (35.5%) |
| Lost | 855 (11.0%) |
| Pending | 4,150 (53.5%) |
| Won Value | $16.3M |
| Value Win Rate | 25.5% |

---

## 🚨 KEY INSIGHT: Speed to Quote Matters!

| Speed to Quote | Win Rate | Impact |
|----------------|----------|--------|
| Same day | **35.3%** | Baseline |
| 1-3 days | 32.1% | -3.2% |
| 4-7 days | 29.1% | -6.2% |
| 8+ days | **20.5%** | **-14.8%** |

**Action:** Track and alert when quotes take >3 days from assessment.

---

## Database Schema (Simplified)

### Table 1: `jobber_residential_opportunities` (PRIMARY)
```sql
CREATE TABLE jobber_residential_opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_key TEXT NOT NULL UNIQUE,
    
    -- Client & Address (normalized)
    client_name TEXT,
    client_name_normalized TEXT,
    service_street TEXT,
    service_street_normalized TEXT,
    service_city TEXT,
    service_state TEXT,
    service_zip TEXT,
    
    -- Assignment
    salesperson TEXT,
    
    -- Quote Aggregations
    quote_count INTEGER DEFAULT 1,
    quote_numbers TEXT,
    first_quote_date DATE,
    last_quote_date DATE,
    
    -- Values
    max_quote_value DECIMAL(12,2) DEFAULT 0,  -- "Project Size"
    total_quoted_value DECIMAL(12,2) DEFAULT 0,
    won_value DECIMAL(12,2) DEFAULT 0,
    
    -- Conversion Status
    is_won BOOLEAN DEFAULT FALSE,
    is_lost BOOLEAN DEFAULT FALSE,
    is_pending BOOLEAN DEFAULT TRUE,
    won_date DATE,
    won_quote_numbers TEXT,
    job_numbers TEXT,
    
    -- From Jobs (if won)
    scheduled_date DATE,
    closed_date DATE,
    actual_revenue DECIMAL(12,2),
    
    -- From Requests (for speed-to-quote)
    assessment_date DATE,
    
    -- Computed: Speed to Quote
    days_to_quote INTEGER GENERATED ALWAYS AS (
        CASE WHEN first_quote_date IS NOT NULL AND assessment_date IS NOT NULL 
             THEN first_quote_date - assessment_date ELSE NULL END
    ) STORED,
    
    speed_to_quote_bucket TEXT GENERATED ALWAYS AS (
        CASE 
            WHEN first_quote_date IS NULL OR assessment_date IS NULL THEN NULL
            WHEN first_quote_date - assessment_date = 0 THEN 'Same day'
            WHEN first_quote_date - assessment_date <= 3 THEN '1-3 days'
            WHEN first_quote_date - assessment_date <= 7 THEN '4-7 days'
            ELSE '8+ days'
        END
    ) STORED,
    
    -- Computed: Project Size Bucket
    revenue_bucket TEXT GENERATED ALWAYS AS (
        CASE 
            WHEN max_quote_value < 1000 THEN '$0-$1K'
            WHEN max_quote_value < 2000 THEN '$1K-$2K'
            WHEN max_quote_value < 5000 THEN '$2K-$5K'
            WHEN max_quote_value < 10000 THEN '$5K-$10K'
            WHEN max_quote_value < 25000 THEN '$10K-$25K'
            WHEN max_quote_value < 50000 THEN '$25K-$50K'
            ELSE '$50K+'
        END
    ) STORED,
    
    -- Computed: Quote Count Bucket
    quote_count_bucket TEXT GENERATED ALWAYS AS (
        CASE 
            WHEN quote_count = 1 THEN '1 quote'
            WHEN quote_count = 2 THEN '2 quotes'
            WHEN quote_count = 3 THEN '3 quotes'
            ELSE '4+ quotes'
        END
    ) STORED,
    
    -- Computed: Days to Close (quote → job closed)
    days_to_close INTEGER GENERATED ALWAYS AS (
        CASE WHEN closed_date IS NOT NULL AND first_quote_date IS NOT NULL 
             THEN closed_date - first_quote_date ELSE NULL END
    ) STORED,
    
    -- Import tracking
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table 2: `jobber_residential_quotes` (Raw)
Store individual quotes linked to opportunities.

### Table 3: `jobber_residential_jobs` (Optional Detail)
Store job details for won opportunities.

---

## Import Logic

### Step 1: Load Quotes → Build Opportunities
```typescript
// Group quotes by normalized client + address
const opportunities = new Map<string, Opportunity>();

for (const quote of quotes) {
  const key = normalizeKey(quote.clientName, quote.serviceStreet);
  
  if (!opportunities.has(key)) {
    opportunities.set(key, createOpportunity(quote));
  }
  
  opportunities.get(key).quotes.push(quote);
}
```

### Step 2: Enrich with Requests (Assessment Date)
```typescript
// Build lookup: Quote # → Request assessment date
const assessmentDates = new Map<string, Date>();

for (const request of requests) {
  const quoteNums = request['Quote #s']?.split(',') || [];
  const assessmentDate = parseDate(request['Assessment date']);
  
  for (const qn of quoteNums) {
    if (assessmentDate) {
      assessmentDates.set(qn.trim(), assessmentDate);
    }
  }
}

// Apply to opportunities
for (const opp of opportunities.values()) {
  for (const quote of opp.quotes) {
    const assessDate = assessmentDates.get(quote.quoteNumber);
    if (assessDate && (!opp.assessmentDate || assessDate < opp.assessmentDate)) {
      opp.assessmentDate = assessDate;
    }
  }
}
```

### Step 3: Enrich with Jobs (Scheduled/Closed)
```typescript
// Build lookup: Job # → Job details
const jobDetails = new Map<string, Job>();

for (const job of jobs) {
  jobDetails.set(job['Job #'], job);
}

// Apply to won opportunities
for (const opp of opportunities.values()) {
  if (opp.isWon && opp.jobNumbers) {
    for (const jobNum of opp.jobNumbers) {
      const job = jobDetails.get(jobNum);
      if (job) {
        opp.scheduledDate = parseDate(job['Scheduled start date']);
        opp.closedDate = parseDate(job['Closed date']);
        opp.actualRevenue = parseCurrency(job['Total revenue ($)']);
      }
    }
  }
}
```

---

## Dashboard Tabs (7 Total)

### Tab 1: Conversion Funnel (Default)
**Summary Cards:**
- Total Opportunities
- Won / Win Rate
- Lost / Lost Rate  
- Pending
- Won Value
- Value Win Rate
- Avg Days to Quote
- Avg Days to Close

**Funnel Chart:** Opportunities → Quoted → Won

**Filter by:** Date Range, Salesperson, **Project Size**

---

### Tab 2: Salesperson Performance
**Leaderboard Table:**
| Salesperson | Opps | Won | Win% | Closed% | Won$ | Avg Won | Avg Days to Quote |
|-------------|------|-----|------|---------|------|---------|-------------------|

**Sortable by all columns**

**Click row → Detail view** with monthly trend

**Filter by:** Date Range, **Project Size**

---

### Tab 3: Project Size Analysis
**Win Rate by Size:**
| Size | Opps | Won | Win% | Value |
|------|------|-----|------|-------|
| $0-$1K | 729 | 348 | 47.7% | $202K |
| $1K-$2K | 1,000 | 417 | 41.7% | $655K |
| ... | | | | |

**Salesperson × Size Matrix** (heat map)

**Filter by:** Date Range, Salesperson, Speed to Quote

---

### Tab 4: Speed to Quote Analysis ⭐ NEW
**Win Rate by Speed:**
| Speed | Opps | Won | Win% | Impact |
|-------|------|-----|------|--------|
| Same day | 4,250 | 1,499 | 35.3% | baseline |
| 1-3 days | 1,163 | 374 | 32.2% | -3.1% |
| 4-7 days | 444 | 129 | 29.1% | -6.2% |
| 8+ days | 210 | 43 | 20.5% | **-14.8%** |

**Speed × Project Size Cross-Tab**

**Alert Card:** "X quotes took 8+ days this month - potential $Y at risk"

**Salesperson Speed Ranking:** Who quotes fastest?

**Filter by:** Date Range, Salesperson, **Project Size**

---

### Tab 5: Quote Options Analysis
**Win Rate by # of Quotes:**
| # Quotes | Opps | Win% |
|----------|------|------|
| 1 | 5,908 | 32.5% |
| 2 | 1,305 | 41.5% |
| 3 | 371 | 47.7% |
| 4+ | 175 | 64.0% |

**Insight:** Offering multiple options increases win rate

**Filter by:** Date Range, Salesperson, **Project Size**

---

### Tab 6: Win Rate Trends (Monthly Matrix)
**Salesperson × Month Matrix:**
| Salesperson | Feb | Mar | Apr | ... | Jan | AVG |
|-------------|-----|-----|-----|-----|-----|-----|
| Oscar S. | 56% | 60% | 33% | ... | 0% | 35% |

**Monthly Totals Chart:** Trend line showing decline

**Filter by:** **Project Size**, Salesperson

---

### Tab 7: Cycle Time
**Full Cycle Breakdown:**
- Assessment → Quote (speed to quote)
- Quote → Decision (sales cycle)
- Decision → Scheduled (backlog)
- Scheduled → Closed (execution)

**Distribution Charts** for each stage

**Filter by:** Date Range, Salesperson, **Project Size**

---

## Global Filters (Available on ALL Tabs)

| Filter | Options |
|--------|---------|
| **Date Range** | Last 30/60/90/180/365 days, YTD, Custom |
| **Salesperson** | Multi-select dropdown |
| **Project Size** | $0-$1K, $1K-$2K, $2K-$5K, $5K-$10K, $10K-$25K, $25K-$50K, $50K+ |
| **Speed to Quote** | Same day, 1-3 days, 4-7 days, 8+ days |
| **Quote Count** | 1, 2, 3, 4+ |

---

## PostgreSQL Functions

### Core Metrics
```sql
-- Main funnel with all filters
get_residential_funnel_metrics(
    p_start_date, p_end_date, p_salesperson, 
    p_revenue_bucket, p_speed_bucket
)

-- Salesperson performance
get_residential_salesperson_metrics(
    p_start_date, p_end_date, p_revenue_bucket
)

-- Project size breakdown
get_residential_bucket_metrics(
    p_start_date, p_end_date, p_salesperson, p_speed_bucket
)

-- Speed to quote analysis
get_residential_speed_metrics(
    p_start_date, p_end_date, p_salesperson, p_revenue_bucket
)

-- Speed × Size cross-tab
get_residential_speed_by_size_matrix(
    p_start_date, p_end_date, p_salesperson
)

-- Monthly trend by salesperson
get_residential_salesperson_monthly_winrate(
    p_months, p_revenue_bucket
)
```

---

## Success Criteria

- [ ] 7,759 opportunities (normalized from 10,469 quotes)
- [ ] Win rate shows 35.5%
- [ ] Speed-to-quote shows same-day at 35.3%, 8+ days at 20.5%
- [ ] Project size filter works on all tabs
- [ ] All computed columns populate correctly
- [ ] Monthly matrix matches analysis data

---

## File Summary

| Deliverable | Purpose |
|-------------|---------|
| This document | Planning & spec |
| `RESIDENTIAL_SCHEMA_FINAL.sql` | Database migration |
| `CLAUDE_CODE_PROMPT_RESIDENTIAL_FINAL.md` | Implementation prompt |

---

## Key Business Insights to Surface

1. **Speed Matters:** Same-day quote = +15% win rate vs 8+ days
2. **Options Win:** Multiple quotes per opportunity = higher close rate
3. **Size Inverse:** Larger projects have lower win rates
4. **Declining Trend:** Win rate dropped from 44% (Mar) to 13% (Jan)
5. **Top Performers:** Hemi Thompson (66%), Paul Contreras (40%), Matt Schaefer (38%)
