# Claude Code Prompt: Residential Division Analytics (FINAL)

## Overview

Build the **Residential Division** analytics dashboard focused on **conversion/win rates** with **project size filtering throughout**.

**Data Sources:** 3 CSV files
1. **Quotes** (PRIMARY) - 10,469 records → normalized to 7,759 opportunities
2. **Jobs** - 4,124 records (for scheduled/closed dates)
3. **Requests** - 10,299 records (ONLY for assessment date → speed-to-quote)

**Documentation:** `docs/05. Jobber analytics/RESIDENTIAL_PLAN_FINAL.md`
**Schema:** `docs/05. Jobber analytics/RESIDENTIAL_SCHEMA_FINAL.sql`

---

## 🚨 CRITICAL CONCEPTS

### 1. Opportunity Normalization
Multiple quotes can exist for the same project (different options, materials, heights).

**WRONG:** Count each quote as separate opportunity (10,469 → 30% win rate)
**CORRECT:** Normalize by Client + Address (7,759 → 35.5% win rate)

```typescript
function normalizeKey(clientName: string, address: string): string {
  const client = (clientName || '').toLowerCase().trim();
  const addr = (address || '').toLowerCase().trim().replace(/[.,]/g, '');
  return `${client}|${addr}`;
}
```

### 2. Speed to Quote Matters!
| Speed | Win Rate | Impact |
|-------|----------|--------|
| Same day | 35.3% | baseline |
| 1-3 days | 32.2% | -3.1% |
| 4-7 days | 29.1% | -6.2% |
| **8+ days** | **20.5%** | **-14.8%** |

### 3. Project Size Filter Everywhere
Every tab must support filtering by revenue bucket:
- $0-$1K, $1K-$2K, $2K-$5K, $5K-$10K, $10K-$25K, $25K-$50K, $50K+

---

## Import Service Implementation

### Step 1: Parse Quotes & Build Opportunities
```typescript
interface Opportunity {
  key: string;
  clientName: string;
  address: string;
  salesperson: string;
  quotes: Quote[];
  
  // Aggregated
  quoteCount: number;
  maxQuoteValue: number;
  totalQuotedValue: number;
  firstQuoteDate: Date;
  
  // Conversion
  isWon: boolean;
  isLost: boolean;
  isPending: boolean;
  wonValue: number;
  wonDate: Date | null;
  jobNumbers: string[];
  
  // From Requests
  assessmentDate: Date | null;
  daysToQuote: number | null;
  
  // From Jobs
  scheduledDate: Date | null;
  closedDate: Date | null;
}

function buildOpportunities(quotes: Quote[]): Map<string, Opportunity> {
  const opps = new Map<string, Opportunity>();
  
  for (const quote of quotes) {
    const key = normalizeKey(quote.clientName, quote.serviceStreet);
    
    if (!opps.has(key)) {
      opps.set(key, {
        key,
        clientName: quote.clientName,
        address: quote.serviceStreet,
        salesperson: quote.salesperson || '',
        quotes: [],
        // ... init other fields
      });
    }
    
    opps.get(key)!.quotes.push(quote);
  }
  
  // Calculate aggregates
  for (const opp of opps.values()) {
    calculateOpportunityMetrics(opp);
  }
  
  return opps;
}

function calculateOpportunityMetrics(opp: Opportunity): void {
  const quotes = opp.quotes;
  
  opp.quoteCount = quotes.length;
  opp.maxQuoteValue = Math.max(...quotes.map(q => q.total));
  opp.totalQuotedValue = quotes.reduce((sum, q) => sum + q.total, 0);
  
  const dates = quotes.map(q => q.draftedDate).filter(Boolean).sort();
  opp.firstQuoteDate = dates[0];
  
  // Conversion status
  const converted = quotes.filter(q => q.status === 'Converted');
  opp.isWon = converted.length > 0;
  opp.isLost = !opp.isWon && quotes.every(q => q.status === 'Archived');
  opp.isPending = !opp.isWon && !opp.isLost;
  
  if (opp.isWon) {
    opp.wonValue = converted.reduce((sum, q) => sum + q.total, 0);
    opp.wonDate = converted[0].convertedDate;
    opp.jobNumbers = converted.flatMap(q => 
      (q.jobNumbers || '').split(',').map(n => n.trim()).filter(Boolean)
    );
  }
}
```

### Step 2: Enrich with Assessment Date (from Requests)
```typescript
function enrichWithAssessmentDates(
  opps: Map<string, Opportunity>,
  requests: Request[],
  quoteMap: Map<string, Quote>
): void {
  // Build: Quote # → earliest assessment date
  const assessmentByQuote = new Map<string, Date>();
  
  for (const req of requests) {
    const assessDate = parseDate(req['Assessment date']);
    if (!assessDate) continue;
    
    const quoteNums = (req['Quote #s'] || '').split(',');
    for (const qn of quoteNums) {
      const num = qn.trim();
      if (num && (!assessmentByQuote.has(num) || assessDate < assessmentByQuote.get(num)!)) {
        assessmentByQuote.set(num, assessDate);
      }
    }
  }
  
  // Apply to opportunities
  for (const opp of opps.values()) {
    for (const quote of opp.quotes) {
      const assessDate = assessmentByQuote.get(quote.quoteNumber.toString());
      if (assessDate && (!opp.assessmentDate || assessDate < opp.assessmentDate)) {
        opp.assessmentDate = assessDate;
      }
    }
    
    // Calculate speed to quote
    if (opp.assessmentDate && opp.firstQuoteDate && opp.firstQuoteDate >= opp.assessmentDate) {
      opp.daysToQuote = diffDays(opp.firstQuoteDate, opp.assessmentDate);
    }
  }
}
```

