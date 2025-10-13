# BOM/BOL Calculator - UI Specification Document

**For Claude Code:** This document preserves the working UI/UX from the production system.

---

## 🎯 Purpose

Your current UI is **production-tested and user-approved**. This document captures every detail so Claude Code can recreate it (or improve it) in the new system.

**Key Principle:** The UI works well. Don't reinvent it - preserve what's good, modernize what's needed.

---

## 📐 Overall Layout Architecture

### Application Structure
```
┌─────────────────────────────────────────────────────────────┐
│  HEADER (bg-primary, white text)                            │
│  • Logo (left)                                               │
│  • Navigation Buttons (right): Calculator | Projects |      │
│    SKU Builder | Materials | SKU Catalog | Logout           │
└─────────────────────────────────────────────────────────────┘
│                                                               │
│  MAIN CONTENT AREA (bg-gray-100, full height)               │
│  • Calculator View                                           │
│  • Projects List View                                        │
│  • SKU Builder View                                          │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Color Palette (from config.js)
```javascript
COLORS: {
    primary: '#1E3A8A',      // Deep blue (header, primary buttons)
    accent: '#10B981',       // Green (success, action buttons)
    dfRed: '#DC2626'         // Red (company brand, alerts)
}
```

---

## 🧱 Core UI Components

### 1. Header Component
**File Reference:** `index.html` (lines ~150-200)

```jsx
<header className="bg-primary text-white shadow-lg">
  <div className="max-w-7xl mx-auto px-4 py-6">
    <div className="flex justify-between items-center">
      
      {/* Left: Logo */}
      <div className="flex items-center space-x-4">
        <img src={LOGO_PATH} className="h-12 w-auto" />
        <div>
          <h1 className="text-2xl font-bold">BOM/BOL Calculator</h1>
          <p className="text-blue-200 text-sm">Discount Fence USA</p>
        </div>
      </div>
      
      {/* Right: Navigation */}
      <div className="flex items-center space-x-2">
        <button className="px-4 py-2 bg-white text-primary rounded-md hover:bg-gray-100">
          Calculator
        </button>
        <button className="px-4 py-2 text-white hover:bg-blue-800 rounded-md">
          Projects
        </button>
        <button className="px-4 py-2 text-white hover:bg-blue-800 rounded-md">
          SKU Builder
        </button>
        <button className="px-4 py-2 text-white hover:bg-blue-800 rounded-md">
          Materials
        </button>
        <button className="px-4 py-2 text-white hover:bg-blue-800 rounded-md">
          SKU Catalog
        </button>
        
        {/* User Info */}
        <div className="flex items-center space-x-2 ml-4 pl-4 border-l border-blue-700">
          <span className="text-sm">{userName}</span>
          <button className="text-sm hover:text-gray-300">Logout</button>
        </div>
      </div>
    </div>
  </div>
