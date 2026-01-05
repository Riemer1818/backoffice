-- Business Administration Database Schema

-- My business info
CREATE TABLE business_info (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255) NOT NULL,
    street_address VARCHAR(255),
    postal_code VARCHAR(20),
    city VARCHAR(100),
    phone VARCHAR(50),
    email VARCHAR(255),
    iban VARCHAR(50),
    bic VARCHAR(20),
    kvk_number VARCHAR(50),
    btw_number VARCHAR(50),
    default_payment_terms_days INTEGER DEFAULT 14,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert my business info
INSERT INTO business_info (name, contact_person, street_address, postal_code, city, phone, email, iban, bic, default_payment_terms_days)
VALUES ('Riemer', 'Riemer van der Vliet', 'Bep Bakhuystraat', '1061 ME', 'Amsterdam', '0625236608', 'riemer.vandervliet@live.nl', 'NL02 BUNQ 2175 6803 47', 'BUNQNL2A', 14);

-- Tax rates table (BTW/VAT rates)
CREATE TABLE tax_rates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    rate DECIMAL(5,2) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert Dutch BTW rates
INSERT INTO tax_rates (name, rate, description) VALUES
    ('High BTW 21%', 21.00, 'Standard VAT rate'),
    ('Low BTW 9%', 9.00, 'Reduced VAT rate'),
    ('No BTW 0%', 0.00, 'Zero VAT rate');

-- Income/Sales categories
CREATE TABLE income_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Expense categories
CREATE TABLE expense_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert some default categories
INSERT INTO income_categories (name, description) VALUES
    ('Consulting', 'Consulting services'),
    ('Development', 'Software development'),
    ('Design', 'Design services'),
    ('Other', 'Other income');

INSERT INTO expense_categories (name, description) VALUES
    ('Office', 'Office supplies and equipment'),
    ('Software', 'Software subscriptions and licenses'),
    ('Travel', 'Travel expenses'),
    ('Marketing', 'Marketing and advertising'),
    ('Professional Services', 'Legal, accounting, etc'),
    ('Other', 'Other expenses');

-- Contacts/Relationships (clients, suppliers, partners)
CREATE TABLE contacts (
    id SERIAL PRIMARY KEY,
    type VARCHAR(50) NOT NULL, -- 'client', 'supplier', 'partner'
    company_name VARCHAR(255),
    contact_person VARCHAR(255),
    street_address VARCHAR(255),
    postal_code VARCHAR(20),
    city VARCHAR(100),
    country VARCHAR(100) DEFAULT 'Netherlands',
    phone VARCHAR(50),
    email VARCHAR(255),
    vat_number VARCHAR(50),
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Projects/Gigs
CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    client_id INTEGER REFERENCES contacts(id),
    description TEXT,
    hourly_rate DECIMAL(10,2),
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'completed', 'on_hold'
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Time tracking
CREATE TABLE time_entries (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id),
    contact_id INTEGER REFERENCES contacts(id),
    date DATE NOT NULL,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    total_hours DECIMAL(5,2) NOT NULL,
    chargeable_hours DECIMAL(5,2) NOT NULL,
    location VARCHAR(255),
    objective TEXT,
    notes TEXT,
    is_invoiced BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Income/Sales table
CREATE TABLE income (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    contact_id INTEGER REFERENCES contacts(id),
    project_id INTEGER REFERENCES projects(id),
    category_id INTEGER REFERENCES income_categories(id),
    description TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    tax_rate_id INTEGER REFERENCES tax_rates(id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Expenses table
CREATE TABLE expenses (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    contact_id INTEGER REFERENCES contacts(id),
    category_id INTEGER REFERENCES expense_categories(id),
    description TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    tax_rate_id INTEGER REFERENCES tax_rates(id),
    receipt_path VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Invoices/Factures table
CREATE TABLE invoices (
    id SERIAL PRIMARY KEY,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    contact_id INTEGER REFERENCES contacts(id),
    project_id INTEGER REFERENCES projects(id),
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'sent', 'paid', 'overdue', 'cancelled'
    subtotal DECIMAL(10,2) NOT NULL,
    tax_amount DECIMAL(10,2) NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    payment_terms_days INTEGER DEFAULT 14,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Invoice line items
CREATE TABLE invoice_items (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity DECIMAL(10,2) DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    tax_rate_id INTEGER REFERENCES tax_rates(id),
    subtotal DECIMAL(10,2) NOT NULL,
    tax_amount DECIMAL(10,2) NOT NULL,
    line_total DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- VAT payments tracking
CREATE TABLE vat_payments (
    id SERIAL PRIMARY KEY,
    payment_date DATE NOT NULL,
    period_year INTEGER NOT NULL,
    period_quarter INTEGER CHECK (period_quarter BETWEEN 1 AND 4),
    high_rate_vat DECIMAL(10,2) DEFAULT 0.00,
    low_rate_vat DECIMAL(10,2) DEFAULT 0.00,
    input_vat DECIMAL(10,2) DEFAULT 0.00,
    net_amount DECIMAL(10,2) NOT NULL,
    payment_reference VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_contacts_type ON contacts(type);
CREATE INDEX idx_contacts_active ON contacts(is_active);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_time_entries_date ON time_entries(date);
CREATE INDEX idx_time_entries_project ON time_entries(project_id);
CREATE INDEX idx_time_entries_invoiced ON time_entries(is_invoiced);
CREATE INDEX idx_income_date ON income(date);
CREATE INDEX idx_income_contact ON income(contact_id);
CREATE INDEX idx_expenses_date ON expenses(date);
CREATE INDEX idx_expenses_category ON expenses(category_id);
CREATE INDEX idx_invoices_date ON invoices(invoice_date);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_contact ON invoices(contact_id);
CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX idx_vat_payments_period ON vat_payments(period_year, period_quarter);
