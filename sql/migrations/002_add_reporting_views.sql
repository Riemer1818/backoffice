-- ============================================
-- MIGRATION: Add Reporting Views
-- Profit & Loss, VAT summaries, and reporting views
-- ============================================

BEGIN;

-- ============================================
-- PROFIT & LOSS VIEW
-- ============================================

CREATE OR REPLACE VIEW profit_loss AS
WITH income_summary AS (
  SELECT
    DATE_TRUNC('month', invoice_date) as period,
    'Income' as type,
    SUM(subtotal) as amount_excl_vat,
    SUM(tax_amount) as vat_amount,
    SUM(total_amount) as amount_incl_vat
  FROM invoices
  WHERE status IN ('sent', 'paid')
  GROUP BY DATE_TRUNC('month', invoice_date)
),
expense_summary AS (
  SELECT
    DATE_TRUNC('month', invoice_date) as period,
    'Expenses' as type,
    SUM(subtotal) as amount_excl_vat,
    SUM(tax_amount) as vat_amount,
    SUM(total_amount) as amount_incl_vat
  FROM incoming_invoices
  WHERE review_status = 'approved'
  GROUP BY DATE_TRUNC('month', invoice_date)
)
SELECT
  period,
  type,
  amount_excl_vat,
  vat_amount,
  amount_incl_vat
FROM income_summary

UNION ALL

SELECT
  period,
  type,
  amount_excl_vat,
  vat_amount,
  amount_incl_vat
FROM expense_summary

ORDER BY period DESC, type;

-- ============================================
-- PROFIT & LOSS SUMMARY (by period)
-- ============================================

CREATE OR REPLACE VIEW profit_loss_summary AS
WITH periods AS (
  SELECT DISTINCT DATE_TRUNC('month', invoice_date) as period
  FROM invoices
  WHERE status IN ('sent', 'paid')

  UNION

  SELECT DISTINCT DATE_TRUNC('month', invoice_date) as period
  FROM incoming_invoices
  WHERE review_status = 'approved'
),
income_by_period AS (
  SELECT
    DATE_TRUNC('month', invoice_date) as period,
    SUM(subtotal) as income_excl_vat,
    SUM(tax_amount) as income_vat,
    SUM(total_amount) as income_total
  FROM invoices
  WHERE status IN ('sent', 'paid')
  GROUP BY DATE_TRUNC('month', invoice_date)
),
expenses_by_period AS (
  SELECT
    DATE_TRUNC('month', invoice_date) as period,
    SUM(subtotal) as expense_excl_vat,
    SUM(tax_amount) as expense_vat,
    SUM(total_amount) as expense_total
  FROM incoming_invoices
  WHERE review_status = 'approved'
  GROUP BY DATE_TRUNC('month', invoice_date)
)
SELECT
  TO_CHAR(p.period, 'YYYY-MM') as period,
  p.period as period_date,
  COALESCE(i.income_excl_vat, 0) as income_excl_vat,
  COALESCE(e.expense_excl_vat, 0) as expense_excl_vat,
  COALESCE(i.income_excl_vat, 0) - COALESCE(e.expense_excl_vat, 0) as profit_excl_vat,
  COALESCE(i.income_vat, 0) as income_vat,
  COALESCE(e.expense_vat, 0) as expense_vat,
  COALESCE(i.income_total, 0) as income_total,
  COALESCE(e.expense_total, 0) as expense_total,
  COALESCE(i.income_total, 0) - COALESCE(e.expense_total, 0) as profit_total
FROM periods p
LEFT JOIN income_by_period i ON p.period = i.period
LEFT JOIN expenses_by_period e ON p.period = e.period
ORDER BY p.period DESC;

-- ============================================
-- VAT SUMMARY (by quarter)
-- ============================================

