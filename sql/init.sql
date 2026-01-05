-- ============================================
-- BACKOFFICE DATABASE SCHEMA V2
-- Clean hierarchical design for business administration
-- ============================================

-- ============================================
-- CORE ENTITIES
-- ============================================

-- Your business information (singleton)
CREATE TABLE business_info (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    kvk_number VARCHAR(50),
    btw_number VARCHAR(50),

    -- Contact
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),

    -- Address
    street_address VARCHAR(255),
    postal_code VARCHAR(20),
    city VARCHAR(100),
    country VARCHAR(100) DEFAULT 'Netherlands',

    -- Banking
    iban VARCHAR(50),
    bic VARCHAR(20),

    -- Defaults
    default_payment_terms_days INTEGER DEFAULT 14,
    default_currency VARCHAR(3) DEFAULT 'EUR',

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Insert your business info
INSERT INTO business_info (name, street_address, postal_code, city, phone, email, iban, bic, default_payment_terms_days)
VALUES ('Riemer', 'Bep Bakhuystraat', '1061 ME', 'Amsterdam', '0625236608', 'riemer.vandervliet@live.nl', 'NL02 BUNQ 2175 6803 47', 'BUNQNL2A', 14);

-- Tax/VAT rates
CREATE TABLE tax_rates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    rate DECIMAL(5,2) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Insert Dutch BTW rates
INSERT INTO tax_rates (name, rate, description) VALUES
    ('High BTW 21%', 21.00, 'Standard VAT rate'),
    ('Low BTW 9%', 9.00, 'Reduced VAT rate'),
    ('Zero BTW 0%', 0.00, 'Zero VAT rate');

-- ============================================
-- COMPANIES & CONTACTS
-- ============================================

