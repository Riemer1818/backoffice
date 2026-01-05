-- ============================================
-- MIGRATION: Add Dashboard View
-- Comprehensive view for dashboard statistics
-- ============================================

BEGIN;

-- ============================================
-- DASHBOARD STATISTICS VIEW
-- ============================================

CREATE OR REPLACE VIEW dashboard_stats AS
WITH current_month AS (
  SELECT DATE_TRUNC('month', CURRENT_DATE) as period
),
current_quarter AS (
  SELECT
    EXTRACT(YEAR FROM CURRENT_DATE) as year,
    EXTRACT(QUARTER FROM CURRENT_DATE) as quarter
),
income_this_month AS (
  SELECT COALESCE(SUM(income_excl_vat), 0) as amount
  FROM profit_loss_summary
  WHERE period_date = (SELECT period FROM current_month)
),
expenses_this_month AS (
  SELECT COALESCE(SUM(expense_excl_vat), 0) as amount
  FROM profit_loss_summary
  WHERE period_date = (SELECT period FROM current_month)
),
vat_this_quarter AS (
  SELECT COALESCE(SUM(vat_to_pay), 0) as amount
  FROM vat_summary_by_quarter
  WHERE year = (SELECT year FROM current_quarter)
    AND quarter = (SELECT quarter FROM current_quarter)
),
vat_to_pay_total AS (
  -- All VAT that hasn't been paid yet (current quarter and previous unpaid quarters)
  SELECT COALESCE(SUM(net_vat_to_pay), 0) as amount
  FROM vat_declaration
  WHERE year * 10 + quarter <= (SELECT year * 10 + quarter FROM current_quarter)
    -- You can add a check here for paid VAT declarations when you implement that table
),
open_expenses AS (
  -- Expenses that are pending review
  SELECT COUNT(*) as count,
         COALESCE(SUM(total_amount), 0) as amount
  FROM incoming_invoices
  WHERE review_status = 'pending'
),
active_projects_count AS (
  SELECT COUNT(*) as count
  FROM projects
  WHERE status = 'active'
),
income_tax_estimate AS (
  -- Simple estimate: profit * 30% for income tax (adjust rate as needed)
  SELECT COALESCE(SUM(profit_excl_vat * 0.30), 0) as amount
  FROM profit_loss_summary
  WHERE period_date >= DATE_TRUNC('year', CURRENT_DATE)
    AND period_date <= DATE_TRUNC('month', CURRENT_DATE)
)
SELECT
  (SELECT amount FROM income_this_month) as income_this_month,
  (SELECT amount FROM expenses_this_month) as expenses_this_month,
  (SELECT amount FROM income_this_month) - (SELECT amount FROM expenses_this_month) as profit_this_month,

  -- VAT statistics
  (SELECT amount FROM vat_this_quarter) as vat_this_quarter,
  (SELECT amount FROM vat_to_pay_total) as vat_to_pay_total,

  -- Tax estimate for the year
  (SELECT amount FROM income_tax_estimate) as estimated_income_tax_ytd,

  -- Open/pending items
  (SELECT count FROM open_expenses) as pending_expenses_count,
  (SELECT amount FROM open_expenses) as pending_expenses_amount,

  -- Active projects
  (SELECT count FROM active_projects_count) as active_projects_count,

  -- Year to date totals
  (SELECT COALESCE(SUM(income_excl_vat), 0)
   FROM profit_loss_summary
   WHERE period_date >= DATE_TRUNC('year', CURRENT_DATE)) as income_ytd,

  (SELECT COALESCE(SUM(expense_excl_vat), 0)
   FROM profit_loss_summary
   WHERE period_date >= DATE_TRUNC('year', CURRENT_DATE)) as expenses_ytd,

  (SELECT COALESCE(SUM(profit_excl_vat), 0)
   FROM profit_loss_summary
   WHERE period_date >= DATE_TRUNC('year', CURRENT_DATE)) as profit_ytd;

COMMIT;
