-- ============================================
-- Remove invoice_items table and update VAT reporting
-- to use invoice header amounts instead
-- ============================================

BEGIN;

-- Drop the view that depends on invoice_items
DROP VIEW IF EXISTS vat_declaration CASCADE;
DROP VIEW IF EXISTS vat_summary_by_quarter CASCADE;

-- Drop triggers on invoice_items
DROP TRIGGER IF EXISTS trigger_recalc_invoice_on_item_change ON invoice_items;
DROP TRIGGER IF EXISTS trigger_calc_invoice_item_totals ON invoice_items;

-- Drop the functions that reference invoice_items
DROP FUNCTION IF EXISTS recalculate_invoice_totals() CASCADE;
DROP FUNCTION IF EXISTS calculate_invoice_item_totals() CASCADE;

-- Drop the invoice_items table
DROP TABLE IF EXISTS invoice_items CASCADE;

-- Recreate vat_summary_by_quarter to use invoice headers instead
CREATE OR REPLACE VIEW vat_summary_by_quarter AS
WITH income_vat AS (
  SELECT
    EXTRACT(YEAR FROM i.invoice_date) as year,
    EXTRACT(QUARTER FROM i.invoice_date) as quarter,
    -- We need to infer tax rate from the invoice
    -- For now, we'll detect it based on the tax_amount/subtotal ratio
    CASE
      WHEN i.subtotal = 0 THEN NULL
      WHEN ROUND((i.tax_amount / i.subtotal * 100)::numeric, 0) = 21 THEN
        (SELECT id FROM tax_rates WHERE rate = 21 LIMIT 1)
      WHEN ROUND((i.tax_amount / i.subtotal * 100)::numeric, 0) = 9 THEN
        (SELECT id FROM tax_rates WHERE rate = 9 LIMIT 1)
      ELSE NULL
    END as tax_rate_id,
    CASE
      WHEN i.subtotal = 0 THEN 0
      ELSE ROUND((i.tax_amount / i.subtotal * 100)::numeric, 0)
    END as tax_rate,
    CASE
      WHEN i.subtotal = 0 THEN 'No VAT'
      WHEN ROUND((i.tax_amount / i.subtotal * 100)::numeric, 0) = 21 THEN 'BTW 21%'
      WHEN ROUND((i.tax_amount / i.subtotal * 100)::numeric, 0) = 9 THEN 'BTW 9%'
      ELSE 'No VAT'
    END as tax_name,
    i.subtotal as revenue_base,
    i.tax_amount as vat_collected
  FROM invoices i
  WHERE i.status IN ('sent', 'paid')
),
expense_vat AS (
  SELECT
    EXTRACT(YEAR FROM ii.invoice_date) as year,
    EXTRACT(QUARTER FROM ii.invoice_date) as quarter,
    ii.tax_rate_id,
    tr.rate as tax_rate,
    tr.name as tax_name,
    ii.subtotal as expense_base,
    ii.tax_amount as vat_paid
  FROM incoming_invoices ii
  LEFT JOIN tax_rates tr ON ii.tax_rate_id = tr.id
  WHERE ii.review_status = 'approved'
)
SELECT
  COALESCE(i.year, e.year) as year,
  COALESCE(i.quarter, e.quarter) as quarter,
  COALESCE(i.year, e.year) || '-Q' || COALESCE(i.quarter, e.quarter) as period,
  COALESCE(i.tax_rate_id, e.tax_rate_id) as tax_rate_id,
  COALESCE(i.tax_name, e.tax_name, 'No VAT') as tax_name,
  COALESCE(i.tax_rate, e.tax_rate, 0) as tax_rate,
  COALESCE(SUM(i.revenue_base), 0) as revenue_base,
  COALESCE(SUM(i.vat_collected), 0) as vat_collected,
  COALESCE(SUM(e.expense_base), 0) as expense_base,
  COALESCE(SUM(e.vat_paid), 0) as vat_paid,
  COALESCE(SUM(i.vat_collected), 0) - COALESCE(SUM(e.vat_paid), 0) as vat_to_pay
FROM income_vat i
FULL OUTER JOIN expense_vat e
  ON i.year = e.year
  AND i.quarter = e.quarter
  AND COALESCE(i.tax_rate_id, 0) = COALESCE(e.tax_rate_id, 0)
GROUP BY
  COALESCE(i.year, e.year),
  COALESCE(i.quarter, e.quarter),
  COALESCE(i.tax_rate_id, e.tax_rate_id),
  COALESCE(i.tax_name, e.tax_name, 'No VAT'),
  COALESCE(i.tax_rate, e.tax_rate, 0)
ORDER BY year DESC, quarter DESC, tax_rate DESC;

