-- Create VAT payments tracking table
CREATE TABLE IF NOT EXISTS vat_payments (
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

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_vat_payments_period ON vat_payments(period_year, period_quarter);
