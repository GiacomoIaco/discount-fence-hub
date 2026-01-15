# UI Specification: Context Sidebar
## Persistent Context Panel for Quote → Job → Invoice

---

**Version:** 1.0  
**Created:** December 2024  
**Status:** Ready for Implementation  
**Component Location:** `src/components/common/ContextSidebar/`

---

## Table of Contents

1. [Overview](#1-overview)
2. [Design Principles](#2-design-principles)
3. [Layout Specifications](#3-layout-specifications)
4. [Sidebar Sections](#4-sidebar-sections)
5. [Stage-Specific Content](#5-stage-specific-content)
6. [Component Architecture](#6-component-architecture)
7. [State Management](#7-state-management)
8. [Responsive Behavior](#8-responsive-behavior)
9. [Accessibility](#9-accessibility)
10. [Implementation Guide](#10-implementation-guide)

---

## 1. Overview

### Purpose

The Context Sidebar is a **persistent left-side panel** that displays contextual information about the current entity (Quote, Job, or Invoice). It provides:

- **Continuity**: Same position and structure across Quote → Job → Invoice lifecycle
- **Context at a Glance**: Critical metadata always visible without scrolling
- **Workflow Efficiency**: No hunting for client/project information
- **Data Consistency**: Information entered once, visible throughout

### Key Concept

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  ┌─────────────┐  ┌────────────────────────────────────────────────┐│
│  │             │  │                                                ││
│  │   CONTEXT   │  │              MAIN CONTENT                      ││
│  │   SIDEBAR   │  │                                                ││
│  │             │  │  (Quote line items / Job visits / Invoice)     ││
│  │  - Details  │  │                                                ││
│  │  - Client   │  │                                                ││
│  │  - Project  │  │                                                ││
│  │  - Custom   │  │                                                ││
│  │  - Metrics  │  │                                                ││
│  │             │  │                                                ││
│  └─────────────┘  └────────────────────────────────────────────────┘│
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 2. Design Principles

### 2.1 Consistency

| Principle | Implementation |
|-----------|----------------|
| Same position | Always left side, never moves |
| Same width | Consistent 320px on desktop |
| Same sections | Core sections appear in same order |
| Same interactions | Collapse/expand works identically |

### 2.2 Adaptability

The sidebar adapts its content based on the entity type while maintaining structural consistency:

```
QUOTE                    JOB                      INVOICE
─────────────────        ─────────────────        ─────────────────
📋 Quote Details         📋 Job Details           📋 Invoice Details
👤 Client & Property     👤 Client & Property     👤 Client & Property
🏗️ Builder Info          🏗️ Builder Info          🏗️ Builder Info
📁 Project Info          📁 Project Info          📁 Project Info
🏷️ Custom Fields         🏷️ Custom Fields         🏷️ Custom Fields
                         📦 Material Prep         
💰 Profitability         💰 Job Costing           💰 Final Margin
                                                  💳 Payment Status
                                                  🔄 QBO Sync
```

### 2.3 Information Hierarchy

1. **Identity** (top): What is this? (Quote #, Status)
2. **Relationships** (upper): Who/Where? (Client, Property)
3. **Context** (middle): Builder info, Project details
4. **Custom** (lower-middle): User-defined fields
5. **Metrics** (bottom): Financial, operational data

---

## 3. Layout Specifications

### 3.1 Desktop Layout (≥1280px)

```
┌────────────────────────────────────────────────────────────────────────────────┐
│  HEADER BAR                                                                    │
├──────────────────────┬─────────────────────────────────────────────────────────┤
│                      │                                                         │
│  CONTEXT SIDEBAR     │  MAIN CONTENT AREA                                      │
│                      │                                                         │
│  Width: 320px        │  Width: calc(100% - 320px)                              │
│  Min-width: 280px    │  Min-width: 600px                                       │
│  Max-width: 400px    │                                                         │
│                      │                                                         │
│  Scrollable: Yes     │  Scrollable: Independent                                │
│  (independent)       │                                                         │
│                      │                                                         │
│  Background:         │  Background: white                                      │
│  gray-50 (#F9FAFB)   │                                                         │
│                      │                                                         │
│  Border-right:       │                                                         │
│  1px solid gray-200  │                                                         │
│                      │                                                         │
└──────────────────────┴─────────────────────────────────────────────────────────┘
```

### 3.2 Dimension Specifications

```css
.context-sidebar {
  /* Dimensions */
  width: 320px;
  min-width: 280px;
  max-width: 400px;
  height: calc(100vh - 64px); /* Minus header */
  
  /* Position */
  position: sticky;
  top: 64px; /* Below header */
  left: 0;
  
  /* Scrolling */
  overflow-y: auto;
  overflow-x: hidden;
  
  /* Styling */
  background-color: #F9FAFB; /* gray-50 */
  border-right: 1px solid #E5E7EB; /* gray-200 */
  
  /* Spacing */
  padding: 24px 16px;
}

.context-sidebar-section {
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid #E5E7EB;
}

.context-sidebar-section:last-child {
  border-bottom: none;
}
```

### 3.3 Section Spacing

```
┌─────────────────────────────┐
│  Section Header         [▼] │  ← 14px font, semibold, gray-700
├─────────────────────────────┤
│  padding-top: 8px           │
│                             │
│  Field Label:               │  ← 12px font, gray-500
│  Field Value                │  ← 14px font, gray-900
│                             │
│  spacing between fields: 12px│
│                             │
│  padding-bottom: 16px       │
├─────────────────────────────┤  ← 1px border, gray-200
│  margin-bottom: 16px        │
└─────────────────────────────┘
```

---

## 4. Sidebar Sections

### 4.1 Section: Entity Header (Always First)

```
┌─────────────────────────────────────────┐
│                                         │
│  📋 QUOTE                               │  ← Entity type icon + label
│  #QUO-2024-0042                         │  ← Entity number (clickable to copy)
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  ● Draft                        │    │  ← Status badge (color-coded)
│  └─────────────────────────────────┘    │
│                                         │
│  Created: Dec 10, 2024                  │
│  By: Marcus Johnson                     │
│                                         │
│  ─────────────────────────────────────  │
│  🔗 LINKED ENTITIES                     │
│  ← Request: REQ-2024-0038  [View]       │  ← Clickable link
│                                         │
└─────────────────────────────────────────┘
```

**Status Badge Colors:**

| Status | Background | Text | Border |
|--------|------------|------|--------|
| Draft | gray-100 | gray-700 | gray-300 |
| Pending/Awaiting | yellow-100 | yellow-800 | yellow-300 |
| Approved/Scheduled | blue-100 | blue-800 | blue-300 |
| In Progress | purple-100 | purple-800 | purple-300 |
| Completed/Paid | green-100 | green-800 | green-300 |
| Overdue/Past Due | red-100 | red-800 | red-300 |
| Archived | gray-100 | gray-500 | gray-300 |

### 4.2 Section: Client & Property

```
┌─────────────────────────────────────────┐
│  👤 CLIENT & PROPERTY              [▼]  │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ 👤 John Smith                   │    │
│  │    📞 (512) 555-1234      [📋]  │    │  ← Click to copy
│  │    ✉️ john@email.com       [📋]  │    │
│  │    🏢 ABC Builders              │    │
│  │                                 │    │
│  │    [View Client]                │    │  ← Opens client profile
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ 📍 123 Oak Street               │    │
│  │    Austin, TX 78701             │    │
│  │                                 │    │
│  │    [🗺️ Map]  [📋 Copy]          │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

### 4.3 Section: Assignment

```
┌─────────────────────────────────────────┐
│  👥 ASSIGNMENT                     [▼]  │
├─────────────────────────────────────────┤
│                                         │
│  Salesperson:                           │
│  ┌─────────────────────────────────┐    │
│  │ 🟢 Marcus Johnson          [×]  │    │  ← Removable chip
│  └─────────────────────────────────┘    │
│  [+ Assign]                             │  ← Opens assignment modal
│                                         │
│  Territory: North Austin                │
│  Business Unit: ATX-RES                 │
│                                         │
│  ─────────────────────────────────────  │  ← Only on JOB
│  Crew:                                  │
│  ┌─────────────────────────────────┐    │
│  │ 🚛 Crew Alpha               [×]  │    │
│  │    Lead: David Martinez         │    │
│  │    Truck: TRK-042               │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

### 4.4 Section: Builder Info (For Home Builder Clients)

```
┌─────────────────────────────────────────┐
│  🏗️ BUILDER INFO                   [▼]  │
├─────────────────────────────────────────┤
│                                         │
│  Builder Rep:                           │
│  Name:    John Smith                    │
│  Phone:   (512) 555-9999          [📋]  │
│  Email:   john@abcbuilders.com    [📋]  │
│                                         │
│  Superintendent:                        │
│  Name:    Mike Wilson                   │
│  Phone:   (512) 555-8888          [📋]  │
│                                         │
└─────────────────────────────────────────┘
```

### 4.5 Section: Project Info

```
┌─────────────────────────────────────────┐
│  📁 PROJECT INFO                   [▼]  │
├─────────────────────────────────────────┤
│                                         │
│  Project Type:   [Home Builder ▼]       │  ← Editable dropdown
│  Community:      Cypress Creek          │
│  Lot/Plot:       Lot 42                 │
│  Priority:       [High ▼]               │  ← Editable dropdown
│                                         │
│  Lead Source:    [Website ▼]            │
│  ☐ Called office                        │  ← Checkbox
│                                         │
└─────────────────────────────────────────┘
```

### 4.6 Section: Custom Fields

```
┌─────────────────────────────────────────┐
│  🏷️ CUSTOM FIELDS                  [▼]  │
├─────────────────────────────────────────┤
│                                         │
│  Is Struxure Job:   [No ▼]              │
│  Gate Code:         1234                │
│  HOA Approval:      ☑️ Required         │
│  Plot Plan:         [Attached ▼]        │
│                                         │
│  [+ Add Custom Field]                   │
│                                         │
└─────────────────────────────────────────┘
```

### 4.7 Section: Material Prep (JOB ONLY)

```
┌─────────────────────────────────────────┐
│  📦 MATERIAL PREP                  [▼]  │
├─────────────────────────────────────────┤
│                                         │
│  Status: STAGED                         │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ ✅ ─── ✅ ─── ✅ ─── ○ ─── ○    │    │
│  │ready picking staged loaded done │    │
│  └─────────────────────────────────┘    │
│                                         │
│  Staged Location: Bay 3                 │
│  Staged By: Mike (Yard)                 │
│  Staged At: Dec 12, 2:30 PM             │
│                                         │
│  [View Pick List]  [Print BOL]          │
│                                         │
└─────────────────────────────────────────┘
```

### 4.8 Section: Profitability (QUOTE) / Job Costing (JOB) / Final Margin (INVOICE)

```
┌─────────────────────────────────────────┐
│  💰 PROFITABILITY                  [▼]  │  ← QUOTE
├─────────────────────────────────────────┤
│                                         │
│  ESTIMATED COSTS (Internal Only)        │
│  ─────────────────────────────────────  │
│  Materials:           $2,147.50         │
│  Labor:               $1,100.00         │
│  ─────────────────────────────────────  │
│  Total Est. Cost:     $3,247.50         │
│                                         │
│  PRICING                                │
│  ─────────────────────────────────────  │
│  Quote Total:         $5,114.81         │
│                                         │
│  MARGIN                                 │
│  ─────────────────────────────────────  │
│  Gross Profit:        $1,867.31         │
│  Gross Margin:        36.5%  ✅         │  ← Green if ≥15%
│                                         │
│  ─────────────────────────────────────  │
│  ⚠️ Margin below 15% requires approval  │  ← Warning if < threshold
│                                         │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  💰 JOB COSTING                    [▼]  │  ← JOB
├─────────────────────────────────────────┤
│                                         │
│  BUDGET vs ACTUAL                       │
│  ─────────────────────────────────────  │
│                     Budget    Actual    │
│  Materials:        $2,147    $2,089  ✅ │
│  Labor:            $1,100    $1,250  ⚠️ │
│  ─────────────────────────────────────  │
│  Total Cost:       $3,247    $3,339     │
│                                         │
│  Quoted Price:                $5,114    │
│  Actual Margin:               34.7%     │
│                                         │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  💰 FINAL MARGIN                   [▼]  │  ← INVOICE
├─────────────────────────────────────────┤
│                                         │
│  Invoice Total:           $5,114.81     │
│  Total Costs:             $3,339.00     │
│  ─────────────────────────────────────  │
│  Final Profit:            $1,775.81     │
│  Final Margin:            34.7%         │
│                                         │
└─────────────────────────────────────────┘
```

### 4.9 Section: Payment Status (INVOICE ONLY)

```
┌─────────────────────────────────────────┐
│  💳 PAYMENT STATUS                 [▼]  │
├─────────────────────────────────────────┤
│                                         │
│  Invoice Total:       $5,114.81         │
│  Amount Paid:         $2,557.40         │
│  ─────────────────────────────────────  │
│  Balance Due:         $2,557.41         │
│                                         │
│  Due Date: Dec 25, 2024                 │
│  Status: ● Awaiting Payment             │
│                                         │
│  PAYMENT HISTORY                        │
│  ─────────────────────────────────────  │
│  Dec 10  Deposit (CC)     $2,557.40  ✓  │
│                                         │
│  [Record Payment]                       │
│                                         │
└─────────────────────────────────────────┘
```

### 4.10 Section: QBO Sync (INVOICE ONLY)

```
┌─────────────────────────────────────────┐
│  🔄 QUICKBOOKS SYNC                [▼]  │
├─────────────────────────────────────────┤
│                                         │
│  Status: ✅ Synced                      │
│  QBO Invoice #: 10542                   │
│  Last Sync: Dec 10, 3:45 PM             │
│                                         │
│  [🔄 Resync]  [View in QBO ↗]           │
│                                         │
└─────────────────────────────────────────┘

─── OR if error ───

┌─────────────────────────────────────────┐
│  🔄 QUICKBOOKS SYNC                [▼]  │
├─────────────────────────────────────────┤
│                                         │
│  Status: ❌ Sync Error                  │
│                                         │
│  Error: Customer not found in QBO       │
│  Last Attempt: Dec 10, 3:45 PM          │
│                                         │
│  [🔄 Retry Sync]  [View Details]        │
│                                         │
└─────────────────────────────────────────┘
```

---

## 5. Stage-Specific Content

### 5.1 Complete Section Matrix

| Section | Quote | Job | Invoice |
|---------|:-----:|:---:|:-------:|
| Entity Header | ✅ | ✅ | ✅ |
| Linked Entities | ← Request | ← Quote, Request | ← Job, Quote, Request |
| Client & Property | ✅ | ✅ (read-only) | ✅ (read-only) |
| Assignment | Salesperson | Salesperson + Crew | Salesperson |
| Builder Info | ✅ | ✅ | ✅ |
| Project Info | ✅ | ✅ | ✅ |
| Custom Fields | ✅ | ✅ | ✅ |
| Material Prep | ❌ | ✅ | ❌ |
| Profitability/Costing | Estimated | Budget vs Actual | Final |
| Payment Status | Deposit only | ❌ | ✅ |
| QBO Sync | ❌ | ❌ | ✅ |

### 5.2 Read-Only vs Editable

| Stage | Editable Sections | Read-Only Sections |
|-------|-------------------|-------------------|
| **Quote** | All sections editable | Linked entities |
| **Job** | Assignment, Custom Fields, Material Prep | Client, Property, Builder Info, Project Info |
| **Invoice** | Payment Status | Everything else (inherited from Job/Quote) |

---

## 6. Component Architecture

### 6.1 File Structure

```
src/components/common/ContextSidebar/
├── index.ts                          # Barrel export
├── ContextSidebar.tsx                # Main container
├── ContextSidebarHeader.tsx          # Entity header section
├── sections/
│   ├── ClientPropertySection.tsx
│   ├── AssignmentSection.tsx
│   ├── BuilderInfoSection.tsx
│   ├── ProjectInfoSection.tsx
│   ├── CustomFieldsSection.tsx
│   ├── MaterialPrepSection.tsx       # Job only
│   ├── ProfitabilitySection.tsx      # Quote
│   ├── JobCostingSection.tsx         # Job
│   ├── FinalMarginSection.tsx        # Invoice
│   ├── PaymentStatusSection.tsx      # Invoice only
│   └── QboSyncSection.tsx            # Invoice only
├── components/
│   ├── CollapsibleSection.tsx        # Wrapper for collapse/expand
│   ├── StatusBadge.tsx
│   ├── LinkedEntityChip.tsx
│   ├── CopyButton.tsx
│   └── ProgressTracker.tsx           # For material prep
├── hooks/
│   ├── useContextSidebar.ts
│   ├── useProfitability.ts
│   └── useSectionCollapse.ts
└── types.ts
```

### 6.2 Main Component Interface

```typescript
// src/components/common/ContextSidebar/types.ts

export type EntityType = 'quote' | 'job' | 'invoice';

export interface ContextSidebarProps {
  entityType: EntityType;
  entityId: string;
  
  // Data (passed from parent or fetched)
  data: QuoteData | JobData | InvoiceData;
  
  // Optional overrides
  className?: string;
  defaultCollapsedSections?: string[];
  
  // Callbacks
  onClientClick?: (clientId: string) => void;
  onPropertyClick?: (propertyId: string) => void;
  onLinkedEntityClick?: (entityType: string, entityId: string) => void;
  onFieldChange?: (field: string, value: any) => void;
}

export interface SidebarSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  isCollapsible: boolean;
  defaultCollapsed: boolean;
  isVisible: (entityType: EntityType) => boolean;
  isEditable: (entityType: EntityType) => boolean;
}

// Section configuration
export const SIDEBAR_SECTIONS: SidebarSection[] = [
  {
    id: 'header',
    title: 'Details',
    icon: <FileText />,
    isCollapsible: false,
    defaultCollapsed: false,
    isVisible: () => true,
    isEditable: () => false,
  },
  {
    id: 'client-property',
    title: 'Client & Property',
    icon: <User />,
    isCollapsible: true,
    defaultCollapsed: false,
    isVisible: () => true,
    isEditable: (type) => type === 'quote',
  },
  {
    id: 'assignment',
    title: 'Assignment',
    icon: <Users />,
    isCollapsible: true,
    defaultCollapsed: false,
    isVisible: () => true,
    isEditable: (type) => type !== 'invoice',
  },
  {
    id: 'builder-info',
    title: 'Builder Info',
    icon: <Building />,
    isCollapsible: true,
    defaultCollapsed: false,
    isVisible: (_, data) => data?.client?.isBuilder ?? false,
    isEditable: (type) => type === 'quote',
  },
  {
    id: 'project-info',
    title: 'Project Info',
    icon: <Folder />,
    isCollapsible: true,
    defaultCollapsed: false,
    isVisible: () => true,
    isEditable: (type) => type === 'quote',
  },
  {
    id: 'custom-fields',
    title: 'Custom Fields',
    icon: <Tag />,
    isCollapsible: true,
    defaultCollapsed: true,
    isVisible: () => true,
    isEditable: () => true,
  },
  {
    id: 'material-prep',
    title: 'Material Prep',
    icon: <Package />,
    isCollapsible: true,
    defaultCollapsed: false,
    isVisible: (type) => type === 'job',
    isEditable: (type) => type === 'job',
  },
  {
    id: 'profitability',
    title: 'Profitability',
    icon: <DollarSign />,
    isCollapsible: true,
    defaultCollapsed: false,
    isVisible: (type) => type === 'quote',
    isEditable: () => false,
  },
  {
    id: 'job-costing',
    title: 'Job Costing',
    icon: <DollarSign />,
    isCollapsible: true,
    defaultCollapsed: false,
    isVisible: (type) => type === 'job',
    isEditable: () => false,
  },
  {
    id: 'final-margin',
    title: 'Final Margin',
    icon: <DollarSign />,
    isCollapsible: true,
    defaultCollapsed: false,
    isVisible: (type) => type === 'invoice',
    isEditable: () => false,
  },
  {
    id: 'payment-status',
    title: 'Payment Status',
    icon: <CreditCard />,
    isCollapsible: true,
    defaultCollapsed: false,
    isVisible: (type) => type === 'invoice',
    isEditable: () => true,
  },
  {
    id: 'qbo-sync',
    title: 'QuickBooks Sync',
    icon: <RefreshCw />,
    isCollapsible: true,
    defaultCollapsed: true,
    isVisible: (type) => type === 'invoice',
    isEditable: () => false,
  },
];
```

### 6.3 Main Component Implementation

```typescript
// src/components/common/ContextSidebar/ContextSidebar.tsx

import React from 'react';
import { cn } from '@/lib/utils';
import { SIDEBAR_SECTIONS, ContextSidebarProps } from './types';
import { ContextSidebarHeader } from './ContextSidebarHeader';
import { CollapsibleSection } from './components/CollapsibleSection';
import { useSectionCollapse } from './hooks/useSectionCollapse';

// Section components
import { ClientPropertySection } from './sections/ClientPropertySection';
import { AssignmentSection } from './sections/AssignmentSection';
import { BuilderInfoSection } from './sections/BuilderInfoSection';
import { ProjectInfoSection } from './sections/ProjectInfoSection';
import { CustomFieldsSection } from './sections/CustomFieldsSection';
import { MaterialPrepSection } from './sections/MaterialPrepSection';
import { ProfitabilitySection } from './sections/ProfitabilitySection';
import { JobCostingSection } from './sections/JobCostingSection';
import { FinalMarginSection } from './sections/FinalMarginSection';
import { PaymentStatusSection } from './sections/PaymentStatusSection';
import { QboSyncSection } from './sections/QboSyncSection';

const sectionComponents: Record<string, React.ComponentType<any>> = {
  'client-property': ClientPropertySection,
  'assignment': AssignmentSection,
  'builder-info': BuilderInfoSection,
  'project-info': ProjectInfoSection,
  'custom-fields': CustomFieldsSection,
  'material-prep': MaterialPrepSection,
  'profitability': ProfitabilitySection,
  'job-costing': JobCostingSection,
  'final-margin': FinalMarginSection,
  'payment-status': PaymentStatusSection,
  'qbo-sync': QboSyncSection,
};

export function ContextSidebar({
  entityType,
  entityId,
  data,
  className,
  defaultCollapsedSections = [],
  onClientClick,
  onPropertyClick,
  onLinkedEntityClick,
  onFieldChange,
}: ContextSidebarProps) {
  const { collapsedSections, toggleSection } = useSectionCollapse(
    defaultCollapsedSections
  );

  const visibleSections = SIDEBAR_SECTIONS.filter(
    (section) => section.isVisible(entityType, data)
  );

  return (
    <aside
      className={cn(
        'w-80 min-w-[280px] max-w-[400px]',
        'h-[calc(100vh-64px)] sticky top-16',
        'overflow-y-auto overflow-x-hidden',
        'bg-gray-50 border-r border-gray-200',
        'p-6',
        className
      )}
    >
      {/* Entity Header - Always visible, not collapsible */}
      <ContextSidebarHeader
        entityType={entityType}
        data={data}
        onLinkedEntityClick={onLinkedEntityClick}
      />

      {/* Dynamic Sections */}
      {visibleSections
        .filter((s) => s.id !== 'header')
        .map((section) => {
          const SectionComponent = sectionComponents[section.id];
          if (!SectionComponent) return null;

          const isEditable = section.isEditable(entityType);
          const isCollapsed = collapsedSections.includes(section.id);

          return (
            <CollapsibleSection
              key={section.id}
              id={section.id}
              title={section.title}
              icon={section.icon}
              isCollapsible={section.isCollapsible}
              isCollapsed={isCollapsed}
              onToggle={() => toggleSection(section.id)}
            >
              <SectionComponent
                entityType={entityType}
                data={data}
                isEditable={isEditable}
                onFieldChange={onFieldChange}
                onClientClick={onClientClick}
                onPropertyClick={onPropertyClick}
              />
            </CollapsibleSection>
          );
        })}
    </aside>
  );
}
```

---

## 7. State Management

### 7.1 Local State (Section Collapse)

```typescript
// src/components/common/ContextSidebar/hooks/useSectionCollapse.ts

import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'context-sidebar-collapsed';

export function useSectionCollapse(defaultCollapsed: string[] = []) {
  const [collapsedSections, setCollapsedSections] = useState<string[]>(() => {
    // Try to restore from localStorage
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {
          return defaultCollapsed;
        }
      }
    }
    return defaultCollapsed;
  });

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collapsedSections));
  }, [collapsedSections]);

  const toggleSection = useCallback((sectionId: string) => {
    setCollapsedSections((prev) =>
      prev.includes(sectionId)
        ? prev.filter((id) => id !== sectionId)
        : [...prev, sectionId]
    );
  }, []);

  const collapseAll = useCallback(() => {
    setCollapsedSections(SIDEBAR_SECTIONS.filter(s => s.isCollapsible).map(s => s.id));
  }, []);

  const expandAll = useCallback(() => {
    setCollapsedSections([]);
  }, []);

  return {
    collapsedSections,
    toggleSection,
    collapseAll,
    expandAll,
  };
}
```

### 7.2 Profitability Calculation

```typescript
// src/components/common/ContextSidebar/hooks/useProfitability.ts

import { useMemo } from 'react';
import { QuoteData } from '../types';

interface ProfitabilityResult {
  materialCost: number;
  laborCost: number;
  totalCost: number;
  quotePrice: number;
  grossProfit: number;
  grossMarginPercent: number;
  requiresApproval: boolean;
  approvalReasons: string[];
}

export function useProfitability(
  quote: QuoteData,
  approvalSettings: ApprovalSettings
): ProfitabilityResult {
  return useMemo(() => {
    // Calculate material cost from BOM
    const materialCost = quote.bom.reduce((sum, item) => {
      return sum + (item.quantity * item.material.unit_cost);
    }, 0);

    // Calculate labor cost from BOL
    const laborCost = quote.bol.reduce((sum, item) => {
      return sum + (item.quantity * item.laborCode.cost_rate);
    }, 0);

    const totalCost = materialCost + laborCost;
    const quotePrice = quote.total;
    const grossProfit = quotePrice - totalCost;
    const grossMarginPercent = quotePrice > 0 
      ? (grossProfit / quotePrice) * 100 
      : 0;

    // Check approval requirements
    const approvalReasons: string[] = [];
    
    if (quotePrice > approvalSettings.quote_total_threshold) {
      approvalReasons.push(
        `Total ($${quotePrice.toLocaleString()}) exceeds $${approvalSettings.quote_total_threshold.toLocaleString()} threshold`
      );
    }
    
    if (grossMarginPercent < approvalSettings.quote_margin_minimum) {
      approvalReasons.push(
        `Margin (${grossMarginPercent.toFixed(1)}%) below ${approvalSettings.quote_margin_minimum}% minimum`
      );
    }
    
    if (quote.discount_percent > approvalSettings.quote_discount_maximum) {
      approvalReasons.push(
        `Discount (${quote.discount_percent}%) exceeds ${approvalSettings.quote_discount_maximum}% maximum`
      );
    }

    return {
      materialCost,
      laborCost,
      totalCost,
      quotePrice,
      grossProfit,
      grossMarginPercent,
      requiresApproval: approvalReasons.length > 0,
      approvalReasons,
    };
  }, [quote, approvalSettings]);
}
```

---

## 8. Responsive Behavior

### 8.1 Breakpoints

| Breakpoint | Sidebar Behavior |
|------------|------------------|
| ≥1280px | Full sidebar visible (320px) |
| 1024-1279px | Narrower sidebar (280px) |
| 768-1023px | Collapsible drawer (slide from left) |
| <768px | Bottom sheet or separate "Details" tab |

### 8.2 Tablet Implementation (768-1023px)

```typescript
// Tablet: Sidebar becomes a drawer
<Sheet>
  <SheetTrigger asChild>
    <Button variant="outline" size="icon" className="lg:hidden">
      <PanelLeftOpen className="h-4 w-4" />
    </Button>
  </SheetTrigger>
  <SheetContent side="left" className="w-80 p-0">
    <ContextSidebar {...props} />
  </SheetContent>
</Sheet>
```

### 8.3 Mobile Implementation (<768px)

```typescript
// Mobile: Tabs at bottom or top
<Tabs defaultValue="content">
  <TabsList className="fixed bottom-0 w-full">
    <TabsTrigger value="content">Quote</TabsTrigger>
    <TabsTrigger value="details">Details</TabsTrigger>
  </TabsList>
  
  <TabsContent value="content">
    {/* Main quote content */}
  </TabsContent>
  
  <TabsContent value="details">
    {/* Sidebar content rendered full-width */}
    <ContextSidebarMobile {...props} />
  </TabsContent>
</Tabs>
```

---

## 9. Accessibility

### 9.1 ARIA Attributes

```tsx
<aside
  role="complementary"
  aria-label={`${entityType} details sidebar`}
>
  <section
    aria-labelledby="client-property-heading"
    aria-expanded={!isCollapsed}
  >
    <button
      id="client-property-heading"
      aria-controls="client-property-content"
      aria-expanded={!isCollapsed}
      onClick={() => toggleSection('client-property')}
    >
      Client & Property
    </button>
    <div
      id="client-property-content"
      role="region"
      hidden={isCollapsed}
    >
      {/* Section content */}
    </div>
  </section>
</aside>
```

### 9.2 Keyboard Navigation

| Key | Action |
|-----|--------|
| Tab | Move between interactive elements |
| Enter/Space | Toggle section collapse, activate buttons |
| Escape | Close sidebar (on tablet/mobile drawer) |

### 9.3 Screen Reader Considerations

- All icons have `aria-hidden="true"` with text alternatives
- Status badges have `role="status"` and descriptive text
- Copy buttons announce "Copied to clipboard" on success

---

## 10. Implementation Guide

### 10.1 Integration with Page Layouts

```typescript
// src/features/fsm/pages/QuoteDetailPage.tsx

import { ContextSidebar } from '@/components/common/ContextSidebar';

export function QuoteDetailPage() {
  const { quoteId } = useParams();
  const { data: quote, isLoading } = useQuote(quoteId);

  if (isLoading) return <LoadingState />;

  return (
    <div className="flex">
      {/* Context Sidebar */}
      <ContextSidebar
        entityType="quote"
        entityId={quoteId}
        data={quote}
        onClientClick={(id) => navigate(`/clients/${id}`)}
        onFieldChange={handleFieldChange}
      />

      {/* Main Content */}
      <main className="flex-1 p-6">
        <QuoteHeader quote={quote} />
        <QuoteOptions quote={quote} />
        <QuoteLineItems quote={quote} />
        <QuoteSummary quote={quote} />
      </main>
    </div>
  );
}
```

### 10.2 Checklist for Implementation

**Phase 1: Core Structure**
- [ ] Create folder structure
- [ ] Implement `ContextSidebar` container
- [ ] Implement `CollapsibleSection` component
- [ ] Implement `ContextSidebarHeader`
- [ ] Add responsive breakpoint handling

**Phase 2: Common Sections**
- [ ] Implement `ClientPropertySection`
- [ ] Implement `AssignmentSection`
- [ ] Implement `BuilderInfoSection`
- [ ] Implement `ProjectInfoSection`
- [ ] Implement `CustomFieldsSection`

**Phase 3: Stage-Specific Sections**
- [ ] Implement `ProfitabilitySection` (Quote)
- [ ] Implement `MaterialPrepSection` (Job)
- [ ] Implement `JobCostingSection` (Job)
- [ ] Implement `FinalMarginSection` (Invoice)
- [ ] Implement `PaymentStatusSection` (Invoice)
- [ ] Implement `QboSyncSection` (Invoice)

**Phase 4: Polish**
- [ ] Add localStorage persistence for collapse state
- [ ] Implement tablet drawer behavior
- [ ] Implement mobile tab behavior
- [ ] Add accessibility attributes
- [ ] Add copy-to-clipboard functionality
- [ ] Add loading states

---

*Document Version: 1.0*  
*Ready for Claude Code Implementation*
