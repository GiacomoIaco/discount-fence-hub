# Shared Components Specification - FSM Architecture Overhaul

## Overview

This document specifies the shared components that will be used across Quote, Job, and Invoice pages. Each component is designed to be reusable while supporting entity-specific customization.

---

## Component 1: EntityHeader

**Purpose**: Display entity identification, status, timestamps, and navigation breadcrumb.

### Visual Design

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Back to Quotes                                    [View Project →]   │
│                                                                         │
│  📄 QUOTE                                                               │
│  QUO-2024-001234                                         🟡 Draft      │
│                                                                         │
│  Client: ABC Builders                                                   │
│  Created Dec 15, 2024 • Last updated 2 hours ago                       │
│                                                                         │
│  Linked: Request REQ-001 →                                             │
└─────────────────────────────────────────────────────────────────────────┘
```

### Props

```typescript
interface EntityHeaderProps {
  entityType: 'request' | 'quote' | 'job' | 'invoice';
  entityNumber?: string;
  status?: string;
  statusColor?: string;
  isNew: boolean;
  createdAt?: string;
  updatedAt?: string;
  clientName?: string;
  projectId?: string;
  projectNumber?: string;
  linkedEntities?: {
    request?: { id: string; number: string };
    quote?: { id: string; number: string };
    job?: { id: string; number: string };
  };
  onBack: () => void;
  onNavigateToProject?: () => void;
  onNavigateToLinkedEntity?: (type: string, id: string) => void;
}
```

### Implementation Notes

1. **Icon by entity type**: Use different icons for each entity (ClipboardList for Request, FileText for Quote, Hammer for Job, Receipt for Invoice)
2. **Status badge**: Use the existing status color maps from types.ts
3. **Relative time**: Use a library like `date-fns` for "2 hours ago" formatting
4. **Linked entities**: Show as clickable chips that navigate to the linked entity

### Example Usage

```tsx
<EntityHeader
  entityType="quote"
  entityNumber={quote.quote_number}
  status={quote.status}
  statusColor={QUOTE_STATUS_COLORS[quote.status]}
  isNew={!quoteId}
  createdAt={quote.created_at}
  updatedAt={quote.updated_at}
  clientName={quote.client?.name}
  projectId={quote.project_id}
  projectNumber={quote.project?.project_number}
  linkedEntities={{
    request: quote.request ? { id: quote.request.id, number: quote.request.request_number } : undefined
  }}
  onBack={() => navigate('/quotes')}
  onNavigateToProject={() => navigate(`/projects/${quote.project_id}`)}
/>
```

---

## Component 2: ClientPropertySection

**Purpose**: Handle client selection, community/property selection (for builders), and job address.

### Visual Design

```
┌─────────────────────────────────────────────────────────────────────────┐
│ CLIENT & LOCATION                                                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ Client                              Community (optional)                │
│ ┌─────────────────────────────┐    ┌─────────────────────────────────┐ │
│ │ 🏢 ABC Builders         ▾  │    │ 📍 Oakwood Estates            ▾ │ │
│ └─────────────────────────────┘    └─────────────────────────────────┘ │
│                                                                         │
│ Property (optional)                                                     │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ 🏠 Lot 42 - 123 Oak Lane                                          ▾ │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│ Job Address                                    [📍 Use Property Address] │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ Street: [123 Main Street                                          ] │ │
│ │ City:   [Austin              ]  State: [TX]  Zip: [78701         ] │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Features

1. **Universal client search**: Search by name, phone, or email simultaneously
2. **Community filter**: When client is selected, filter communities to those the client is associated with
3. **Property filter**: When community is selected, filter properties to that community
4. **Auto-fill address**: "Use Property Address" button copies property address to job address
5. **Address autocomplete**: Integrate with Radar.io for address suggestions

### Props

```typescript
interface ClientPropertySectionProps {
  clientId?: string;
  communityId?: string;
  propertyId?: string;
  jobAddress?: Address;
  billingAddress?: Address;
  
  onClientChange: (clientId: string, client?: Client) => void;
  onCommunityChange?: (communityId: string | null) => void;
  onPropertyChange?: (propertyId: string | null, property?: Property) => void;
  onJobAddressChange: (address: Address) => void;
  
  showCommunityProperty?: boolean;  // Default true for builder division
  showBillingAddress?: boolean;     // True for invoices
  readOnly?: boolean;
  clientReadOnly?: boolean;
}
```

### Implementation Notes

1. **Client picker**: Use existing universal search pattern from Client Hub
2. **Cascading selects**: Community → Property should filter based on selection
3. **Clear downstream**: When client changes, clear community and property
4. **Validation**: Show validation errors inline (e.g., "Client is required")

---