-- Recreate vat_declaration view
CREATE OR REPLACE VIEW vat_declaration AS
WITH base_vat AS (
  SELECT
    year,
    quarter,
    period,
    -- High rate (21%)
    SUM(CASE WHEN tax_rate = 21 THEN revenue_base ELSE 0 END) as high_rate_revenue,
    SUM(CASE WHEN tax_rate = 21 THEN vat_collected ELSE 0 END) as high_rate_vat_collected,

    -- Low rate (9%)
    SUM(CASE WHEN tax_rate = 9 THEN revenue_base ELSE 0 END) as low_rate_revenue,
    SUM(CASE WHEN tax_rate = 9 THEN vat_collected ELSE 0 END) as low_rate_vat_collected,

    -- Zero rate (0%)
    SUM(CASE WHEN tax_rate = 0 THEN revenue_base ELSE 0 END) as zero_rate_revenue,

    -- Input VAT (voorbelasting)
    SUM(vat_paid) as input_vat,

    -- Total to pay
    SUM(vat_collected) - SUM(vat_paid) as net_vat_to_pay
  FROM vat_summary_by_quarter
  GROUP BY year, quarter, period
),
exports AS (
  SELECT
    EXTRACT(YEAR FROM i.invoice_date) as year,
    EXTRACT(QUARTER FROM i.invoice_date) as quarter,
    -- Non-EU exports (not in Netherlands or EU countries)
    SUM(CASE
      WHEN c.country NOT IN ('Netherlands', 'Germany', 'Belgium', 'France', 'Other EU')
        AND c.country IS NOT NULL
      THEN i.subtotal
      ELSE 0
    END) as exports_non_eu,
    -- EU exports
    SUM(CASE
      WHEN c.country IN ('Germany', 'Belgium', 'France', 'Other EU')
      THEN i.subtotal
      ELSE 0
    END) as exports_eu
  FROM invoices i
  LEFT JOIN companies c ON i.client_id = c.id
  WHERE i.status IN ('sent', 'paid')
  GROUP BY EXTRACT(YEAR FROM i.invoice_date), EXTRACT(QUARTER FROM i.invoice_date)
),
imports AS (
  SELECT
    EXTRACT(YEAR FROM ii.invoice_date) as year,
    EXTRACT(QUARTER FROM ii.invoice_date) as quarter,
    -- Non-EU imports
    SUM(CASE
      WHEN c.country NOT IN ('Netherlands', 'Germany', 'Belgium', 'France', 'Other EU')
        AND c.country IS NOT NULL
      THEN ii.subtotal
      ELSE 0
    END) as imports_non_eu_revenue,
    SUM(CASE
      WHEN c.country NOT IN ('Netherlands', 'Germany', 'Belgium', 'France', 'Other EU')
        AND c.country IS NOT NULL
      THEN ii.tax_amount
      ELSE 0
    END) as imports_non_eu_vat,
    -- EU imports
    SUM(CASE
      WHEN c.country IN ('Germany', 'Belgium', 'France', 'Other EU')
      THEN ii.subtotal
      ELSE 0
    END) as imports_eu_revenue,
    SUM(CASE
      WHEN c.country IN ('Germany', 'Belgium', 'France', 'Other EU')
      THEN ii.tax_amount
      ELSE 0
    END) as imports_eu_vat
  FROM incoming_invoices ii
  LEFT JOIN companies c ON ii.supplier_id = c.id
  WHERE ii.review_status = 'approved'
  GROUP BY EXTRACT(YEAR FROM ii.invoice_date), EXTRACT(QUARTER FROM ii.invoice_date)
)
SELECT
  b.year,
  b.quarter,
  b.period,
  b.high_rate_revenue,
  b.high_rate_vat_collected,
  b.low_rate_revenue,
  b.low_rate_vat_collected,
  b.zero_rate_revenue,
  b.input_vat,
  b.net_vat_to_pay,
  COALESCE(e.exports_non_eu, 0) as exports_non_eu,
  COALESCE(e.exports_eu, 0) as exports_eu,
  COALESCE(i.imports_non_eu_revenue, 0) as imports_non_eu_revenue,
  COALESCE(i.imports_non_eu_vat, 0) as imports_non_eu_vat,
  COALESCE(i.imports_eu_revenue, 0) as imports_eu_revenue,
  COALESCE(i.imports_eu_vat, 0) as imports_eu_vat
FROM base_vat b
LEFT JOIN exports e ON b.year = e.year AND b.quarter = e.quarter
LEFT JOIN imports i ON b.year = i.year AND b.quarter = i.quarter
ORDER BY b.year DESC, b.quarter DESC;

-- Recreate vat_settlement view
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
        vd.exports_non_eu,
        vd.exports_eu,
        vd.imports_non_eu_revenue,
        vd.imports_non_eu_vat,
        vd.imports_eu_revenue,
        vd.imports_eu_vat,
        COALESCE(vp.net_amount, 0) as amount_paid,
        vp.payment_date,
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
    exports_non_eu,
    exports_eu,
    imports_non_eu_revenue,
    imports_non_eu_vat,
    imports_eu_revenue,
    imports_eu_vat,
    amount_paid,
    payment_date,
    balance,
    CASE
        WHEN balance > 0 THEN 'owed_to_tax_office'
        WHEN balance < 0 THEN 'tax_office_owes_you'
        ELSE 'settled'
    END as status,
    CASE
        WHEN balance < 0 THEN ABS(balance)
        ELSE 0
    END as expected_refund
FROM vat_calc
ORDER BY year DESC, quarter DESC;

COMMIT;

SELECT '✅ invoice_items table removed and VAT views updated!' as status;