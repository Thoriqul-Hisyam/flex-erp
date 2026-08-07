# Flex ERP

## Product Requirements Document (PRD)

**Version:** 1.1  
**Status:** Draft - Internal ERP Scope  
**Architecture:** Full Next.js  
**Product Type:** Custom Internal ERP

---

# Executive Summary

Flex ERP adalah aplikasi Enterprise Resource Planning (ERP) internal berbasis
**Full Next.js** untuk mendukung operasional perusahaan secara terintegrasi.
Produk ini tidak diposisikan sebagai SaaS publik, melainkan sebagai sistem
internal yang disesuaikan dengan proses bisnis perusahaan.

Fokus utama produk adalah menghubungkan master data, penjualan, pembelian,
persediaan, approval, audit, dan laporan operasional agar pekerjaan harian tim
menjadi lebih cepat, rapi, dan dapat ditelusuri.

# Vision

Membangun ERP internal yang cepat, modular, mudah digunakan, dan cukup kuat
untuk menangani operasi multi-company, multi-branch, dan multi-warehouse.

# Mission

- Mengintegrasikan proses bisnis utama perusahaan.
- Mengurangi pekerjaan manual dan pencatatan berulang.
- Menyediakan data operasional yang real-time dan bisa dipercaya.
- Memperkuat kontrol internal melalui RBAC, approval, dan audit log.
- Menyediakan dokumen dan laporan yang siap dipakai oleh tim operasional.

# Product Goals

- Multi Company
- Multi Branch
- Multi Warehouse
- Role-Based Access Control
- Approval Workflow
- Audit Trail
- Modular Architecture
- Internal Reporting
- Import/Export Excel
- PDF/Print Documents

# Target Users

- Owner / Direksi
- Manager Operasional
- Sales
- Purchasing / Procurement
- Warehouse
- Finance
- Admin System

# Scope Positioning

## In Scope

- Internal company operations.
- Company, branch, warehouse, user, role, and master data management.
- Sales, purchasing, and inventory workflows.
- Approval and audit trail for important transactions.
- Operational reports, exports, and printable business documents.
- Single organization deployment with internal access control.

## Out of Scope for Current Roadmap

- Public SaaS onboarding.
- Subscription billing and tenant plans.
- Self-service tenant registration.
- Tenant custom domain management.
- Public marketplace/API monetization.
- Multi-customer SaaS support model.

# Tech Stack

## Frontend & Backend

- Next.js 16
- React 19
- TypeScript
- App Router
- Server Components
- Server Actions

## UI

- Tailwind CSS 4
- shadcn/ui-style components
- Radix UI
- Lucide Icons
- Framer Motion

## Data & Infrastructure

- PostgreSQL
- Drizzle ORM
- Server-side session authentication
- S3-compatible storage, when document/file uploads are needed
- Background jobs, when approval notifications or scheduled reports are needed

# Core Modules

## Phase 1 - Foundation & Master Data

### Authentication & User Management

- Login and logout.
- Secure server-side session.
- User status: active, inactive, blocked.
- User assignment to company, branch, and role.
- Password reset or admin password reset.
- Session expiry and revocation.

### RBAC

- Role management.
- Permission matrix by module/page/action.
- Server-side permission enforcement for read, create, update, delete, approve,
  post, export, and print actions.
- Unauthorized access handling.

### Organization Master

- Company
- Branch
- Warehouse
- Department
- Employee
- Vehicle

### Trading Master

- Customer
- Supplier
- Product
- Product Category
- Unit
- Currency
- Tax

### System Control

- Site settings.
- Audit log for create, update, delete, approve, post, cancel, and login events.
- Internal organization scope using the existing `tenantId` where needed, without
  SaaS-facing tenant features.

## Phase 2 - Sales, Purchasing & Inventory

### Sales

Primary workflow:

`Sales Quotation -> Sales Order -> Delivery Order -> Customer Invoice -> Customer Payment -> Sales Return`

Required capabilities:

- Create and manage sales quotations.
- Convert accepted quotation into sales order.
- Confirm sales order and reserve stock.
- Issue delivery order and reduce stock.
- Create customer invoice.
- Record customer payment.
- Support partial delivery and partial payment.
- Support sales return and stock reversal.
- Support document cancellation with reason and audit trail.
- Print/PDF for quotation, delivery order, and invoice.

### Purchasing

Primary workflow:

`Purchase Request -> Purchase Order -> Goods Receipt -> Supplier Invoice -> Supplier Payment`

Optional/deferred workflow:

`Purchase Request -> RFQ -> Vendor Comparison -> Purchase Order`

Required capabilities:

- Create purchase request.
- Submit, approve, reject, and cancel purchase request.
- Create purchase order from approved request or direct purchase need.
- Issue purchase order.
- Receive goods and increase stock.
- Generate or record supplier invoice.
- Record supplier payment.
- Support partial receipt and partial payment.
- Support cancellation/reversal with reason and audit trail.
- Print/PDF for purchase order and goods receipt.

### Inventory

Required capabilities:

- Stock in.
- Stock out.
- Stock transfer.
- Stock adjustment.
- Stock opname.
- Batch and expiry tracking.
- Warehouse stock balance.
- Immutable stock movement ledger.
- Low stock and reorder signal.
- Negative stock prevention.
- Reversal support for cancelled delivery/receipt transactions.

# Dashboard

Dashboards are role-based and should prioritize operational clarity.

- Owner: business overview, receivable/payable signals, stock value, sales and
  purchasing activity.
- Manager: approvals, pending documents, process bottlenecks.
- Sales: quotation, order, delivery, invoice, payment status.
- Purchasing: PR, PO, receipt, supplier invoice, payment status.
- Warehouse: stock, movement, transfer, opname, batch/expiry alerts.
- Finance: customer invoice, supplier invoice, payment status.
- Admin: users, roles, permissions, audit log.

# Design Philosophy

- **Internal Operations First:** Dense, clear, and fast interfaces for repeated
  daily work.
- **Data First & High Clarity:** Monospaced tabular numbers for currency, prices,
  stock quantities, document numbers, and SKU codes.
- **Role-Aware Navigation:** Users only see modules and actions relevant to their
  role.
- **Compact Tables & Forms:** Optimized for scanning, searching, filtering, and
  fast transaction entry.
- **Dual Light / Dark Mode:** Full support for light and dark themes.
- **Document Readiness:** Transaction pages should support print/PDF output where
  operationally required.
- **Detailed Specification:** See `design.md` for the visual design system.

# Non Functional Requirements

- Fast response for common internal workflows.
- Secure session handling.
- Server-side authorization checks.
- Audit log for critical activities.
- Approval workflow for controlled transactions.
- Import/export Excel or CSV for operational data.
- PDF/print reporting for business documents.
- Database backup and restore procedure.
- Data validation and clear error handling.

# Roadmap

## Phase 1

Authentication, RBAC, internal organization scope, company, branch, warehouse,
system settings, audit log, and master data.

## Phase 2

Sales, purchasing, inventory, stock ledger, batch/expiry, stock opname,
transaction approvals, returns/reversals, exports, and printable documents.

## Phase 3

Finance and accounting foundations: cash/bank, receivable, payable, chart of
accounts, journal, general ledger, trial balance, profit and loss, balance sheet,
and cash flow.

## Phase 4

CRM, HR, attendance, leave, and payroll.

## Phase 5

Manufacturing, POS, project, asset, and helpdesk.

# Phase 1-2 Completion Criteria

Phase 1-2 is considered complete when:

- Users can complete the full sales workflow from quotation to payment and return.
- Users can complete the full purchasing workflow from request to payment.
- Stock balances update correctly from receiving, delivery, transfer, adjustment,
  return, and opname.
- All critical write/post/approve actions are protected by server-side RBAC.
- All critical document status changes are audited.
- Required operational documents can be printed or exported.
- Build, lint, and core business-flow checks pass.