</header>
```

**Key Features:**
- ✅ Active view highlighted with `bg-white text-primary`
- ✅ Inactive views use `text-white hover:bg-blue-800`
- ✅ Logo with fallback to initials if image fails
- ✅ User name and logout always visible

---

### 2. NumericInput Component
**File Reference:** `calculator.js` (component definition)

```jsx
const NumericInput = ({ 
  value, 
  onChange, 
  placeholder = "0", 
  className = "", 
  wholeNumbers = false 
}) => {
  const handleChange = (e) => {
    const newValue = e.target.value === '' ? 0 : parseFloat(e.target.value) || 0;
    onChange(wholeNumbers ? Math.floor(newValue) : newValue);
  };
  
  return (
    <input
      type="number"
      value={value || ''}
      onChange={handleChange}
      onFocus={(e) => e.target.select()}  // Auto-select on focus!
      placeholder={placeholder}
      className={className}
      min="0"
      step={wholeNumbers ? "1" : "0.01"}
    />
  );
};
```

**Key Features:**
- ✅ Auto-selects text on focus (great UX!)
- ✅ Handles empty values gracefully
- ✅ Optional whole numbers mode
- ✅ Always non-negative (min="0")

---

## 📱 Main Calculator View

### Layout Structure
```
┌────────────────────────────────────────────────────────────┐
│  PROJECT DETAILS SECTION (white card)                      │
│  • Customer Name, Business Unit, Assigned To               │
│  • Date, Status                                            │
│  • Save Project button (top right)                         │
└────────────────────────────────────────────────────────────┘
│                                                              │
┌────────────────────────────────────────────────────────────┐
│  LINE ITEMS SECTION                                         │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Line Item #1                           [Delete] [^]  │ │
│  │ • SKU Selector                                       │ │
│  │ • Net Length | Buffer | Lines | Gates (inline)      │ │
│  └──────────────────────────────────────────────────────┘ │
│  [+ Add Line Item]                                         │
└────────────────────────────────────────────────────────────┘
│                                                              │
┌────────────────────────────────────────────────────────────┐
│  CALCULATE BUTTON (large, centered, accent green)          │
└────────────────────────────────────────────────────────────┘
│                                                              │
┌─────────────────────────┬──────────────────────────────────┐
│  BOM (Bill of Materials)│  BOL (Bill of Labor)             │
│  • Materials table      │  • Labor codes table             │
│  • Quantity adjustments │  • Cost adjustments              │
│  • Totals               │  • Totals                        │
└─────────────────────────┴──────────────────────────────────┘
```

### Project Details Section
**File Reference:** `calculator.js` (Project Details rendering)

```jsx
<div className="bg-white rounded-lg shadow-lg p-6 mb-6">
  <div className="flex justify-between items-center mb-4">
    <h2 className="text-2xl font-bold text-gray-900">Project Details</h2>
    <button 
      onClick={saveProject}
      className="bg-accent text-white px-6 py-2 rounded-md hover:bg-green-700"
    >
      Save Project
    </button>
  </div>
  
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
    {/* Customer Name */}
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Customer Name
      </label>
      <input
        type="text"
        value={project.customerName}
        onChange={(e) => setProject({...project, customerName: e.target.value})}
        className="w-full px-3 py-2 border border-gray-300 rounded-md"
        placeholder="Enter customer name"
      />
    </div>
    
    {/* Business Unit */}
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Business Unit
      </label>
      <select
        value={project.businessUnit}
        onChange={(e) => setProject({...project, businessUnit: e.target.value})}
        className="w-full px-3 py-2 border border-gray-300 rounded-md"
      >
        <option value="">Select Business Unit...</option>
        {businessUnits.map(bu => (
          <option key={bu.id} value={bu.id}>
            {bu.fields['BU Code']} - {bu.fields['BU Name']}
          </option>
        ))}
      </select>
    </div>
    
    {/* Assigned To */}
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Assigned To
      </label>
      <input
        type="text"
        value={project.assignedTo}
        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
        readOnly
      />
    </div>
    
    {/* Date */}
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Date
      </label>
      <input
        type="date"
        value={project.date}
        onChange={(e) => setProject({...project, date: e.target.value})}
        className="w-full px-3 py-2 border border-gray-300 rounded-md"
      />
    </div>
    
    {/* Status */}
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Status
      </label>
      <select
        value={project.status}
        onChange={(e) => setProject({...project, status: e.target.value})}
        className="w-full px-3 py-2 border border-gray-300 rounded-md"
      >
        <option value="Draft">Draft</option>
        <option value="Needs Approval">Needs Approval</option>
        <option value="Approved">Approved</option>
      </select>
    </div>
  </div>
