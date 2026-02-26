-- ============================================
-- Recreate views that depend on vat_declaration
-- ============================================

BEGIN;

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

-- Recreate tax_summary view
CREATE OR REPLACE VIEW tax_summary AS
WITH latest_year AS (
  SELECT MAX(year) as year FROM income_tax_calculation
),
vat_summary AS (
  SELECT
    year,
    SUM(CASE WHEN balance > 0 THEN balance ELSE 0 END) AS vat_to_pay,
    SUM(CASE WHEN balance < 0 THEN ABS(balance) ELSE 0 END) AS vat_to_receive
  FROM vat_settlement
  WHERE year = (SELECT year FROM latest_year)
  GROUP BY year
)
SELECT
  itc.year,
  itc.gross_profit,
  itc.taxable_income,
  itc.total_income_tax AS income_tax_owed,
  itc.effective_tax_rate,
  COALESCE(vs.vat_to_pay, 0) AS vat_to_pay,
  COALESCE(vs.vat_to_receive, 0) AS vat_to_receive,
  itc.total_income_tax + COALESCE(vs.vat_to_pay, 0) AS total_tax_liability,
  COALESCE(vs.vat_to_receive, 0) AS total_tax_credit,
  (itc.total_income_tax + COALESCE(vs.vat_to_pay, 0)) - COALESCE(vs.vat_to_receive, 0) AS net_tax_position
FROM income_tax_calculation itc
LEFT JOIN vat_summary vs ON vs.year = itc.year
WHERE itc.year = (SELECT year FROM latest_year);

-- Recreate dashboard_stats view
CREATE OR REPLACE VIEW dashboard_stats AS
WITH current_month AS (
  SELECT DATE_TRUNC('month', CURRENT_DATE) as month_start
),
current_year AS (
  SELECT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER as year
),
monthly_income AS (
  SELECT
    COALESCE(SUM(total_amount), 0) as total_income,
    COALESCE(SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END), 0) as paid_income,
    COUNT(*) as invoice_count
  FROM invoices
  WHERE DATE_TRUNC('month', invoice_date) = (SELECT month_start FROM current_month)
    AND status IN ('sent', 'paid')
),
monthly_expenses AS (
  SELECT
    COALESCE(SUM(total_amount), 0) as total_expenses,
    COUNT(*) as expense_count
  FROM incoming_invoices
  WHERE DATE_TRUNC('month', invoice_date) = (SELECT month_start FROM current_month)
    AND review_status = 'approved'
),
yearly_stats AS (
  SELECT
    COALESCE((SELECT SUM(subtotal) FROM invoices WHERE EXTRACT(YEAR FROM invoice_date) = (SELECT year FROM current_year) AND status IN ('sent', 'paid')), 0) as ytd_revenue,
    COALESCE((SELECT SUM(subtotal) FROM incoming_invoices WHERE EXTRACT(YEAR FROM invoice_date) = (SELECT year FROM current_year) AND review_status = 'approved'), 0) as ytd_expenses,
    COALESCE((SELECT SUM(subtotal) FROM invoices WHERE EXTRACT(YEAR FROM invoice_date) = (SELECT year FROM current_year) AND status IN ('sent', 'paid')), 0) -
    COALESCE((SELECT SUM(subtotal) FROM incoming_invoices WHERE EXTRACT(YEAR FROM invoice_date) = (SELECT year FROM current_year) AND review_status = 'approved'), 0) as ytd_profit
),
outstanding_invoices AS (
  SELECT
    COALESCE(SUM(total_amount), 0) as outstanding_amount,
    COUNT(*) as outstanding_count
  FROM invoices
  WHERE status = 'sent'
    AND due_date < CURRENT_DATE
),
unpaid_bills AS (
  SELECT
    COALESCE(SUM(total_amount), 0) as unpaid_amount,
    COUNT(*) as unpaid_count
  FROM incoming_invoices
  WHERE payment_status = 'unpaid'
    AND review_status = 'approved'
)
SELECT
  -- Monthly stats
  mi.total_income as monthly_income,
  mi.paid_income as monthly_income_paid,
  me.total_expenses as monthly_expenses,
  mi.total_income - me.total_expenses as monthly_profit,
  mi.invoice_count as monthly_invoice_count,
  me.expense_count as monthly_expense_count,

  -- Year-to-date stats
  ys.ytd_revenue,
  ys.ytd_expenses,
  ys.ytd_profit,

  -- Outstanding items
  oi.outstanding_amount,
  oi.outstanding_count,
  ub.unpaid_amount as unpaid_bills_amount,
  ub.unpaid_count as unpaid_bills_count,

  -- Tax summary for current year
  COALESCE(ts.vat_to_pay, 0) as current_vat_to_pay,
  COALESCE(ts.vat_to_receive, 0) as current_vat_to_receive,
  COALESCE(ts.income_tax_owed, 0) as current_income_tax_owed

FROM monthly_income mi
CROSS JOIN monthly_expenses me
CROSS JOIN yearly_stats ys
CROSS JOIN outstanding_invoices oi
CROSS JOIN unpaid_bills ub
LEFT JOIN tax_summary ts ON TRUE;

COMMIT;

SELECT '✅ Dependent views recreated!' as status;