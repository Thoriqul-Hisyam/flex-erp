# Global CRUD Consistency & Architecture Guidelines

## Overview
This document specifies the standard conventions and pattern definitions for maintaining 100% architectural consistency across all Master Data and Transactional CRUD modules in the ERP Platform.

---

## 1. Unified Component Architecture (`MasterDataPage<T>`)

Every Master Data entity page (Companies, Branches, Warehouses, Customers, Suppliers, Products, Taxes) MUST inherit from the global `MasterDataPage<T>` generic component located at `[master-data-page.tsx](file:///d:/Data/Document/Hisyam/erp-next/components/crud/master-data-page.tsx)`.

### Core Features Handled Automatically:
1. **Header Banner**: Entity title, record counter badge, description, and primary `+ Add [Entity]` action button.
2. **KPI Summary Ribbon**: Total records, active count, and inactive count with live visual status badges.
3. **Enterprise Data Grid (`DataTable`)**:
   - Live multi-column search filtering.
   - Column sorting with ascending/descending indicators.
   - Fixed monospace formatting for codes, financial amounts, and tax numbers (`font-mono-num`).
   - Page size controls and pagination footer.
   - Contextual actions column (Edit, Delete).
4. **Modal Form Dialog**: Dynamic form rendering based on `createFields` definitions supporting text inputs, email, numbers, selects, and textareas with standard validation.
5. **Centralized Audit Trail**: Automatic execution of `logAuditEvent()` on every `CREATE`, `UPDATE`, and `DELETE` operation.

---

## 2. Standard Entity Interface Contract (`MasterDataItem`)

All enterprise domain entities must fulfill the base constraint:

```typescript
export interface MasterDataItem {
  id: string;
  code: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
  [key: string]: any;
}
```

---

## 3. Data Formatting & Design Conventions (Linear × Stripe × SAP Fiori)
- **Codes & SKUs**: Rendered in uppercase bold monospace (`font-mono text-white`).
- **Currency Amounts**: Formatted using `formatCurrency(amount)` with `font-mono-num text-emerald-400` or `text-amber-400`.
- **Status Badges**:
  - `ACTIVE` / `COMPLETED` / `APPROVED` &rarr; `<Badge variant="success">`
  - `INACTIVE` / `VOID` / `CANCELLED` &rarr; `<Badge variant="secondary">`
  - `PENDING` / `WARNING` &rarr; `<Badge variant="warning">`

---

## 4. How to Create a New CRUD Module in < 3 Minutes

```tsx
"use client";

import { MasterDataPage } from "@/components/crud/master-data-page";
import { Column } from "@/components/ui/data-table";

interface CategoryItem {
  id: string;
  code: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
}

export default function CategoriesPage() {
  const columns: Column<CategoryItem>[] = [
    { key: "code", header: "Category Code", sortable: true, accessor: (item) => <span className="font-mono font-bold text-white">{item.code}</span> },
    { key: "name", header: "Category Name", sortable: true, accessor: (item) => item.name },
  ];

  return (
    <MasterDataPage<CategoryItem>
      title="Product Categories"
      entityName="Category"
      description="Manage product taxonomy and category groupings."
      columns={columns}
      initialData={[]}
      createFields={[
        { name: "code", label: "Category Code", required: true },
        { name: "name", label: "Category Name", required: true },
      ]}
    />
  );
}
```