</div>
```

**Key Features:**
- ✅ 3-column grid layout (responsive to 1 column on mobile)
- ✅ "Assigned To" pre-filled with current user
- ✅ "Save Project" button prominently placed top-right
- ✅ Status dropdown with 3 options

---

### Line Item Card
**File Reference:** `calculator.js` (Line Item rendering)

```jsx
<div className="bg-white rounded-lg shadow-lg p-6 mb-4">
  <div className="flex justify-between items-center mb-4">
    <h3 className="text-lg font-semibold text-gray-900">
      Line Item #{index + 1}
    </h3>
    <div className="flex space-x-2">
      {lineItems.length > 1 && (
        <button
          onClick={() => removeLineItem(item.id)}
          className="text-red-600 hover:text-red-800 text-sm"
        >
          Delete
        </button>
      )}
      <button
        onClick={() => toggleLineItem(item.id)}
        className="text-gray-600 hover:text-gray-800"
      >
        {item.expanded ? '▼' : '▶'}
      </button>
    </div>
  </div>
  
  {item.expanded && (
    <>
      {/* SKU Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Select Fence SKU
        </label>
        <select
          value={item.skuId}
          onChange={(e) => updateLineItem(item.id, 'skuId', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        >
          <option value="">Select a fence type...</option>
          <optgroup label="Wood Vertical">
            {skuList.filter(s => s.fenceType === 'Wood Vertical').map(sku => (
              <option key={sku.id} value={sku.id}>
                {sku.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Wood Horizontal">
            {/* ... */}
          </optgroup>
          <optgroup label="Iron">
            {/* ... */}
          </optgroup>
        </select>
      </div>
      
      {/* Measurements Grid */}
      <div className="grid grid-cols-4 gap-4">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Net Length (ft)</label>
          <NumericInput
            value={item.netLength}
            onChange={(value) => updateLineItem(item.id, 'netLength', value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
        
        <div>
          <label className="block text-xs text-gray-600 mb-1">Buffer</label>
          <NumericInput
            value={item.errorBuffer}
            onChange={(value) => updateLineItem(item.id, 'errorBuffer', value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            wholeNumbers={true}
          />
        </div>
        
        <div>
          <label className="block text-xs text-gray-600 mb-1">Lines</label>
          <select
            value={item.numberOfLines}
            onChange={(e) => updateLineItem(item.id, 'numberOfLines', parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            {[1, 2, 3, 4, 5].map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-xs text-gray-600 mb-1">Gates</label>
          <select
            value={item.numberOfGates}
            onChange={(e) => updateLineItem(item.id, 'numberOfGates', parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            {[0, 1, 2, 3].map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>
    </>
  )}
</div>
```

**Key Features:**
- ✅ Collapsible with expand/collapse button
- ✅ SKU grouped by fence type (optgroup)
- ✅ 4-column grid for measurements
- ✅ Delete button (hidden if only 1 line item)
- ✅ Clear visual hierarchy

---

### Calculate Button
```jsx
<div className="text-center mb-6">
  <button
    onClick={handleCalculate}
    disabled={!canCalculate()}
    className={`
      px-8 py-4 rounded-lg text-lg font-semibold
      ${canCalculate() 
        ? 'bg-accent text-white hover:bg-green-700 shadow-lg' 
        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
      }
    `}
  >
    {calculating ? 'Calculating...' : 'Calculate BOM/BOL'}
  </button>
</div>
```

**Key Features:**
- ✅ Large, prominent, centered
- ✅ Disabled state when inputs incomplete
- ✅ Loading state during calculation
- ✅ Green accent color (action-oriented)

---

### BOM Display (Materials Table)
**File Reference:** `calculator.js` (BOM rendering)

```jsx
<div className="bg-white rounded-lg shadow-lg p-6">
  <h3 className="text-xl font-bold text-gray-900 mb-4">
    Bill of Materials (BOM)
  </h3>
  
  <table className="min-w-full divide-y divide-gray-200">
    <thead className="bg-gray-50">
      <tr>
        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">
          Material
        </th>
        <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase">
          Category
        </th>
        <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase">
          Quantity
        </th>
        <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase">
          Unit
        </th>
        <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase">
          Unit Cost
        </th>
        <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase">
          Adjustment
        </th>
        <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase">
          Total
        </th>
      </tr>
    </thead>
    
    <tbody className="bg-white divide-y divide-gray-200">
      {bomData.materials.map(material => (
        <tr key={material.sku} className="hover:bg-gray-50">
          <td className="px-2 py-2">
            <div className="font-medium text-xs">{material.sku}</div>
            <div className="text-xs text-gray-500">{material.name}</div>
          </td>
          <td className="px-2 py-2 text-center text-xs">
            {material.category}
          </td>
          <td className="px-2 py-2 text-center text-xs">
            {material.calculatedQuantity.toFixed(2)}
          </td>
          <td className="px-2 py-2 text-center text-xs">
            {material.unit}
          </td>
          <td className="px-2 py-2 text-center text-xs">
            ${material.unitCost.toFixed(2)}
          </td>
          <td className="px-2 py-2 text-center">
            <input
              type="number"
              value={material.adjustment || 0}
              onChange={(e) => {
                const newAdj = { 
                  ...materialAdjustments, 
                  [material.sku]: parseFloat(e.target.value) || 0 
                };
                setMaterialAdjustments(newAdj);
              }}
              className="w-16 px-1 py-1 text-xs border border-gray-300 rounded text-center"
              step="0.01"
              placeholder="±0"
            />
          </td>
          <td className="px-2 py-2 text-right text-xs font-medium">
            ${material.totalCost.toFixed(2)}
          </td>
        </tr>
      ))}
      
      {/* Totals Row */}
      <tr className="bg-gray-50 font-bold">
        <td colSpan="6" className="px-2 py-3 text-right text-sm">
          Material Total:
        </td>
        <td className="px-2 py-3 text-right text-sm">
          ${bomData.materialTotal.toFixed(2)}
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

**Key Features:**
- ✅ Material SKU and name (two-line display)
- ✅ Quantity shown to 2 decimals
- ✅ Manual adjustment column (±)
- ✅ Totals row with bold styling
- ✅ Hover effect on rows
- ✅ Compact design (small text, tight padding)

---

### BOL Display (Labor Table)
**Similar structure to BOM, but with:**
- Labor code instead of material SKU
- Rate column (per LF/gate/project)
- Calculated cost column

```jsx
<div className="bg-white rounded-lg shadow-lg p-6">
  <h3 className="text-xl font-bold text-gray-900 mb-4">
    Bill of Labor (BOL)
  </h3>
  
  <table className="min-w-full divide-y divide-gray-200">
    {/* Similar structure to BOM table */}
    <thead>
      <tr>
        <th>Labor Code</th>
        <th>Rate</th>
        <th>Calculated Cost</th>
        <th>Adjustment</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      {/* Labor rows */}
    </tbody>
  </table>
</div>
```

---

## 📋 Projects List View

### Layout
```jsx
<div className="max-w-7xl mx-auto px-4 py-8">
  {/* Header with Search and Filters */}
  <div className="mb-6 flex justify-between items-center">
    <h1 className="text-3xl font-bold text-gray-900">Saved Projects</h1>
    <button className="bg-accent text-white px-6 py-3 rounded-md">
      New Project
    </button>
  </div>
  
  {/* Search Bar */}
  <div className="mb-4 flex space-x-4">
    <input
      type="text"
      placeholder="Search by customer name..."
      className="flex-1 px-4 py-2 border border-gray-300 rounded-md"
    />
    <select className="px-4 py-2 border border-gray-300 rounded-md">
      <option value="">All Statuses</option>
      <option value="Draft">Draft</option>
      <option value="Needs Approval">Needs Approval</option>
      <option value="Approved">Approved</option>
    </select>
  </div>
  
  {/* Projects Table */}
  <div className="bg-white rounded-lg shadow-lg overflow-hidden">
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          <th>Project Name</th>
          <th>Business Unit</th>
          <th>Assigned To</th>
          <th>Date</th>
          <th>Total Cost</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {/* Project rows */}
      </tbody>
    </table>
  </div>
</div>
```

**Key Features:**
- ✅ Search by customer name
- ✅ Filter by status
- ✅ Status badges with color coding:
  - Draft: gray
  - Needs Approval: yellow
  - Approved: green
- ✅ Actions: Load, Delete, Duplicate
- ✅ Shows line item count per project

---

## 🔨 SKU Builder View

### Layout (3 Tabs)
```
┌────────────────────────────────────────────────────────────┐
│  [Wood Vertical] [Wood Horizontal] [Iron]                  │
├────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────┬──────────────────────────────────────┐│
│  │ SKU CONFIG FORM │  BOM/BOL PREVIEW                     ││
│  │ (2 columns)     │  (materials + labor tables)          ││
│  │                 │                                       ││
│  │ • SKU Number    │  Materials:                          ││
│  │ • SKU Name      │  - 14 posts                          ││
│  │ • Style         │  - 229 pickets                       ││
│  │ • Height        │  - 39 rails                          ││
│  │ • Materials     │  ...                                 ││
│  │                 │                                       ││
│  │ [Calculate]     │  Labor:                              ││
│  │ [Save SKU]      │  - W02: Set posts                    ││
│  │                 │  - W03: Nail up 6ft                  ││
│  └─────────────────┴──────────────────────────────────────┘│
│                                                              │
│  ┌────────────────────────────────────────────────────────┐│
│  │ SEARCH EXISTING SKUs                                   ││
│  │ • Search/filter existing products                      ││
│  │ • Load to edit or copy                                 ││
│  └────────────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────────┘
```

### Wood Vertical Form Fields
```jsx
<form className="space-y-4">
  {/* Basic Info */}
  <div>
    <label>SKU Number</label>
    <input type="text" placeholder="e.g., WV-STD-6-WOOD" />
  </div>
  
  <div>
    <label>SKU Name</label>
    <input type="text" placeholder="e.g., 6ft Standard Wood Post" />
  </div>
  
  {/* Style Selection */}
  <div>
    <label>Style</label>
    <select>
      <option>Standard</option>
      <option>Good Neighbor - Residential</option>
      <option>Good Neighbor - Builder</option>
      <option>Board-on-Board</option>
    </select>
  </div>
  
  {/* Height Selection */}
  <div>
    <label>Height (ft)</label>
    <select>
      {[3, 4, 5, 6, 7, 8].map(h => <option key={h}>{h}</option>)}
    </select>
  </div>
  
  {/* CRITICAL: Post Type */}
  <div className="bg-yellow-50 border border-yellow-200 p-3 rounded">
    <label className="font-semibold">Post Type</label>
    <p className="text-xs text-gray-600 mb-2">
      This determines labor codes! Wood = W-codes, Steel = M-codes
    </p>
    <select>
      <option value="WOOD">Wood Posts</option>
      <option value="STEEL">Steel Posts</option>
    </select>
  </div>
  
  {/* Material Selections */}
  <div>
    <label>Post Material</label>
    <select>
      {materials.filter(m => m.category === '01-Posts').map(m => (
        <option key={m.id} value={m.id}>{m.name}</option>
      ))}
    </select>
  </div>
  
  <div>
    <label>Picket Material</label>
    <select>
      {materials.filter(m => m.category === '02-Pickets').map(m => (
        <option key={m.id} value={m.id}>{m.name}</option>
      ))}
    </select>
  </div>
  
  <div>
    <label>Rail Material</label>
    <select>
      {materials.filter(m => m.category === '03-Rails').map(m => (
        <option key={m.id} value={m.id}>{m.name}</option>
      ))}
    </select>
  </div>
  
  {/* Optional Materials */}
  <div>
    <label>
      <input type="checkbox" checked={hasCap} />
      Include Cap
    </label>
    {hasCap && (
      <select>
        {materials.filter(m => m.category === '05-Cap').map(m => (
          <option key={m.id} value={m.id}>{m.name}</option>
        ))}
      </select>
    )}
  </div>
  
  {/* Buttons */}
  <div className="flex space-x-2">
    <button 
      type="button" 
      onClick={calculatePreview}
      className="bg-primary text-white px-4 py-2 rounded"
    >
      Calculate Preview
    </button>
    <button 
      type="button" 
      onClick={saveSKU}
      className="bg-accent text-white px-4 py-2 rounded"
    >
      Save SKU
    </button>
  </div>
</form>
```

**Key Features:**
- ✅ Post Type prominently highlighted (CRITICAL for labor codes)
- ✅ Material dropdowns filtered by category
- ✅ Optional materials with checkbox toggle
- ✅ Live preview on right side
- ✅ Duplicate detection before save

---

## 🎨 Design Patterns & Best Practices

### 1. Form Inputs
```jsx
// Standard input style
className="w-full px-3 py-2 border border-gray-300 rounded-md 
           focus:ring-2 focus:ring-primary focus:border-primary"

// Read-only inputs
className="w-full px-3 py-2 border border-gray-300 rounded-md 
           bg-gray-50 cursor-not-allowed"

// Error state
className="w-full px-3 py-2 border border-red-500 rounded-md"
```

### 2. Buttons
```jsx
// Primary Action (green)
className="bg-accent text-white px-6 py-2 rounded-md 
           hover:bg-green-700 shadow-md transition"

// Secondary Action (blue)
className="bg-primary text-white px-6 py-2 rounded-md 
           hover:bg-blue-900 transition"

// Destructive Action (red)
className="bg-red-600 text-white px-4 py-2 rounded-md 
           hover:bg-red-700 transition"

// Disabled State
className="bg-gray-300 text-gray-500 px-6 py-2 rounded-md 
           cursor-not-allowed"
```

### 3. Cards
```jsx
className="bg-white rounded-lg shadow-lg p-6"

// With border
className="bg-white rounded-lg border border-gray-200 p-6"

// Hover effect
className="bg-white rounded-lg shadow hover:shadow-xl transition"
```

### 4. Tables
```jsx
// Table container
className="min-w-full divide-y divide-gray-200"

// Header
className="bg-gray-50"
className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase"

// Body rows
className="bg-white divide-y divide-gray-200"
className="hover:bg-gray-50 transition"

// Cells
className="px-2 py-2 text-xs"
```

### 5. Status Badges
```jsx
// Draft
className="inline-flex px-2 py-1 text-xs font-semibold rounded-full 
           bg-gray-100 text-gray-800"

// Needs Approval
className="inline-flex px-2 py-1 text-xs font-semibold rounded-full 
           bg-yellow-100 text-yellow-800"

// Approved
className="inline-flex px-2 py-1 text-xs font-semibold rounded-full 
           bg-green-100 text-green-800"
```

---

## 📱 Responsive Behavior

### Breakpoints (Tailwind)
- **Mobile:** < 640px (`sm:`)
- **Tablet:** < 768px (`md:`)
- **Desktop:** < 1024px (`lg:`)

### Key Responsive Patterns

```jsx
// Grid that collapses on mobile
className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"

// Hide on mobile, show on desktop
className="hidden lg:block"

// Full width on mobile, auto on desktop
className="w-full lg:w-auto"

// Stack on mobile, side-by-side on desktop
className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-2"
```

---

## ✅ Accessibility Features

### Current Implementation
- ✅ All form inputs have labels
- ✅ Semantic HTML (header, main, table, etc.)
- ✅ Focus states on interactive elements
- ✅ Color contrast meets WCAG AA
- ⚠️ Missing: ARIA labels on icon buttons
- ⚠️ Missing: Keyboard navigation shortcuts

### Recommendations for Claude Code
```jsx
// Add ARIA labels
<button aria-label="Delete line item" onClick={deleteItem}>
  <TrashIcon />
</button>

// Add keyboard shortcuts
<button onClick={calculate} title="Calculate (Ctrl+Enter)">
  Calculate
</button>

// Add skip links
<a href="#main-content" className="sr-only focus:not-sr-only">
  Skip to main content
</a>
```

---

## 🎯 UI/UX Principles to Preserve

### 1. **Progressive Disclosure**
- Line items collapse/expand
- Optional materials appear only when checkbox checked
- Results only show after calculation

### 2. **Instant Feedback**
- Auto-select on input focus
- Disabled states when inputs incomplete
- Loading states during async operations
- Hover effects on interactive elements

### 3. **Clear Visual Hierarchy**
- Large, prominent actions (Calculate button)
- Secondary actions less prominent
- Destructive actions (Delete) always red

### 4. **Forgiving Inputs**
- Handles empty values gracefully
- Prevents negative numbers
- Auto-formats currency

### 5. **Obvious Next Steps**
- "Save Project" always visible
- "Add Line Item" button clear
- "Calculate" button centrally located

---

## 💾 How to Use This Document

### For Claude Code:
1. **Reference this when building UI components**
2. **Copy exact class names for consistency**
3. **Use same component patterns** (NumericInput, etc.)
4. **Maintain responsive behavior**
5. **Preserve accessibility features**

### For You:
1. **Point Claude Code to specific sections** when asking for UI work
2. **Reference legacy code** if Claude Code needs exact implementation
3. **Test against this spec** to ensure nothing lost in translation

---

## 📝 Summary

Your current UI is:
- ✅ Clean and professional
- ✅ User-tested and approved
- ✅ Responsive and accessible
- ✅ Well-organized (clear hierarchy)

**Recommendation:** Keep the `legacy/` folder as a **UI reference** for Claude Code. The business logic can be rewritten, but the UI patterns should be preserved.

---

**This document ensures Claude Code recreates your working UI in the new system while improving the underlying code architecture.**