## Component 3: LineItemsEditor

**Purpose**: Add, edit, remove, and reorder line items with pricing calculations.

### Visual Design

```
┌─────────────────────────────────────────────────────────────────────────┐
│ LINE ITEMS                                              [+ Add from BOM] │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ ≡  🪵 6ft Cedar Privacy Fence                           [Edit] [×] │ │
│ │    SKU: WOOD-PRIV-6                                                │ │
│ │    Qty: [200    ] LF  ×  $[20.00  ]/LF  =  $4,000.00              │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ ≡  🚪 6ft Cedar Walk Gate                               [Edit] [×] │ │
│ │    SKU: GATE-WALK-6                                                │ │
│ │    Qty: [1      ] ea  ×  $[400.00 ]/ea  =  $400.00                │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐ │
│   + Add Line Item                                                     │ │
│ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘ │
│                                                                         │
│ [+ Add Line Item]  [+ Add from Products]  [+ Add from BOM]             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Features

1. **Drag to reorder**: Use dnd-kit for drag and drop reordering
2. **Inline editing**: Quantity and price editable inline
3. **Product picker**: Modal to select from Products & Services list
4. **BOM integration**: "Add from BOM" opens BOM Calculator selection
5. **Custom line items**: Allow adding items not in product list
6. **Auto-calculate**: Total = qty × unit_price, auto-updates on change

### Props

```typescript
interface LineItemsEditorProps {
  items: LineItem[];
  onItemsChange: (items: LineItem[]) => void;
  readOnly?: boolean;
  allowCustomItems?: boolean;
  showBOMLink?: boolean;
  maxItems?: number;
  
  // For computing totals
  taxRate?: number;
  onSubtotalChange?: (subtotal: number) => void;
}
```

### Line Item Actions

| Action | Behavior |
|--------|----------|
| Add from Products | Opens product picker modal |
| Add from BOM | Opens BOM line item selector |
| Add Custom | Adds empty row for manual entry |
| Edit | Expands row to show all editable fields |
| Delete | Removes row (with confirmation if has data) |
| Drag | Reorders items, updates sort_order |

### Implementation Notes

1. **Optimistic updates**: Update local state immediately, sync to server
2. **Debounced saves**: Don't save on every keystroke
3. **Validation**: Quantity > 0, price ≥ 0
4. **Format currency**: Use Intl.NumberFormat for display

---

## Component 4: TotalsDisplay

**Purpose**: Show subtotal, tax, discount, and total with optional payment summary.

### Visual Design (Standard)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│                                         Subtotal:      $4,400.00       │
│                                         Discount:        -$200.00       │
│                                         Tax (8.25%):      $346.50       │
│                                         ─────────────────────────       │
│                                         Total:         $4,546.50       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Visual Design (With Payment Summary - Invoice)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│                                         Subtotal:      $4,400.00       │
│                                         Tax (8.25%):      $346.50       │
│                                         ─────────────────────────       │
│                                         Total:         $4,546.50       │
│                                                                         │
│                                         Amount Paid:   -$2,000.00       │
│                                         ═════════════════════════       │
│                                         Balance Due:   $2,546.50       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Visual Design (With Budget Comparison - Job)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ BUDGET vs ACTUAL                                                        │
├─────────────────────────────────────────────────────────────────────────┤
│                            Budget        Actual        Variance         │
│                                                                         │
│ Labor (8 hrs budgeted)     $1,200        $1,650       ⚠️ -$450         │
│ Materials                   $2,000        $2,050          -$50         │
│ ───────────────────────────────────────────────────────────────────     │
│ Total Cost                  $3,200        $3,700       ⚠️ -$500        │
│                                                                         │
│ Quoted Price                              $5,000                        │
│ Gross Profit                              $1,300       (26%)            │
│                                                                         │
│ ⚠️ Rework Cost Included: $300                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

### Props

```typescript
interface TotalsDisplayProps {
  subtotal: number;
  discountAmount?: number;
  discountPercent?: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  
  // Invoice-specific
  amountPaid?: number;
  balanceDue?: number;
  showPaymentSummary?: boolean;
  
  // Job-specific
  budgetComparison?: JobBudgetSummary;
  showBudgetComparison?: boolean;
  
  // Display
  compact?: boolean;
  className?: string;
}
```

---

## Component 5: NotesAttachments

**Purpose**: Internal notes and file attachments.

### Visual Design

```
┌─────────────────────────────────────────────────────────────────────────┐
│ NOTES & ATTACHMENTS                                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ Internal Notes                                                          │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ Customer prefers morning appointments. Gate code is 1234.          │ │
│ │                                                                     │ │
│ │                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│ Attachments                                                 [+ Upload]  │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ 📷 site_photo_1.jpg (2.3 MB)                              [View][×] │ │
│ │ 📄 property_survey.pdf (1.1 MB)                           [View][×] │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Props

