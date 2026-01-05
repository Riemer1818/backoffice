-- ============================================
-- MIGRATION: Add Tax Calculation System
-- Dutch income tax brackets and VAT settlement tracking
-- ============================================

BEGIN;

-- ============================================
-- TAX CONFIGURATION TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS tax_config (
    id SERIAL PRIMARY KEY,
    year INTEGER NOT NULL UNIQUE,

    -- Income tax brackets (Dutch "Inkomstenbelasting")
    -- Box 1: Income from work and home
    bracket_1_limit DECIMAL(10,2) NOT NULL DEFAULT 75518,    -- 2025: up to €75,518
    bracket_1_rate DECIMAL(5,2) NOT NULL DEFAULT 36.97,      -- 36.97%

    bracket_2_limit DECIMAL(10,2) NOT NULL DEFAULT 1000000,  -- Above €75,518
    bracket_2_rate DECIMAL(5,2) NOT NULL DEFAULT 49.50,      -- 49.50%

    -- Self-employed deductions
    self_employed_deduction DECIMAL(10,2) NOT NULL DEFAULT 2470,  -- "Zelfstandigenaftrek" 2025
    startup_deduction DECIMAL(10,2) DEFAULT 2123,                 -- "Startersaftrek" (first 3 years)
    mkb_profit_exemption DECIMAL(5,2) NOT NULL DEFAULT 12.7,      -- "MKB-winstvrijstelling" 12.7%
    small_business_scheme BOOLEAN DEFAULT true,                    -- "Kleineondernemersregeling" (KOR)

    -- Social security premiums (rough estimate)
    -- These are included in the 36.97% rate above, but tracked separately for clarity
    aow_rate DECIMAL(5,2) DEFAULT 17.90,        -- State pension
    wlz_rate DECIMAL(5,2) DEFAULT 9.65,         -- Long-term care

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Insert 2025 tax config
INSERT INTO tax_config (year, bracket_1_limit, bracket_1_rate, bracket_2_limit, bracket_2_rate, self_employed_deduction, startup_deduction, mkb_profit_exemption)
VALUES (2025, 75518, 36.97, 1000000, 49.50, 2470, 2123, 12.7)
ON CONFLICT (year) DO NOTHING;

-- ============================================
-- VAT PAYMENT TRACKING (table already exists)
-- Using existing vat_payments table with columns:
-- - period_year, period_quarter
-- - net_amount (amount paid to tax office)
-- ============================================

-- ============================================
-- INCOME TAX CALCULATION VIEW
-- Calculate actual tax owed based on profit
-- ============================================

CREATE OR REPLACE VIEW income_tax_calculation AS
WITH yearly_profit AS (
    SELECT
        EXTRACT(YEAR FROM period) as year,
        SUM(profit_excl_vat) as gross_profit
    FROM profit_loss_summary
    GROUP BY EXTRACT(YEAR FROM period)
),
tax_calc AS (
    SELECT
        yp.year,
        yp.gross_profit,
        tc.self_employed_deduction,
        tc.startup_deduction,
        tc.mkb_profit_exemption,

        -- Step 1: Deduct self-employed deductions
        GREATEST(0, yp.gross_profit - tc.self_employed_deduction - COALESCE(tc.startup_deduction, 0)) as profit_after_deductions,

        -- Step 2: Apply MKB profit exemption (12.7%)
        GREATEST(0, yp.gross_profit - tc.self_employed_deduction - COALESCE(tc.startup_deduction, 0)) * (tc.mkb_profit_exemption / 100) as mkb_exemption_amount,

        -- Step 3: Taxable income after all deductions
        GREATEST(0,
            GREATEST(0, yp.gross_profit - tc.self_employed_deduction - COALESCE(tc.startup_deduction, 0))
            - (GREATEST(0, yp.gross_profit - tc.self_employed_deduction - COALESCE(tc.startup_deduction, 0)) * (tc.mkb_profit_exemption / 100))
        ) as taxable_income,

        -- Tax bracket 1 (up to limit)
        tc.bracket_1_limit,
        tc.bracket_1_rate,

        -- Tax bracket 2 (above limit)
        tc.bracket_2_limit,
        tc.bracket_2_rate,

        -- Calculate tax per bracket on taxable income
        LEAST(
            GREATEST(0,
                GREATEST(0, yp.gross_profit - tc.self_employed_deduction - COALESCE(tc.startup_deduction, 0))
                - (GREATEST(0, yp.gross_profit - tc.self_employed_deduction - COALESCE(tc.startup_deduction, 0)) * (tc.mkb_profit_exemption / 100))
            ),
            tc.bracket_1_limit
        ) * (tc.bracket_1_rate / 100) as tax_bracket_1,

        GREATEST(
            0,
            GREATEST(0,
                GREATEST(0, yp.gross_profit - tc.self_employed_deduction - COALESCE(tc.startup_deduction, 0))
                - (GREATEST(0, yp.gross_profit - tc.self_employed_deduction - COALESCE(tc.startup_deduction, 0)) * (tc.mkb_profit_exemption / 100))
            ) - tc.bracket_1_limit
        ) * (tc.bracket_2_rate / 100) as tax_bracket_2

    FROM yearly_profit yp
    LEFT JOIN tax_config tc ON tc.year = yp.year
)
SELECT
    year,
    gross_profit,
    self_employed_deduction,
    startup_deduction,
    mkb_profit_exemption,
    profit_after_deductions,
    mkb_exemption_amount,
    taxable_income,
    bracket_1_limit,
    bracket_1_rate,
    tax_bracket_1,
    bracket_2_rate,
    tax_bracket_2,
    tax_bracket_1 + tax_bracket_2 as total_income_tax,

    -- Effective tax rate (on gross profit)
    CASE
        WHEN gross_profit > 0
        THEN ((tax_bracket_1 + tax_bracket_2) / gross_profit * 100)
        ELSE 0
    END as effective_tax_rate,

    -- Net profit after tax
    gross_profit - (tax_bracket_1 + tax_bracket_2) as net_profit_after_tax

FROM tax_calc
ORDER BY year DESC;

-- ============================================
-- VAT SETTLEMENT VIEW
-- Track VAT owed/to receive including payments
-- ============================================

CREATE OR REPLACE VIEW vat_settlement AS
WITH vat_calc AS (
    SELECT
        vd.year,
        vd.quarter,
        vd.period,
        vd.high_rate_revenue,
        vd.high_rate_vat_collected,
        vd.low_rate_revenue,
        vd.low_rate_vat_collected,
        vd.zero_rate_revenue,
        vd.input_vat,
        vd.net_vat_to_pay,

        -- Payments made (using existing table structure)
        COALESCE(vp.net_amount, 0) as amount_paid,
        vp.payment_date,

        -- Calculate balance (net_vat_to_pay minus what was actually paid)
        vd.net_vat_to_pay - COALESCE(vp.net_amount, 0) as balance

    FROM vat_declaration vd
    LEFT JOIN vat_payments vp ON vd.year = vp.period_year AND vd.quarter = vp.period_quarter
)
SELECT
    year,
    quarter,
    period,
    high_rate_revenue,
    high_rate_vat_collected,
    low_rate_revenue,
    low_rate_vat_collected,
    zero_rate_revenue,
    input_vat,
    net_vat_to_pay,
    amount_paid,
    payment_date,
    balance,

    -- Status
    CASE
        WHEN balance > 0 THEN 'owed_to_tax_office'
        WHEN balance < 0 THEN 'tax_office_owes_you'
        ELSE 'settled'
    END as status,

    -- For tax return tracking: how much you'll get back
    CASE
        WHEN balance < 0 THEN ABS(balance)
        ELSE 0
    END as expected_refund

FROM vat_calc
ORDER BY year DESC, quarter DESC;

-- ============================================
-- TAX SUMMARY VIEW (Combined overview)
-- ============================================

CREATE OR REPLACE VIEW tax_summary AS
WITH current_year AS (
    SELECT EXTRACT(YEAR FROM CURRENT_DATE) as year
),
income_tax AS (
    SELECT
        year,
        gross_profit,
        taxable_income,
        total_income_tax,
        effective_tax_rate
    FROM income_tax_calculation
    WHERE year = (SELECT year FROM current_year)
),
vat_outstanding AS (
    SELECT
        SUM(CASE WHEN balance > 0 THEN balance ELSE 0 END) as vat_to_pay,
        SUM(CASE WHEN balance < 0 THEN ABS(balance) ELSE 0 END) as vat_to_receive
    FROM vat_settlement
    WHERE year = (SELECT year FROM current_year)
),
total_tax_burden AS (
    SELECT
        it.total_income_tax + vo.vat_to_pay as total_tax_liability,
        vo.vat_to_receive as total_tax_credit
    FROM income_tax it
    CROSS JOIN vat_outstanding vo
)
SELECT
    (SELECT year FROM current_year) as year,
    (SELECT gross_profit FROM income_tax) as gross_profit,
    (SELECT taxable_income FROM income_tax) as taxable_income,
    (SELECT total_income_tax FROM income_tax) as income_tax_owed,
    (SELECT effective_tax_rate FROM income_tax) as effective_tax_rate,
    (SELECT vat_to_pay FROM vat_outstanding) as vat_to_pay,
    (SELECT vat_to_receive FROM vat_outstanding) as vat_to_receive,
    (SELECT total_tax_liability FROM total_tax_burden) as total_tax_liability,
    (SELECT total_tax_credit FROM total_tax_burden) as total_tax_credit,
    (SELECT total_tax_liability FROM total_tax_burden) - (SELECT total_tax_credit FROM total_tax_burden) as net_tax_position;

COMMIT;

-- ============================================
-- USAGE EXAMPLES
-- ============================================

\echo ''
\echo '✅ Tax calculation views created!'
\echo ''
\echo 'Views available:'
\echo '  - income_tax_calculation: Yearly tax breakdown by bracket'
\echo '  - vat_settlement: Quarterly VAT owed/received with payments'
\echo '  - tax_summary: Overall tax position for current year'
\echo ''
\echo 'Tables available:'
\echo '  - tax_config: Configure tax brackets per year'
\echo '  - vat_payments: Track actual VAT payments/refunds'
\echo ''
\echo 'Try:'
\echo '  SELECT * FROM income_tax_calculation;'
\echo '  SELECT * FROM vat_settlement;'
\echo '  SELECT * FROM tax_summary;'
\echo ''
