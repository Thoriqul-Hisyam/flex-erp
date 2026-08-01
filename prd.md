# ERP Platform

## Product Requirements Document (PRD)

**Version:** 1.0\
**Status:** Draft\
**Architecture:** Full Next.js

------------------------------------------------------------------------

# Executive Summary

ERP Platform adalah aplikasi Enterprise Resource Planning (ERP) modern
berbasis **Full Next.js** yang dirancang sebagai SaaS Multi-Tenant untuk
mendukung UMKM hingga Enterprise.

## Vision

Membangun ERP modern yang cepat, modular, scalable, dan mudah digunakan.

## Mission

-   Mengintegrasikan seluruh proses bisnis.
-   Mengurangi pekerjaan manual.
-   Menyediakan data real-time.
-   Menjadi platform ERP modern berbasis web.

# Product Goals

-   Multi Company
-   Multi Branch
-   Multi Warehouse
-   API First
-   Modular Architecture
-   Enterprise Ready

# Target Market

-   UMKM
-   Retail
-   Distributor
-   Manufacture
-   Jasa
-   Corporate

# Tech Stack

## Frontend & Backend

-   Next.js 16
-   React 19
-   TypeScript
-   App Router
-   Server Components
-   Server Actions

## UI

-   Tailwind CSS 4
-   shadcn/ui
-   Radix UI
-   Lucide Icons
-   Framer Motion

## Data

-   PostgreSQL
-   Drizzle ORM
-   Better Auth
-   Redis
-   Trigger.dev
-   S3 Compatible Storage

# Core Modules

## Master Data

-   Company
-   Branch
-   Warehouse
-   Customer
-   Supplier
-   Product
-   Category
-   Unit
-   Currency
-   Tax
-   User
-   Role
-   Permission

## Sales

Quotation → Sales Order → Delivery → Invoice → Payment → Return

## Purchasing

Purchase Request → RFQ → Purchase Order → Receiving → Supplier Invoice →
Payment

## Inventory

-   Stock In
-   Stock Out
-   Transfer
-   Adjustment
-   Stock Opname
-   Batch & Expired Date

## Finance

-   Cash
-   Bank
-   Expense
-   Income
-   Budget

## Accounting

-   Chart of Accounts
-   Journal
-   General Ledger
-   Trial Balance
-   Profit & Loss
-   Balance Sheet
-   Cash Flow

## CRM

-   Lead
-   Opportunity
-   Pipeline
-   Activity
-   Meeting

## HR

-   Employee
-   Attendance
-   Leave
-   Payroll

## Manufacturing

-   BOM
-   Work Order
-   Production
-   QC

# Dashboard

Role-based dashboard: - Owner - Finance - Sales - Warehouse - HR -
Manager

# Design Philosophy

-   **UVentra Luminous Modern SaaS Aesthetic**: Ultra-clean, spacious layout featuring soft rounded card containers (`rounded-3xl` / `24px` radius) and soft pastel canvas backgrounds.
-   **Floating Pill Controls**: Floating pill tabs for brand badges, active window tabs, user profile drawers, navigation toolbars, and theme switchers.
-   **Exact Color Tokens**: Electric Sky Blue (`#0088ff`), Emerald Green (`#10b981`), Warning Amber (`#f59e0b`), Alert Red (`#ef4444`), Purple (`#8a2be2`), and Cyan (`#00b4d8`).
-   **Dual Light / Dark Mode**: Full support for Luminous Light (`#eceff4`) and Deep Dark Slate (`#090c10`) themes.
-   **Data First & High Clarity**: Monospaced tabular numbers (`.font-mono-num`) for currency, prices, stock quantities, and SKU codes.
-   **Interactive Data Visualizations**: Grouped vertical pill bar charts with hover tooltips and radial sales goal arc gauge meters.
-   **Compact Tables & Cards**: Rounded data grid containers with filter & export pill toolbars, circular pagination controls, and action drawers.
-   **Detailed Specification**: See [design.md](file:///d:/Data/Document/Hisyam/erp-next/design.md) for complete visual design system documentation.

# Non Functional Requirements

-   Response \< 300ms
-   99.9% uptime
-   Audit Log
-   Approval Workflow
-   REST API
-   Import/Export Excel
-   PDF Reporting

# Roadmap

## Phase 1

Authentication, RBAC, Company, Master Data

## Phase 2

Sales, Purchasing, Inventory

## Phase 3

Finance, Accounting

## Phase 4

CRM, HR, Payroll

## Phase 5

Manufacturing, POS, Project, Asset, Helpdesk