```typescript
interface NotesAttachmentsProps {
  notes: string;
  onNotesChange: (notes: string) => void;
  
  attachments?: Attachment[];
  onAttachmentsChange?: (attachments: Attachment[]) => void;
  
  readOnly?: boolean;
  notesPlaceholder?: string;
  notesLabel?: string;  // "Internal Notes", "Instructions", etc.
  maxAttachments?: number;
  allowedFileTypes?: string[];
}

interface Attachment {
  id: string;
  filename: string;
  size: number;
  mime_type: string;
  url: string;
  uploaded_at: string;
}
```

---

## Component 6: EntityActionBar

**Purpose**: Context-aware action buttons based on entity type and status.

### Visual Design

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  [🗑️ Delete]                      [Cancel]  [Save Draft]  [✉️ Send]    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Status-Based Actions

| Entity | Status | Primary Action | Secondary Actions |
|--------|--------|----------------|-------------------|
| Quote | draft | Send to Client | Save Draft |
| Quote | sent | Mark as Won | Mark as Lost, Edit |
| Quote | approved | Convert to Job | Edit |
| Quote | converted | (none) | View Job |
| Job | won | Schedule | Edit |
| Job | scheduled | Start Job | Reschedule, Edit |
| Job | in_progress | Complete Job | Add Visit |
| Job | completed | Create Invoice | Add Visit |
| Invoice | draft | Send Invoice | Save Draft |
| Invoice | sent | Record Payment | Send Reminder |
| Invoice | paid | (none) | Download PDF |

### Props

```typescript
interface EntityActionBarProps {
  entityType: EntityType;
  status: string;
  isNew: boolean;
  isDirty: boolean;
  
  // Core actions
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
  
  // Status-specific actions
  onSend?: () => void;
  onConvert?: () => void;
  onSchedule?: () => void;
  onComplete?: () => void;
  onRecordPayment?: () => void;
  
  // State
  isSaving?: boolean;
  isDeleting?: boolean;
  
  // Options
  showDelete?: boolean;
  saveLabel?: string;
  position?: 'bottom' | 'sticky-bottom';
}
```

### Implementation Notes

1. **Sticky positioning**: Action bar sticks to bottom on scroll
2. **Disabled states**: Save disabled if not dirty, actions disabled during saving
3. **Confirmation dialogs**: Delete and destructive actions show confirmation
4. **Keyboard shortcuts**: Cmd+S to save, Escape to cancel

---

## Component 7: SchedulingSection (Job-specific)

**Purpose**: Date/time picker and crew assignment for jobs.

### Visual Design

```
┌─────────────────────────────────────────────────────────────────────────┐
│ SCHEDULING                                          [📅 View Calendar]  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ Scheduled Date              Time                    Duration            │
│ ┌─────────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│ │ 📅 Dec 20, 2024     │    │ ⏰ 8:00 AM      │    │ ~4 hours        │  │
│ └─────────────────────┘    └─────────────────┘    └─────────────────┘  │
│                                                                         │
│ Assigned Crew                                                           │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ 👥 Austin Crew Alpha (ATX-CREW-01)                              ▾  │ │
│ │    Territory: Austin North • 3 members • Available                 │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│ ⚠️ Crew has 2 other jobs scheduled for this date                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Features

1. **Date picker**: Calendar with availability hints
2. **Crew selector**: Filter by territory, show availability
3. **Conflict warning**: Alert if crew is overbooked
4. **Duration estimate**: Based on budgeted hours from quote

### Props

```typescript
interface SchedulingSectionProps {
  scheduledDate?: string;
  scheduledTime?: string;
  assignedCrewId?: string;
  estimatedDuration?: number;
  
  onScheduleChange: (data: {
    scheduledDate: string;
    scheduledTime?: string;
    assignedCrewId: string;
  }) => void;
  
