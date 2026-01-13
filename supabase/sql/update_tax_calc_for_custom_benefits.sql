-- Update income_tax_calculation view to use the new flexible user_benefit_selections table
-- This allows any custom benefit to be added and properly calculated

DROP VIEW IF EXISTS income_tax_calculation CASCADE;

CREATE OR REPLACE VIEW income_tax_calculation AS
WITH yearly_profit AS (
  SELECT
    EXTRACT(YEAR FROM period)::INTEGER AS year,
    SUM(profit_excl_vat) AS gross_profit
  FROM profit_loss_summary
  GROUP BY EXTRACT(YEAR FROM period)
),
user_deductions AS (
  SELECT
    ty.year,
    -- Zelfstandigenaftrek (only if user enabled it)
    COALESCE((
      SELECT tb.amount
      FROM tax_benefits tb
      JOIN user_benefit_selections ubs ON ubs.benefit_id = tb.id AND ubs.is_enabled = true
      WHERE tb.tax_year_id = ty.id AND tb.benefit_type = 'zelfstandigenaftrek'
      LIMIT 1
    ), 0) AS self_employed_deduction,
    -- Startersaftrek (only if user enabled it)
    COALESCE((
      SELECT tb.amount
      FROM tax_benefits tb
      JOIN user_benefit_selections ubs ON ubs.benefit_id = tb.id AND ubs.is_enabled = true
      WHERE tb.tax_year_id = ty.id AND tb.benefit_type = 'startersaftrek'
      LIMIT 1
    ), 0) AS startup_deduction,
    -- MKB-winstvrijstelling percentage (only if user enabled it)
    COALESCE((
      SELECT tb.percentage
      FROM tax_benefits tb
      JOIN user_benefit_selections ubs ON ubs.benefit_id = tb.id AND ubs.is_enabled = true
      WHERE tb.tax_year_id = ty.id AND tb.benefit_type = 'mkb_winstvrijstelling'
      LIMIT 1
    ), 0) AS mkb_profit_exemption,
    -- Sum of all other enabled custom deductions (amount-based benefits not in the above categories)
    COALESCE((
      SELECT SUM(tb.amount)
      FROM tax_benefits tb
      JOIN user_benefit_selections ubs ON ubs.benefit_id = tb.id AND ubs.is_enabled = true
      WHERE tb.tax_year_id = ty.id
        AND tb.benefit_type NOT IN ('zelfstandigenaftrek', 'startersaftrek', 'mkb_winstvrijstelling')
        AND tb.amount IS NOT NULL
    ), 0) AS custom_deductions
  FROM tax_years ty
),
brackets AS (
  SELECT
    ty.year,
    MAX(CASE WHEN itb.bracket_order = 1 THEN itb.income_to END) AS bracket_1_limit,
    MAX(CASE WHEN itb.bracket_order = 1 THEN itb.rate END) AS bracket_1_rate,
    MAX(CASE WHEN itb.bracket_order = 2 THEN itb.rate END) AS bracket_2_rate
  FROM tax_years ty
  JOIN income_tax_brackets itb ON itb.tax_year_id = ty.id
  GROUP BY ty.year
),
tax_calc AS (
  SELECT
    yp.year,
    yp.gross_profit,
    ud.self_employed_deduction,
    ud.startup_deduction,
    ud.custom_deductions,
    ud.mkb_profit_exemption,
    GREATEST(0, yp.gross_profit - ud.self_employed_deduction - COALESCE(ud.startup_deduction, 0) - COALESCE(ud.custom_deductions, 0)) AS profit_after_deductions,
    GREATEST(0, yp.gross_profit - ud.self_employed_deduction - COALESCE(ud.startup_deduction, 0) - COALESCE(ud.custom_deductions, 0)) * (ud.mkb_profit_exemption / 100) AS mkb_exemption_amount,
    GREATEST(0,
      GREATEST(0, yp.gross_profit - ud.self_employed_deduction - COALESCE(ud.startup_deduction, 0) - COALESCE(ud.custom_deductions, 0)) -
      (GREATEST(0, yp.gross_profit - ud.self_employed_deduction - COALESCE(ud.startup_deduction, 0) - COALESCE(ud.custom_deductions, 0)) * (ud.mkb_profit_exemption / 100))
    ) AS taxable_income,
    b.bracket_1_limit,
    b.bracket_1_rate,
    b.bracket_2_rate,
    LEAST(
      GREATEST(0,
        GREATEST(0, yp.gross_profit - ud.self_employed_deduction - COALESCE(ud.startup_deduction, 0) - COALESCE(ud.custom_deductions, 0)) -
        (GREATEST(0, yp.gross_profit - ud.self_employed_deduction - COALESCE(ud.startup_deduction, 0) - COALESCE(ud.custom_deductions, 0)) * (ud.mkb_profit_exemption / 100))
      ),
      b.bracket_1_limit
    ) * (b.bracket_1_rate / 100) AS tax_bracket_1,
    GREATEST(0,
      GREATEST(0,
        GREATEST(0, yp.gross_profit - ud.self_employed_deduction - COALESCE(ud.startup_deduction, 0) - COALESCE(ud.custom_deductions, 0)) -
        (GREATEST(0, yp.gross_profit - ud.self_employed_deduction - COALESCE(ud.startup_deduction, 0) - COALESCE(ud.custom_deductions, 0)) * (ud.mkb_profit_exemption / 100))
      ) - b.bracket_1_limit
    ) * (b.bracket_2_rate / 100) AS tax_bracket_2
  FROM yearly_profit yp
  LEFT JOIN user_deductions ud ON ud.year = yp.year
  LEFT JOIN brackets b ON b.year = yp.year
)
SELECT
  year,
  gross_profit,
  self_employed_deduction,
  startup_deduction,
  custom_deductions,
  mkb_profit_exemption,
  profit_after_deductions,
  mkb_exemption_amount,
  taxable_income,
  bracket_1_limit,
  bracket_1_rate,
  tax_bracket_1,
  bracket_2_rate,
  tax_bracket_2,
  tax_bracket_1 + tax_bracket_2 AS total_income_tax,
  CASE
    WHEN gross_profit > 0 THEN ((tax_bracket_1 + tax_bracket_2) / gross_profit * 100)
    ELSE 0
  END AS effective_tax_rate,
  gross_profit - (tax_bracket_1 + tax_bracket_2) AS net_profit_after_tax
FROM tax_calc
ORDER BY year DESC;

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