CREATE OR REPLACE VIEW vat_summary_by_quarter AS
WITH income_vat AS (
  SELECT
    EXTRACT(YEAR FROM i.invoice_date) as year,
    EXTRACT(QUARTER FROM i.invoice_date) as quarter,
    ii.tax_rate_id,
    tr.rate as tax_rate,
    tr.name as tax_name,
    SUM(ii.subtotal) as revenue_base,
    SUM(ii.tax_amount) as vat_collected
  FROM invoices i
  LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
  LEFT JOIN tax_rates tr ON ii.tax_rate_id = tr.id
  WHERE i.status IN ('sent', 'paid')
  GROUP BY
    EXTRACT(YEAR FROM i.invoice_date),
    EXTRACT(QUARTER FROM i.invoice_date),
    ii.tax_rate_id,
    tr.rate,
    tr.name
),
expense_vat AS (
  SELECT
    EXTRACT(YEAR FROM invoice_date) as year,
    EXTRACT(QUARTER FROM invoice_date) as quarter,
    tax_rate_id,
    tr.rate as tax_rate,
    tr.name as tax_name,
    SUM(subtotal) as expense_base,
    SUM(tax_amount) as vat_paid
  FROM incoming_invoices ii
  LEFT JOIN tax_rates tr ON ii.tax_rate_id = tr.id
  WHERE review_status = 'approved'
  GROUP BY
    EXTRACT(YEAR FROM invoice_date),
    EXTRACT(QUARTER FROM invoice_date),
    tax_rate_id,
    tr.rate,
    tr.name
)
SELECT
  COALESCE(i.year, e.year) as year,
  COALESCE(i.quarter, e.quarter) as quarter,
  COALESCE(i.year, e.year) || '-Q' || COALESCE(i.quarter, e.quarter) as period,
  COALESCE(i.tax_rate_id, e.tax_rate_id) as tax_rate_id,
  COALESCE(i.tax_name, e.tax_name, 'No VAT') as tax_name,
  COALESCE(i.tax_rate, e.tax_rate, 0) as tax_rate,
  COALESCE(i.revenue_base, 0) as revenue_base,
  COALESCE(i.vat_collected, 0) as vat_collected,
  COALESCE(e.expense_base, 0) as expense_base,
  COALESCE(e.vat_paid, 0) as vat_paid,
  COALESCE(i.vat_collected, 0) - COALESCE(e.vat_paid, 0) as vat_to_pay
FROM income_vat i
FULL OUTER JOIN expense_vat e
  ON i.year = e.year
  AND i.quarter = e.quarter
  AND COALESCE(i.tax_rate_id, 0) = COALESCE(e.tax_rate_id, 0)
ORDER BY year DESC, quarter DESC, tax_rate DESC;

-- ============================================
-- VAT DECLARATION (ready for quarterly filing)
-- ============================================

CREATE OR REPLACE VIEW vat_declaration AS
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
ORDER BY year DESC, quarter DESC;

-- ============================================
-- INCOME BREAKDOWN (by client)
-- ============================================

CREATE OR REPLACE VIEW income_by_client AS
SELECT
  c.id as client_id,
  c.name as client_name,
  c.type as client_type,
  COUNT(DISTINCT i.id) as invoice_count,
  SUM(i.subtotal) as total_excl_vat,
  SUM(i.tax_amount) as total_vat,
  SUM(i.total_amount) as total_incl_vat,
  SUM(CASE WHEN i.status = 'paid' THEN i.total_amount ELSE 0 END) as paid_amount,
  SUM(CASE WHEN i.status = 'sent' THEN i.total_amount ELSE 0 END) as outstanding_amount,
  MIN(i.invoice_date) as first_invoice_date,
  MAX(i.invoice_date) as last_invoice_date
FROM companies c
LEFT JOIN invoices i ON c.id = i.client_id AND i.status IN ('sent', 'paid')
WHERE c.type IN ('client', 'both')
GROUP BY c.id, c.name, c.type
HAVING COUNT(DISTINCT i.id) > 0
ORDER BY total_incl_vat DESC;

-- ============================================
-- EXPENSES BREAKDOWN (by supplier)
-- ============================================

CREATE OR REPLACE VIEW expenses_by_supplier AS
SELECT
  c.id as supplier_id,
  c.name as supplier_name,
  c.type as supplier_type,
  COUNT(DISTINCT ii.id) as invoice_count,
  SUM(ii.subtotal) as total_excl_vat,
  SUM(ii.tax_amount) as total_vat,
  SUM(ii.total_amount) as total_incl_vat,
  SUM(CASE WHEN ii.payment_status = 'paid' THEN ii.total_amount ELSE 0 END) as paid_amount,
  SUM(CASE WHEN ii.payment_status = 'unpaid' THEN ii.total_amount ELSE 0 END) as unpaid_amount,
  MIN(ii.invoice_date) as first_invoice_date,
  MAX(ii.invoice_date) as last_invoice_date
FROM companies c
LEFT JOIN incoming_invoices ii ON c.id = ii.supplier_id AND ii.review_status = 'approved'
WHERE c.type IN ('supplier', 'both')
GROUP BY c.id, c.name, c.type
HAVING COUNT(DISTINCT ii.id) > 0
ORDER BY total_incl_vat DESC;