-- Companies (clients, suppliers, or both)
CREATE TABLE companies (
    id SERIAL PRIMARY KEY,

    -- Type
    type VARCHAR(20) NOT NULL CHECK (type IN ('client', 'supplier', 'both')),

    -- Basic info
    name VARCHAR(255) NOT NULL,
    kvk_number VARCHAR(50),
    btw_number VARCHAR(50),

    -- Main contact person (especially for clients)
    main_contact_person VARCHAR(255),

    -- Contact
    email VARCHAR(255),
    phone VARCHAR(50),
    website VARCHAR(255),

    -- Address
    street_address VARCHAR(255),
    postal_code VARCHAR(20),
    city VARCHAR(100),
    country VARCHAR(100) DEFAULT 'Netherlands',

    -- Banking
    iban VARCHAR(50),

    -- Metadata
    notes TEXT,
    is_active BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- People/Contacts within companies
CREATE TABLE contacts (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(100),

    email VARCHAR(255),
    phone VARCHAR(50),

    is_primary BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,

    notes TEXT,

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- PROJECTS & TIME TRACKING
-- ============================================

-- Projects (belong to client companies)
CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,

    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Pricing
    hourly_rate DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'EUR',
    tax_rate_id INTEGER REFERENCES tax_rates(id),

    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'on_hold', 'completed', 'cancelled', 'archived')),

    -- Timeline
    start_date DATE,
    end_date DATE,

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Time entries
CREATE TABLE time_entries (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,

    -- Date & time
    date DATE NOT NULL,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,

    -- Hours
    total_hours DECIMAL(5,2) NOT NULL,
    chargeable_hours DECIMAL(5,2) NOT NULL,

    -- Details
    location VARCHAR(255),
    objective TEXT,
    notes TEXT,

    -- Invoicing
    is_invoiced BOOLEAN DEFAULT false,

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- OUTGOING INVOICES (YOU → CLIENTS)
-- ============================================

-- Outgoing invoices (you → clients)
CREATE TABLE invoices (
    id SERIAL PRIMARY KEY,

    -- References
    client_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,

    -- Invoice details
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,

    -- Status
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),

    -- Amounts
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'EUR',

    -- Payment
    payment_terms_days INTEGER DEFAULT 14,
    paid_date DATE,

    -- Files
    pdf_file BYTEA,

    notes TEXT,

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Invoice line items
CREATE TABLE invoice_items (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,

    description TEXT NOT NULL,
    quantity DECIMAL(10,2) DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,

    tax_rate_id INTEGER REFERENCES tax_rates(id),

    -- Calculated
    subtotal DECIMAL(10,2) NOT NULL,
    tax_amount DECIMAL(10,2) NOT NULL,
    line_total DECIMAL(10,2) NOT NULL,

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Link time entries to invoices
CREATE TABLE invoice_time_entries (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    time_entry_id INTEGER NOT NULL REFERENCES time_entries(id) ON DELETE CASCADE,

    UNIQUE(invoice_id, time_entry_id)
);

-- Add invoice_id foreign key to time_entries (now that invoices table exists)
ALTER TABLE time_entries ADD COLUMN invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL;

-- ============================================
-- INCOMING INVOICES & EXPENSES (SUPPLIERS → YOU)
-- ============================================

-- Expense categories
CREATE TABLE expense_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Default expense categories
INSERT INTO expense_categories (name, description) VALUES
    ('Office Supplies', 'Office supplies and equipment'),
    ('Software & Subscriptions', 'Software licenses and subscriptions'),
    ('Travel & Transport', 'Travel and transportation costs'),
    ('Marketing & Advertising', 'Marketing and promotional expenses'),
    ('Professional Services', 'Legal, accounting, consulting'),
    ('Utilities', 'Internet, phone, electricity'),
    ('Insurance', 'Business insurance'),
    ('Equipment', 'Hardware and equipment'),
    ('Other', 'Miscellaneous expenses');

-- Incoming invoices (suppliers → you)
-- Flow: Email → LLM Extraction → Pending Review → You Review/Edit → Approved/Rejected
CREATE TABLE incoming_invoices (
    id SERIAL PRIMARY KEY,

    -- References (can be NULL until reviewed if LLM couldn't match)
    supplier_id INTEGER REFERENCES companies(id) ON DELETE RESTRICT,
    project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL, -- optional: expense for specific project

    -- Invoice details (extracted by LLM, editable during review)
    invoice_number VARCHAR(100), -- their invoice number
    invoice_date DATE,
    due_date DATE,

    -- Review workflow
    review_status VARCHAR(20) DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected')),
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,

    -- Payment status (separate from review)
    payment_status VARCHAR(20) DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid')),
    paid_date DATE,

    -- Amounts (extracted by LLM, editable during review)
    subtotal DECIMAL(10,2) DEFAULT 0,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'EUR',
    tax_rate_id INTEGER REFERENCES tax_rates(id),

    -- Category (suggested by LLM, editable during review)
    category_id INTEGER REFERENCES expense_categories(id),

    -- Extracted/editable fields
    supplier_name VARCHAR(255), -- extracted supplier name (before matching to company)
    description TEXT,
    notes TEXT,

    -- Files
    invoice_file BYTEA,
    invoice_file_name VARCHAR(255),
    invoice_file_type VARCHAR(50),

    -- Source tracking (from email extraction)
    source VARCHAR(50) DEFAULT 'email', -- 'email', 'manual', 'upload'
    source_email_id VARCHAR(255),
    source_email_subject VARCHAR(500),
    source_email_from VARCHAR(255),
    source_email_date TIMESTAMPTZ,

    -- LLM extraction metadata
    extraction_errors TEXT, -- any issues during extraction

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Receipts/additional documents attached to incoming invoices
CREATE TABLE receipts (
    id SERIAL PRIMARY KEY,
    incoming_invoice_id INTEGER NOT NULL REFERENCES incoming_invoices(id) ON DELETE CASCADE,

    file_name VARCHAR(255) NOT NULL,
    file_data BYTEA NOT NULL,
    file_type VARCHAR(50),
    file_size INTEGER,

    description TEXT,

    uploaded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INCOME & EXPENSE VIEWS (REPORTING)
-- ============================================

-- Income (generated from sent/paid invoices)
CREATE VIEW income AS
SELECT
    i.id,
    i.client_id as company_id,
    i.project_id,
    i.invoice_date as date,
    i.invoice_number as reference,
    i.subtotal,
    i.tax_amount,
    i.total_amount,
    i.currency,
    i.status,
    'invoice' as source_type,
    i.created_at
FROM invoices i
WHERE i.status NOT IN ('draft', 'cancelled');

-- Expenses (generated from approved incoming invoices)
CREATE VIEW expenses AS
SELECT
    ii.id,
    ii.supplier_id as company_id,
    ii.project_id,
    ii.category_id,
    ii.invoice_date as date,
    ii.invoice_number as reference,
    ii.subtotal,
    ii.tax_amount,
    ii.total_amount,
    ii.currency,
    ii.review_status,
    ii.payment_status,
    'incoming_invoice' as source_type,
    ii.created_at
FROM incoming_invoices ii
WHERE ii.review_status = 'approved';

-- ============================================
-- VAT/TAX TRACKING
-- ============================================

-- VAT payments
CREATE TABLE vat_payments (
    id SERIAL PRIMARY KEY,

    payment_date DATE NOT NULL,
    period_year INTEGER NOT NULL,
    period_quarter INTEGER CHECK (period_quarter BETWEEN 1 AND 4),

    -- VAT breakdown
    high_rate_vat DECIMAL(10,2) DEFAULT 0.00, -- 21% collected
    low_rate_vat DECIMAL(10,2) DEFAULT 0.00,  -- 9% collected
    input_vat DECIMAL(10,2) DEFAULT 0.00,     -- VAT on expenses

    net_amount DECIMAL(10,2) NOT NULL,        -- amount to pay/receive

    payment_reference VARCHAR(100),
    notes TEXT,

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Companies
CREATE INDEX idx_companies_type ON companies(type);
CREATE INDEX idx_companies_active ON companies(is_active);
CREATE INDEX idx_companies_name ON companies(name);

-- Contacts
CREATE INDEX idx_contacts_company ON contacts(company_id);
CREATE INDEX idx_contacts_active ON contacts(is_active);
CREATE INDEX idx_contacts_primary ON contacts(is_primary);

-- Projects
CREATE INDEX idx_projects_client ON projects(client_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_dates ON projects(start_date, end_date);

-- Time entries
CREATE INDEX idx_time_entries_project ON time_entries(project_id);
CREATE INDEX idx_time_entries_date ON time_entries(date);
CREATE INDEX idx_time_entries_invoiced ON time_entries(is_invoiced);

-- Invoices
CREATE INDEX idx_invoices_client ON invoices(client_id);
CREATE INDEX idx_invoices_project ON invoices(project_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_date ON invoices(invoice_date);
CREATE INDEX idx_invoices_number ON invoices(invoice_number);

-- Incoming invoices
CREATE INDEX idx_incoming_invoices_supplier ON incoming_invoices(supplier_id);
CREATE INDEX idx_incoming_invoices_project ON incoming_invoices(project_id);
CREATE INDEX idx_incoming_invoices_review ON incoming_invoices(review_status);
CREATE INDEX idx_incoming_invoices_payment ON incoming_invoices(payment_status);
CREATE INDEX idx_incoming_invoices_date ON incoming_invoices(invoice_date);
CREATE INDEX idx_incoming_invoices_category ON incoming_invoices(category_id);
CREATE INDEX idx_incoming_invoices_source ON incoming_invoices(source);

-- VAT payments
CREATE INDEX idx_vat_payments_period ON vat_payments(period_year, period_quarter);