### Step 3: Enrich with Job Dates
```typescript
function enrichWithJobDates(
  opps: Map<string, Opportunity>,
  jobs: Job[]
): void {
  const jobMap = new Map(jobs.map(j => [j.jobNumber.toString(), j]));
  
  for (const opp of opps.values()) {
    if (!opp.isWon || !opp.jobNumbers.length) continue;
    
    for (const jobNum of opp.jobNumbers) {
      const job = jobMap.get(jobNum);
      if (job) {
        opp.scheduledDate = parseDate(job.scheduledStartDate);
        opp.closedDate = parseDate(job.closedDate);
        opp.actualRevenue = job.totalRevenue;
        break; // Take first job's dates
      }
    }
  }
}
```

---

## Dashboard Tabs (7 Total)

### Tab 1: Conversion Funnel (Default)
**Cards:** Opportunities, Won, Lost, Pending, Win%, Won$, Value Win%, Avg Days to Quote
**Funnel Chart:** Visual funnel
**Monthly Trend:** Line chart

### Tab 2: Salesperson Performance
**Leaderboard Table** - sortable by all columns:
- Salesperson, Opps, Won, Win%, Closed%, Won$, Avg Won, Avg Days to Quote
**Click row → Detail modal**

### Tab 3: Project Size Analysis
**Win Rate by Size Table**
**Salesperson × Size Heat Map**
**Bar chart showing inverse relationship**

### Tab 4: Speed to Quote Analysis ⭐
**Win Rate by Speed Table** with baseline diff column
**Speed × Size Cross-Tab**
**Alert:** "X quotes took 8+ days - $Y at risk"
**Salesperson Speed Ranking**

### Tab 5: Quote Options Analysis
**Win Rate by # of Quotes** (1, 2, 3, 4+)
**Insight:** More options = higher win rate

### Tab 6: Win Rate Trends (Monthly Matrix)
**Salesperson × Month pivot table**
**Monthly totals trend line**
**Color-coded heat map**

### Tab 7: Cycle Time
**Stage breakdown:** Assessment→Quote, Quote→Decision, Decision→Scheduled, Scheduled→Closed
**Distribution charts**

---

## Global Filters (ALL TABS)

```typescript
interface Filters {
  dateRange: { start: Date; end: Date } | 'last30' | 'last90' | 'ytd';
  salesperson: string | null;
  revenueBucket: string | null;  // ALWAYS AVAILABLE
  speedBucket: string | null;
  quoteCountBucket: string | null;
}
```

---

## Component Structure

```
src/features/analytics/components/jobber/residential/
├── ResidentialDashboard.tsx
├── ResidentialFilters.tsx           # Global filters including project size
├── ConversionFunnel/
│   ├── FunnelCards.tsx
│   ├── FunnelChart.tsx
│   └── MonthlyTrend.tsx
├── SalespersonPerformance/
│   ├── Leaderboard.tsx
│   └── DetailModal.tsx
├── ProjectSizeAnalysis/
│   ├── SizeTable.tsx
│   ├── SizeChart.tsx
│   └── SalespersonSizeMatrix.tsx
├── SpeedToQuote/                     # NEW
│   ├── SpeedTable.tsx
│   ├── SpeedSizeMatrix.tsx
│   ├── SpeedAlert.tsx
│   └── SalespersonSpeedRanking.tsx
├── QuoteOptions/
│   ├── QuoteCountTable.tsx
│   └── InsightCard.tsx
├── WinRateTrends/
│   ├── MonthlyMatrix.tsx
│   └── TrendChart.tsx
└── CycleTime/
    ├── StageBreakdown.tsx
    └── DistributionCharts.tsx
```

---

## Validation Checklist

After implementation, verify:

- [ ] **7,759 opportunities** (normalized from 10,469 quotes)
- [ ] **35.5% overall win rate**
- [ ] **Speed to quote:**
  - Same day: 35.3%
  - 8+ days: 20.5%
- [ ] **Project size filter works on ALL tabs**
- [ ] **Monthly matrix matches** (Feb-Jan data)
- [ ] **All computed columns populate:**
  - `days_to_quote`
  - `speed_to_quote_bucket`
  - `revenue_bucket`
  - `quote_count_bucket`
  - `days_to_close`

---

## Key Insights to Surface in UI

1. **Speed Alert:** "Quoting same-day has 35% win rate vs 20% for 8+ days"
2. **Options Insight:** "Providing 2+ quote options increases win rate by 9-31%"
3. **Size Trend:** "Larger projects have lower win rates ($50K+ = 18%)"
4. **Declining Trend:** "Win rate dropped from 44% (Mar) to 13% (Jan)"

---

**Start by reading the plan document, then run the schema migration, then build the import service with normalization logic.**