-- ============================================
-- EXPENSES BREAKDOWN (by category)
-- ============================================

CREATE OR REPLACE VIEW expenses_by_category AS
SELECT
  ec.id as category_id,
  ec.name as category_name,
  COUNT(ii.id) as invoice_count,
  SUM(ii.subtotal) as total_excl_vat,
  SUM(ii.tax_amount) as total_vat,
  SUM(ii.total_amount) as total_incl_vat,
  MIN(ii.invoice_date) as first_expense_date,
  MAX(ii.invoice_date) as last_expense_date
FROM expense_categories ec
LEFT JOIN incoming_invoices ii ON ec.id = ii.category_id AND ii.review_status = 'approved'
GROUP BY ec.id, ec.name
HAVING COUNT(ii.id) > 0
ORDER BY total_incl_vat DESC;

-- ============================================
-- PROJECT PROFITABILITY
-- ============================================

CREATE OR REPLACE VIEW project_profitability AS
WITH project_income AS (
  SELECT
    p.id as project_id,
    p.name as project_name,
    p.client_id,
    c.name as client_name,
    SUM(i.subtotal) as revenue_excl_vat,
    SUM(i.total_amount) as revenue_incl_vat,
    COUNT(DISTINCT i.id) as invoice_count
  FROM projects p
  LEFT JOIN companies c ON p.client_id = c.id
  LEFT JOIN invoices i ON p.id = i.project_id AND i.status IN ('sent', 'paid')
  GROUP BY p.id, p.name, p.client_id, c.name
),
project_expenses AS (
  SELECT
    p.id as project_id,
    SUM(ii.subtotal) as expense_excl_vat,
    SUM(ii.total_amount) as expense_incl_vat,
    COUNT(DISTINCT ii.id) as expense_count
  FROM projects p
  LEFT JOIN incoming_invoices ii ON p.id = ii.project_id AND ii.review_status = 'approved'
  GROUP BY p.id
),
project_time AS (
  SELECT
    project_id,
    SUM(total_hours) as total_hours,
    SUM(chargeable_hours) as chargeable_hours,
    COUNT(*) as time_entry_count
  FROM time_entries
  GROUP BY project_id
)
SELECT
  pi.project_id,
  pi.project_name,
  pi.client_id,
  pi.client_name,
  COALESCE(pt.total_hours, 0) as total_hours,
  COALESCE(pt.chargeable_hours, 0) as chargeable_hours,
  COALESCE(pt.time_entry_count, 0) as time_entries,
  COALESCE(pi.invoice_count, 0) as invoices,
  COALESCE(pe.expense_count, 0) as expenses,
  COALESCE(pi.revenue_excl_vat, 0) as revenue_excl_vat,
  COALESCE(pe.expense_excl_vat, 0) as expense_excl_vat,
  COALESCE(pi.revenue_excl_vat, 0) - COALESCE(pe.expense_excl_vat, 0) as profit_excl_vat,
  CASE
    WHEN COALESCE(pt.chargeable_hours, 0) > 0
    THEN ROUND((COALESCE(pi.revenue_excl_vat, 0) / pt.chargeable_hours)::numeric, 2)
    ELSE 0
  END as effective_hourly_rate
FROM project_income pi
LEFT JOIN project_expenses pe ON pi.project_id = pe.project_id
LEFT JOIN project_time pt ON pi.project_id = pt.project_id
ORDER BY profit_excl_vat DESC;

COMMIT;

-- ============================================
-- VERIFICATION & EXAMPLES
-- ============================================

SELECT '✅ Reporting views created!' as status;

\echo ''
\echo '📊 Available Reporting Views:'
\echo '  - profit_loss: Detailed P&L by period and type'
\echo '  - profit_loss_summary: Monthly profit/loss summary'
\echo '  - vat_summary_by_quarter: VAT breakdown by quarter and rate'
\echo '  - vat_declaration: Ready for quarterly VAT filing'
\echo '  - income_by_client: Revenue breakdown by client'
\echo '  - expenses_by_supplier: Expense breakdown by supplier'
\echo '  - expenses_by_category: Expense breakdown by category'
\echo '  - project_profitability: Profit per project with hourly rates'
\echo ''
\echo 'Try: SELECT * FROM profit_loss_summary;'
\echo 'Try: SELECT * FROM vat_declaration;'