  readOnly?: boolean;
  territoryId?: string;
  showCalendarLink?: boolean;
  showCrewAvailability?: boolean;
}
```

---

## Component 8: VisitsTimeline (Job-specific)

**Purpose**: Display and manage job visits with rework tracking.

### Visual Design

```
┌─────────────────────────────────────────────────────────────────────────┐
│ VISITS                                               [+ Add Visit ▾]    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ ✅ Visit 1 - Scheduled Install                              Dec 10     │
│    Crew: Alpha • 8 hrs • $1,200                                        │
│    ────────────────────────────────────────────────────────────────    │
│                                                                         │
│ ⚠️ Visit 2 - Callback                                       Dec 12     │
│    Crew: Alpha • 2 hrs • $300                                          │
│    Issue: Gate not closing, hinges misaligned                          │
│    Resolution: Re-hung gate, adjusted hinges                           │
│    ────────────────────────────────────────────────────────────────    │
│                                                                         │
│ 🔵 Visit 3 - Punch List                                     Dec 14     │
│    Crew: Alpha • Scheduled                          [Start] [Reschedule]│
│    ────────────────────────────────────────────────────────────────    │
│                                                                         │
│ ─────────────────────────────────────────────────────────────────────  │
│ Total: 3 visits • 10 hrs actual (8 budgeted) • ⚠️ Includes $300 rework │
└─────────────────────────────────────────────────────────────────────────┘
```

### Props

```typescript
interface VisitsTimelineProps {
  jobId: string;
  visits: JobVisit[];
  budgetedHours?: number;
  
  onAddVisit: (type: VisitType) => void;
  onEditVisit: (visitId: string) => void;
  onStartVisit: (visitId: string) => void;
  onCompleteVisit: (visitId: string, data: VisitCompletionData) => void;
  onCancelVisit: (visitId: string) => void;
  onRescheduleVisit: (visitId: string) => void;
  
  readOnly?: boolean;
  expandedVisitId?: string;
  showBudgetSummary?: boolean;
}
```

### Add Visit Dropdown Options

```
[+ Add Visit ▾]
├── Scheduled Visit
├── Continuation (multi-day)
├── ──────────────
├── Callback (customer reported issue)
├── Rework (we identified issue)
├── ──────────────
├── Punch List
└── Inspection
```

---

## Component 9: PaymentsSection (Invoice-specific)

**Purpose**: Display payment status and record payments.

### Visual Design

```
┌─────────────────────────────────────────────────────────────────────────┐
│ PAYMENTS                                                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │  Invoice Total:      $4,763.00                                     │ │
│ │  Amount Paid:       -$2,000.00                                     │ │
│ │  ─────────────────────────────                                     │ │
│ │  Balance Due:        $2,763.00                                     │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│ Payment History                                                         │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ Dec 22, 2024  •  $2,000.00  •  Credit Card                        │ │
│ │ Ref: TXN-12345  •  Recorded by Jane                               │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│ [💰 Record Payment]                                                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Props

```typescript
interface PaymentsSectionProps {
  invoiceTotal: number;
  amountPaid: number;
  balanceDue: number;
  payments: Payment[];
  
  onRecordPayment: () => void;
  onViewPaymentDetails?: (paymentId: string) => void;
  
  readOnly?: boolean;
  showPaymentHistory?: boolean;
}
```

### Record Payment Modal

```
┌─────────────────────────────────────────────────────────────────────────┐
│ RECORD PAYMENT                                                     [×]  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ Balance Due: $2,763.00                                                 │
│                                                                         │
│ Amount                                                                  │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ $ [2763.00                                            ] [Pay Full] │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│ Payment Method                                                          │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ [○ Cash] [○ Check] [● Credit Card] [○ ACH] [○ Other]              │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│ Payment Date                    Reference Number                        │
│ ┌───────────────────────┐      ┌─────────────────────────────────────┐ │
│ │ 📅 Dec 28, 2024       │      │ TXN-12346                           │ │
│ └───────────────────────┘      └─────────────────────────────────────┘ │
│                                                                         │
│ Notes (optional)                                                        │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│ ─────────────────────────────────────────────────────────────────────  │
│ [Cancel]                                            [Record Payment]    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
src/features/fsm/
├── components/
│   ├── shared/
│   │   ├── EntityHeader.tsx
│   │   ├── ClientPropertySection.tsx
│   │   ├── LineItemsEditor.tsx
│   │   ├── TotalsDisplay.tsx
│   │   ├── NotesAttachments.tsx
│   │   └── EntityActionBar.tsx
│   │
│   ├── quote/
│   │   └── (quote-specific components if needed)
│   │
│   ├── job/
│   │   ├── SchedulingSection.tsx
│   │   ├── VisitsTimeline.tsx
│   │   ├── VisitCard.tsx
│   │   ├── AddVisitModal.tsx
│   │   ├── CompleteVisitModal.tsx
│   │   └── BudgetActualDisplay.tsx
│   │
│   └── invoice/
│       ├── PaymentsSection.tsx
│       └── RecordPaymentModal.tsx
│
├── pages/
│   ├── QuotePage.tsx        # Unified create/edit
│   ├── JobPage.tsx          # Unified create/edit
│   └── InvoicePage.tsx      # Unified create/edit
│
└── hooks/
    ├── useJobVisits.ts
    └── useProjectWithEntities.ts
```

---

## END OF SHARED COMPONENTS SPECIFICATION
