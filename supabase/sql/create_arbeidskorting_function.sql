-- Create function to calculate arbeidskorting based on income and year
CREATE OR REPLACE FUNCTION calculate_arbeidskorting(
  p_year INTEGER,
  p_income NUMERIC
) RETURNS NUMERIC AS $$
DECLARE
  v_tax_year_id INTEGER;
  v_bracket RECORD;
  v_arbeidskorting NUMERIC := 0;
  v_income_in_bracket NUMERIC;
BEGIN
  -- Get tax year ID
  SELECT id INTO v_tax_year_id FROM tax_years WHERE year = p_year;

  IF v_tax_year_id IS NULL THEN
    RETURN 0;
  END IF;

  -- Find the applicable bracket
  FOR v_bracket IN
    SELECT * FROM arbeidskorting_brackets
    WHERE tax_year_id = v_tax_year_id
      AND income_from <= p_income
      AND (income_to IS NULL OR p_income < income_to)
    ORDER BY bracket_order DESC
    LIMIT 1
  LOOP
    IF v_bracket.rate_applies_to_excess THEN
      -- Formula: base_amount + rate% x (income - income_from)
      v_income_in_bracket := p_income - v_bracket.income_from;
      v_arbeidskorting := v_bracket.base_amount + (v_income_in_bracket * v_bracket.rate / 100);
    ELSE
      -- Simple percentage of total income (for first bracket) or fixed amount (for last bracket)
      IF v_bracket.bracket_order = 1 THEN
        v_arbeidskorting := p_income * v_bracket.rate / 100;
      ELSE
        v_arbeidskorting := v_bracket.base_amount;
      END IF;
    END IF;
  END LOOP;

  RETURN GREATEST(0, v_arbeidskorting);
END;
$$ LANGUAGE plpgsql;
