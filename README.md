# Backoffice - Business Administration System

Clean, hierarchical business administration system for managing clients, projects, time tracking, invoicing, and expenses.

## 🎯 What We Built

### ✅ **Fresh Database Schema V2**
- Clean PostgreSQL schema with proper hierarchy
- 13 tables with optimized indexes
- Income/expense views for reporting
- Located in: `sql/init.sql`

### ✅ **TypeScript Models (Bottom-Up)**
All models built with:
- **Zod schemas** for validation (`models/schemas/`)
- **Entity classes** with business logic (`models/`)
- **Type safety** throughout

**Core Models:**
- `Company` - Clients & suppliers
- `Contact` - People within companies
- `Project` - Client projects
- `TimeEntry` - Time tracking with timezone support
- `Invoice` - Outgoing invoices
- `InvoiceItem` - Invoice line items
- `IncomingInvoice` - Supplier invoices (with review workflow)

### ✅ **Repositories**
Data access layer with:
- `BaseRepository` - Common CRUD operations
- `CompanyRepository` - Client/supplier management
- `ProjectRepository` - Project queries
- Type-safe database operations

### ✅ **Seeded Data**
Migrated from backup:
- 3 companies (2 clients + Internal)
- 5 projects
- 9 time entries

## 📁 Project Structure

```
backoffice/
├── models/                    # TypeScript models
│   ├── schemas/              # Zod validation schemas
│   └── *.ts                  # Model classes
├── repositories/              # Data access layer
├── core/                      # Core functionality
│   ├── email/                # Email processing
│   ├── llm/                  # LLM extraction
│   └── parsers/              # Invoice parsers
├── apps/                      # Standalone apps
├── sql/                       # Database
│   ├── init.sql              # Fresh schema
│   └── seed_from_backup.sql  # Seed data
└── supabase/                  # Local Supabase
```

## 🗄️ Database Hierarchy

```
companies (clients/suppliers)
  ├── contacts (people)
  ├── projects
  │   ├── time_entries (timezone support!)
  │   └── invoices (outgoing) → income view
  │
  └── incoming_invoices (review workflow) → expenses view
      └── receipts
```

## 🚀 Quick Start

### 1. Start Database
```bash
supabase start
```

### 2. View Data
```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
```

### 3. Supabase Studio
Open: http://127.0.0.1:54323

## 📊 Seeded Data

- **2 Clients**: Joosten Investments B.V., Moods AI B.V. i.o.
- **1 Internal**: Internal / Personal Projects
- **5 Projects**: Including moodsAI-MVP, participatie-ai, riemer FYI
- **9 Time Entries**: Mix of invoiced and non-invoiced

---

**Status:** ✅ Fresh, clean, ready to build!
